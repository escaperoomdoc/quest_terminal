const http = require('http');
const express = require("express");
const cors = require('cors');
const config = require('./config.json');
const api = require('./api');
const db = require('./db');
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

db(app)
    .then(() => {
        axios.get('/categories')
            .then(response => {
                console.log(response.data);
            })
            .catch(function (error) {
                console.log(error);
            })
            .finally(function () {
                // always executed
            });
    });
api(app);

let qb = new QueenBridge(config.settings.queenbridgeUrl, {
    id: "bpm_terminal",
    keepOffline: 10000,
    override: true
});

qb.on('connect', function() {
    console.log('connected');
});
qb.on('disconnect', function() {
    console.log('disconnected');
});
qb.on('receive', function(data) {
    console.log(data);
});
