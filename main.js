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
let times, schedule, rooms, activeTeams = {}, texts;
const ms = 1000;

db(app)
    .then(() =>{
        getTimes().then((response) => {
            times = response;
            schedule = getSchedule();
        });
        getRooms().then((response) => {
            rooms = response;
        });
        checkTeams();
        getTexts().then((response) => {
            texts = response;
        })
    });
api(app);

let qb = new QueenBridge(config.settings.queenbridgeUrl, {
    id: "bpm_terminal_",
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
    console.log('[Queen Bridge]: ' + JSON.stringify(data));
    let command = data.payload.command;
    if (data.srcId === 'terminal_manager') {
        switch(command) {
            case 'start':
                startGame(data.payload.id);
                break;
            case 'stop':
                stopGame(data.payload.id);
                break;
        }
    }
    else {
        if (command === 'bonus') {
            let id = data.payload.id;
            let room = data.payload.room;
            let state = data.payload.state;
            activeTeams[id].bonus[room] = state;
        }

    }
});

setTimeout(() => {
    qb.topic("/terminal/time");
}, 500);
setInterval(() => {
    qb.publish("/terminal/time", {
        type: "time",
        time: Date.now(),
    });
}, 1000);

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

async function getTexts() {
    try {
        let { data: languages } = await axios.get('/languages');
        let { data: textsArray } = await axios.get('/texts');
        let texts = {};
        for (let language of languages) {
            texts[language.id] = {
                tasks: {}
            };
        }
        for (let text of textsArray) {
            if (text.name === 'TASK_TEXT') {
                texts[text.languageId].tasks[text.roomId] = text.text;
            }
            else texts[text.languageId][text.name] = text.text;
        }
        console.log('get texts: '+ JSON.stringify(texts));
        return texts;
    }
    catch (e) {
        console.log(e);
    }
}

async function getQuestions(languageId, categoryId) {
    let { data: questions } = await axios.get(`/questions?languageId=${languageId}&categoryId=${categoryId}`);
    questions.sort(() => Math.round(Math.random()) ? 1 : -1);
    console.log('get questions: '+ JSON.stringify(questions));
    return questions;
}

async function checkTeams() {
    try {
        let { data: teams } = await axios.get('/teams');
        for (let team of teams) {
            if (!team.finished) {
                if (team.timeofBegin || team.timeofBegin) {
                    await axios.put('/teams/' + team.id, { finished: true });
                }
            }
        }
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
        await axios.put('/teams/' + id, { timeofBegin });
        console.log(`start game for "${team.name}" at ${timeofBegin}`);
        team.timeofBegin = timeofBegin;


        activeTeams[id] = {
            timers: [],
            questions: [],
            bonus: {}
        };
        activeTeams[id].questions = await getQuestions(team.languageId, team.categoryId);
        activeTeams[id].timers.push(
            setTimeout(countdownStage,
                timeofBegin - Date.now() - times["COUNTDOWN"] * ms, team)
        );
        activeTeams[id].timers.push(
            setTimeout(demoStage,
                timeofBegin - Date.now(), team)
        );
        let delta = times["DEMO_ROOM"] * ms;
        activeTeams[id].timers.push(
            setTimeout(trainingStage,
                timeofBegin - Date.now() + delta, team, rooms[2], activeTeams[id].questions[0])
        );
        delta += times["TRAINING_ROOM"] * ms;
        activeTeams[id].timers.push(
            setTimeout(arenaStage,
                timeofBegin - Date.now() + delta, team, rooms[0], activeTeams[id].questions[0], rooms[2].rpi)
        );
        delta += times["ARENA"] * ms;
        for (let i = 3; i < rooms.length - 1; i++) {
            activeTeams[id].timers.push(
                setTimeout(genericStage,
                    timeofBegin - Date.now() + delta, team, rooms[i], activeTeams[id].questions[0])
            );
            delta += times["GENERIC_ROOM"] * ms;
            activeTeams[id].timers.push(
                setTimeout(arenaStage,
                    timeofBegin - Date.now() + delta, team, rooms[0], activeTeams[id].questions[0], rooms[i].rpi)
            );
            delta += times["ARENA"] * ms;
        }
        activeTeams[id].timers.push(
            setTimeout(bonusStage,
                timeofBegin - Date.now() + delta, team)
        );
        delta += times["GENERIC_ROOM"] * ms;
        activeTeams[id].timers.push(
            setTimeout(finishStage,
                timeofBegin - Date.now() + delta, team)
        );
        let timeofEnd = new Date(timeofBegin);
        timeofEnd.setMilliseconds(timeofEnd.getMilliseconds() + delta);
        await axios.put('/teams/' + id, { timeofEnd });
    }
    catch (e) {
        console.log(e);
    }
}

async function countdownStage(team) {
    try {
        let now = new Date();
        qb.send("terminal_countdown", {
            team,
            time: times["COUNTDOWN"]
        });
        console.log(`[${now}]: countdown stage for "${team.name}" started`);
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

async function trainingStage(teamOld, room, question) {
    try {
        const { data: team } = await axios.get(`/teams/${teamOld.id}`);
        const { data: video } = await axios.get(`/videos/${question.videoId}`);
        console.log(JSON.stringify(video));
        let now = new Date();
        console.log(`[${now}]: training stage for "${team.name}" started`);

        qb.send("room_" + room.rpi, "setmode idle");
        qb.send("room_" + room.rpi, "setmode playing");
        qb.send("terminal_" + room.rpi, {
            team,
            time: times["TRAINING_ROOM"],
            // questionId: question.id,
            videoPath: video.path,
            texts: {
                task: texts[team.languageId].tasks[room.id],
                target: texts[team.languageId]["TARGET_LABEL"],
                result: texts[team.languageId]["SCORE_LABEL"]
            },
            points: room.points,
        });

        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "play siren.mef");
        }, (times["TRAINING_ROOM"] - 30 ) * ms));
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "play countdown.mef");
        }, (times["TRAINING_ROOM"] - 10 ) * ms));
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "setmode win");
        }, times["TRAINING_ROOM"] * ms));
    }
    catch (e) {
        console.log(e);
    }
}

async function arenaStage(teamOld, room, question, prevRoomName) {
    try {
        const { data: team } = await axios.get(`/teams/${teamOld.id}`);
        let now = new Date();
        if (activeTeams[team.id].bonus[prevRoomName]) {
            console.log(`[${now}]: arena stage for "${team.name}" started`);
            qb.send("terminal_" + room.rpi, {
                question,
                time: times["ARENA"],
                team,
                points: room.points,
            });
            activeTeams[team.id].questions.shift();
        }
        else {
            console.log(`[${now}]: arena stage for "${team.name}" didn't start`);
        }
        qb.send("room_" + room.rpi, "play back.mef");
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "play siren.mef");
        }, (times["ARENA"] - 5 ) * ms));
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "setmode idle");
        }, times["ARENA"] * ms));
    }
    catch (e) {
        console.log(e);
    }
}

async function genericStage(teamOld, room, question) {
    try {
        const { data: team } = await axios.get(`/teams/${teamOld.id}`);
        const { data: video } = await axios.get(`/videos/${question.videoId}`);
        console.log(JSON.stringify(video));
        let now = new Date();
        console.log(`[${now}]: ${room.name.toLowerCase()} stage for "${team.name}" started`);

        qb.send("room_" + room.rpi, "setmode idle");
        qb.send("room_" + room.rpi, `set pwm.players.state ${team.members}`);
        qb.send("room_" + room.rpi, "setmode playing");
        qb.send("terminal_" + room.rpi, {
            team,
            time: times["GENERIC_ROOM"],
            // questionId: question.id,
            videoPath: video.path,
            texts: {
                task: texts[team.languageId].tasks[room.id],
                target: texts[team.languageId]["TARGET_LABEL"],
                result: texts[team.languageId]["SCORE_LABEL"]
            },
            points: room.points,
        });

        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "play siren.mef");
        }, (times["GENERIC_ROOM"] - 30 ) * ms));
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "play countdown.mef");
        }, (times["GENERIC_ROOM"] - 10 ) * ms));
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "setmode win");
        }, times["GENERIC_ROOM"] * ms));
    }
    catch (e) {
        console.log(e);
    }
}

async function bonusStage(teamOld, room = rooms[rooms.length - 1]) {
    try {
        const { data: team } = await axios.get(`/teams/${teamOld.id}`);
        let now = new Date();
        console.log(`[${now}]: bonus stage for "${team.name}" started`);

        qb.send("room_" + room.rpi, "setmode idle");
        qb.send("room_" + room.rpi, "setmode playing");
        qb.send("terminal_" + room.rpi, {
            team,
            time: times["GENERIC_ROOM"],
            texts: {
                task: texts[team.languageId].tasks[room.id],
                target: texts[team.languageId]["TARGET_LABEL"],
                result: texts[team.languageId]["SCORE_LABEL"]
            },
            points: room.points,
        });

        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "play siren.mef");
        }, (times["GENERIC_ROOM"] - 30 ) * ms));
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "play countdown.mef");
        }, (times["GENERIC_ROOM"] - 10 ) * ms));
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "setmode win");
        }, times["GENERIC_ROOM"] * ms));
    }
    catch (e) {
        console.log(e);
    }
}

async function finishStage(team) {
    try {
        let now = new Date();
        console.log(`[${now}]: finishing game for "${team.name}"`);
        await axios.put('/teams/' + team.id, { finished: true });
        delete activeTeams[team.id];
    }
    catch (e) {
        console.log(e);
    }
}

async function stopGame(id) {
    try {
        let { data: team } = await axios.get(`/teams/${id}`);
        if (activeTeams.hasOwnProperty(id)) {
            for (let timer of activeTeams[id].timers) {
                clearTimeout(timer);
            }
            await axios.put('/teams/' + id, { timeofBegin: null, timeofEnd: null });
            delete activeTeams[id];
            for (let i = 0; i < schedule.length; i++) {
                if (schedule[i].id === id) {
                    delete schedule[i].id;
                    break;
                }
            }
            console.log(`stop game for "${team.name}"`);
        } else {
            console.log(`game for "${team.name}" didn't start yet`);
        }
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
