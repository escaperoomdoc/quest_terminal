const http = require('http');
const express = require("express");
const cors = require('cors');
const config = require('./config.json');
const api = require('./api');
const db = require('./db');
// const static = require('./db/static');
const path = require('path');
const QueenBridge = require('./queenbridge');
io = require('socket.io-client');
const axios = require('axios');

// init app, HTTP server and static recourses
const app = express();
app.config = config;
app.use(express.json());
app.use(cors());
app.use(express.static('public'));
app.appRoot = path.resolve(__dirname);
axios.defaults.baseURL = 'http://localhost/api';

// start http server
var httpServer = http.createServer(app);
httpServer.listen(config.settings.httpPort, () => {});

console.log(`terminal server started on ${config.settings.httpPort}...`);

db(app);
    // .then(() => {
    //     axios.get('/times')
    //         .then(response => {
    //             if (!response.data.length) {
    //                 let { timeTypes } = static;
    //                 console.log(timeTypes);
    //                 for (let i = 0; i < timeTypes.length; i++) {
    //                     axios.post('/times', {
    //                         name: timeTypes[i],
    //                         value: 0
    //                     })
    //                         .catch(function (error) {
    //                             console.log(error);
    //                         })
    //                 }
    //             }
    //         })
    //         .catch(function (error) {
    //             console.log(error);
    //         })
    // });
api(app);

let qb = new QueenBridge(config.settings.queenbridgeUrl, {
    id: "bpm_terminal",
    keepOffline: 10000,
    override: true
});

qb.on('connect', function() {
    console.log('connected to Queen Bridge');
});
qb.on('disconnect', function() {
    console.log('disconnected');
});
qb.on('receive', function(data) {
    console.log(data);

    let command = data.payload.command;
    switch(command) {
        case 'start':
            queuingTeam(data.payload.id);
            break;
        case 'stop':
            console.log(`stop game for ${data.payload.id} team`);
            break;
    }
});

let teamQueue = [];

function queuingTeam(id) {
    console.log('queuing team ' + id);
    if (teamQueue.length)  {
        let { timeOfStart } = teamQueue[teamQueue.length - 1];
        let now = new Date(timeOfStart);
        let delta = 10;
        now.setMinutes(now.getMinutes() + delta);
        teamQueue.push({
            id,
            timeOfStart: now
        });
    }
    else {
        let now = new Date();
        let minutes = now.getMinutes();
        let delta = (minutes % 15) ? 15 - (minutes % 15) : 0;
        now.setMinutes(now.getMinutes() + delta);
        teamQueue.push({
           id,
           timeOfStart: now
        });
    }
    console.log(JSON.stringify(teamQueue[teamQueue.length - 1]));
}
