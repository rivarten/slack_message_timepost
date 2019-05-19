const request = require('request');

const fs = require('fs');

const bodyParser  = require("body-parser");
const express = require('express');
const app = express();
const moment = require('moment-timezone');

const config = require('./config');

const PORT = 6666;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

let jobs = [];

process.on("SIGHUP",() => {
    for (let i = 0; i < jobs.length; i++) {
        clearTimeout(jobs[i].id);
        delete jobs[i];
    }
    process.exit(1);
});
process.on("SIGINT",() => {
    for (let i = 0; i < jobs.length; i++) {
        clearTimeout(jobs[i].id);
        delete jobs[i];
        console.log(`Cancel job${i}`);
    }
    process.exit(1);
});
process.on("SIGTERM", () => {
    for (let i = 0; i < jobs.length; i++) {
        clearTimeout(jobs[i].id);
        delete jobs[i];
        console.log(`Cancel job${i}`);
    }
    process.exit(1);
});

const slackPost = async (data) => {
    let nowdt = moment();
    let tmdt = moment(`${data.body.year}/${data.body.month}/${data.body.date} ${data.body.hour}:${data.body.minute}:${data.body.second}`,
                      'YYYY/MM/DD hh:mm:ss');
    let duration = Math.floor((tmdt.valueOf() - nowdt.valueOf()));
    console.log(duration);
    jobs.push({
        id: setTimeout(function (id, data) {
            console.log(`${moment().format('YYYY/MM/DD hh:mm:ss')} ${data.body.text}`)
            request.post({
                uri: 'https://slack.com/api/chat.postMessage',
                headers: {'Content-Type': 'application/x-www-form-urlencoded'},
                form: {
                    as_user: true,
                    channel: encodeURIComponent(config.Slack.Channel[data.body.channel].Name),
                    token: config.Slack.User[data.body.user].Token,
                    text: data.body.text,
                }
            }, (err, res, body) => {
                if (err) {
                    console.log(err);
                    clearTimeout(jobs[id].id);
                } else {
                    console.log(res.statusCode, body);
                    clearTimeout(jobs[id].id);
                }
                fs.unlinkSync(`msgstock_${data.timestamp}.json`);
            });
            }.bind(null,jobs.length, data),
            duration
        ),
        data: data,
    });
    const jobId = jobs.length - 1;
    console.log(`Job idx:${jobId}`);
    return jobId;
};
app.post('/slack/timer_message/register', async (req, res) => {
    console.log(req.body);
    console.log(moment().tz('Asia/Tokyo').format());
    let body = req.body;
    const nextJobId = jobs.length + 1;
    const requestData = {
        body: body,
        status: false,
        timestamp: moment().valueOf(),
    };
    fs.writeFileSync(`./msgstock_${requestData.timestamp}.json`, JSON.stringify(requestData));

    const jobId = await slackPost(requestData);

    res.send(`Register OK:${jobId}`);
});
app.post('/slack/timer_message/cancel/:id', async (req, res) => {
    const id = req.params.id;
    clearTimeout(jobs[id].id);
    fs.unlinkSync(`msgstock_${jobs[id].data.timestamp}.json`);
    console.log(`Cancel Job:${JSON.stringify(jobs[id])}`);
    jobs.splice(id, 1);
    res.send(`Cancel OK:${id}`);
});

const loadExistingMessage = async () => {
    const path = process.cwd();
    const filenames = fs.readdirSync(path);
    console.log(filenames);
    const msgstock_files = filenames.filter((elem, idx) => {
        console.log(elem);
        return elem.indexOf('msgstock_') >= 0;
    });
    console.log(msgstock_files);
    for (let i=0; i < msgstock_files.length; i++) {
        const data = JSON.parse(fs.readFileSync(msgstock_files[i]));
        const jobId = await slackPost(data);
        console.log(`Register OK:${jobId} : ${JSON.stringify(data)}`);
    }
};

loadExistingMessage();

app.listen(PORT, () => {
    console.log(`listen port ${PORT}`);
});
