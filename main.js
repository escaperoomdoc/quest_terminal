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

//vars
let times, schedule, rooms;

db(app)
    .then(() =>{
        getTimes().then((response) => {
            times = response;
            schedule = getSchedule();
        });
        getRooms().then((response) => {
            rooms = response;
        });
    });
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
    // console.log(data);
    let command = data.payload.command;
    switch(command) {
        case 'start':
            startGame(data.payload.id);
            break;
        case 'stop':
            console.log(`stop game for ${data.payload.id} team`);
            break;
    }
});

// let teamQueue = [];
//
// function queuingTeam(id) {
//     console.log('queuing team ' + id);
//     if (teamQueue.length)  {
//         let { timeOfStart } = teamQueue[teamQueue.length - 1];
//         let now = new Date(timeOfStart);
//         let delta = 10;
//         now.setMinutes(now.getMinutes() + delta);
//         teamQueue.push({
//             id,
//             timeOfStart: now
//         });
//     }
//     else {
//         let now = new Date();
//         let minutes = now.getMinutes();
//         let delta = (minutes % 15) ? 15 - (minutes % 15) : 0;
//         now.setMinutes(now.getMinutes() + delta);
//         teamQueue.push({
//            id,
//            timeOfStart: now
//         });
//     }
//     console.log(JSON.stringify(teamQueue[teamQueue.length - 1]));
// }

async function getTimes() {
    try {
        const { data } = await axios.get('/times');
        let times = data.reduce((prev, item, i) => {
            prev[item.name] = item.value;
            return prev;
        }, {});
        console.log('get times: '+ JSON.stringify(times));
        return times;
    }
    catch (e) {
        console.log(e);
    }
}

async function getRooms() {
    try {
        let { data: rooms } = await axios.get('/rooms');
        rooms.sort((a, b) => a.order > b.order ? 1 : -1);
        console.log('get rooms: '+ JSON.stringify(rooms));
        return rooms;
    }
    catch (e) {
        console.log(e);
    }
}

function getSchedule() {
    let interval = times["TEAMS_INTERVAL"];

    let start = new Date();
    start.setHours(6, 0, 0, 0);
    // console.log(start.toISOString());

    let finish = new Date(start);
    finish.setHours(finish.getHours() + 24);
    finish.setSeconds(finish.getSeconds() - 2 * interval);
    // console.log(finish.toISOString());

    let schedule = [{time: start}];
    while (schedule[schedule.length - 1].time < finish) {
        let newTime =  new Date(schedule[schedule.length - 1].time);
        newTime.setSeconds(newTime.getSeconds() + interval);
        schedule.push({time: newTime});
    }
    // console.log(schedule[schedule.length - 1].time.toISOString());
    return schedule;
}

async function startGame(id) {
    try {
        let response = await axios.get(`/teams/${id}`);
        let team = response.data;
        if (team.timeofBegin) {
            console.log(`game for "${team.name}" already started`);
            return 0;
        }
        let timeofBegin = scheduleTeam(id);
        //сделать расчёт времени окончания
        await axios.put('/teams/' + id, { timeofBegin });
        console.log(`start game for "${team.name}" at ${timeofBegin}`);
        team.timeofBegin = timeofBegin;

        let now = new Date();
        await sleep(timeofBegin - now);
        await demoStage(team);
        await sleep(times["DEMO_ROOM"] * 10);
        await trainingStage(team);
        await arenaStage(team);
        await sleep(times["TRAINING_ROOM"] * 10);
        for (let i = 3; i < rooms.length - 1; i++) {
            await genericStage(team, rooms[i]);
            await sleep(times["GENERIC_ROOM"] * 10);
            await arenaStage(team);
            await sleep(times["ARENA"] * 10);
        }
        await bonusStage(team);
        await sleep(times["GENERIC_ROOM"] * 10);
    }
    catch (e) {
        console.log(e);
    }
}

async function demoStage(team, room = rooms[1]) {
    try {
        let now = new Date();
        console.log(`[${now}]: demo stage for "${team.name}" started`);
    }
    catch (e) {
        console.log(e);
    }
}

async function trainingStage(team, room = rooms[2]) {
    try {
        let now = new Date();
        console.log(`[${now}]: training stage for "${team.name}" started`);
    }
    catch (e) {
        console.log(e);
    }
}

async function arenaStage(team, room = rooms[0]) {
    try {
        let now = new Date();
        console.log(`[${now}]: arena stage for "${team.name}" started`);
    }
    catch (e) {
        console.log(e);
    }
}

async function genericStage(team, room) {
    try {
        let now = new Date();
        console.log(`[${now}]: ${room.name.toLowerCase()} stage for "${team.name}" started`);
    }
    catch (e) {
        console.log(e);
    }
}

async function bonusStage(team, room = rooms[rooms.length - 1]) {
    try {
        let now = new Date();
        console.log(`[${now}]: bonus stage for "${team.name}" started`);
    }
    catch (e) {
        console.log(e);
    }
}

function scheduleTeam(id) {
    let countdown = times["COUNTDOWN"];
    let now = new Date();
    now.setSeconds(now.getSeconds() + countdown);
    for (let i = 0; i < schedule.length; i++) {
        if (schedule[i].time > now && !schedule[i].id) {
            schedule[i].id = id;
            return schedule[i].time;
        }
    }
    //написать здесь чистку старого расписания и составление нового
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
