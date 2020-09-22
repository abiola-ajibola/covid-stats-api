const express = require('express')
const fetch = require('node-fetch')
const mongoose = require('mongoose')
const cors = require('cors')
require('dotenv').config()
const app = express();
const db = mongoose.connection;
mongoose.connect(`${process.env.DB_HOST}`, { useNewUrlParser: true, useUnifiedTopology: true })
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    // confirm connection successful connection to the database
    console.log('👍');
});

app.use(cors({ origin: 'https://awesome-cori-70a96c.netlify.app'}))
app.use(express.json())

const statsSchema = new mongoose.Schema({
    location: {
        long: Number,
        countryOrRegion: String,
        provinceOrState: String,
        county: String,
        isoCode: String,
        lat: Number
    },
    updatedDateTime: String,
    stats: {
        totalConfirmedCases: Number,
        newlyConfirmedCases: Number,
        totalDeaths: Number,
        newDeaths: Number,
        totalRecoveredCases: Number,
        newlyRecoveredCases: Number,
        history: [],
        breakdowns: []
    }
})

const newsSchema = new mongoose.Schema(
    {
        location:
        {
            long: Number,
            countryOrRegion: String,
            provinceOrState: String,
            county: String,
            isoCode: String,
            lat: Number
        },
        updatedDateTime: String,
        news: []
    }

)

// compile model from Schema

let News;
try {
    News = mongoose.model('no_news')
} catch {
    News = mongoose.model('no_news', newsSchema);
}


let Stats;
try {
    Stats = mongoose.model('statistical_data')
} catch {
    Stats = mongoose.model('statistical_data', statsSchema);
}

const stats_id = process.env.STATS_ID;
const id = process.env.ID;
const HOST = process.env.API_HOST || 'http://localhost:4888';
const PORT = process.env.PORT || 4888;

app.post('/stats', (req, res) => {
    const { param } = req.body
    const queryString = (param === 'global') ? { _id: stats_id } : { 'location.isoCode': param };
    Stats.findOne(queryString, function (err, data) {
        console.log(queryString)
        if (err) console.log(err)
        if (data && (new Date(data.updatedDateTime).toDateString() === new Date().toDateString())) {
            // if the date on the data is same as today's date, send the data to the client

            console.log('Stats from cache')
            res.status(200).send(JSON.stringify(data))
        } else {
            // If dates do not match, it means data is stale. Make another API call, then replace the previous
            // data with the new data.

            fetch(`https://${HOST}/stats/v1/${param}/`, {
                method: 'get',
                headers: {
                    "x-rapidapi-host": process.env.API_HOST,
                    "x-rapidapi-key": process.env.API_KEY
                }
            })
                .then(res => res.json())
                .then(stats => {
                    console.log("Stats From API")
                    console.log(param)

                    // Replace previous data in the database with new data.

                    Stats.replaceOne(queryString, stats, { upsert: true }, (err, news) => {
                        if (err) console.log(err)
                        console.log('Database Updated')
                    })
                    return stats
                })
                .then(statistics => {
                    // send data to client
                    res.status(200).send(JSON.stringify(statistics))
                    return statistics
                })
                .catch(console.log)
        }
    })
})

app.get('/news', (req, res) => {

    News.findById(id, (err, data) => {
        if (err) throw (err)
        if (data && (new Date(data.updatedDateTime).toDateString() === new Date().toDateString())) {
            console.log("Updated Time: " + data.updatedDateTime)
            // if the date on the data is same as today's date, send the data to the client

            console.log('News from cache')
            res.status(200).send(JSON.stringify(data))
        } else {
            // If dates do not match, it means data is stale. Make another API call, then replace the previous
            // data with the new data.

            fetch(`https://${HOST}/news/v1/global/`, {
                method: 'get',
                headers: {
                    "x-rapidapi-host": process.env.API_HOST,
                    "x-rapidapi-key": process.env.API_KEY
                }
            })
                .then(res => res.json())
                .then(data => {
                    console.log("News From API")

                    // Replace previous data in the database with new data.

                    News.replaceOne({ _id: id }, data, { upsert: true }, (err, news) => {
                        if (err) console.log(err)
                        console.log('Database Updated')
                    })
                    return data
                })
                .then(newsItems => {
                    // send data to the client
                    res.status(200).send(JSON.stringify(newsItems))
                    return newsItems
                })
                .catch(console.log)
        }
    })

})

app.listen(PORT, () => 'Listening')