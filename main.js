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
let times, schedule, rooms, teamLocation, activeTeams = {}, texts;
const ms = 1000;

db(app)
    .then(() =>{
        getTimes().then((response) => {
            times = response;
            schedule = getSchedule(true);
        });
        getRooms().then((response) => {
            rooms = response;
            teamLocation = rooms.map(item => {
                return {
                    room: item.name,
                    team: null,
                    timeOfEnd: null
                }
            })
        });
        checkTeams();
        getTexts().then((response) => {
            texts = response;
        })
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

let shelljs = require('shelljs');
qb.on('receive', function(data) {
    console.log('[Queen Bridge]: ' + JSON.stringify(data));
    let command = data.payload.command;
        switch(command) {
            case 'start':
                startGame(data.payload.id);
                break;
            case 'stop':
                stopGame(data.payload.id);
                break;
            case 'bonus':
                let id = data.payload.id;
                let room = data.payload.room;
                let state = data.payload.state;
                activeTeams[id].bonus[room] = state;
                break;
            case 'reboot':
                shelljs.exec('reboot.bat', { async: true, silent: true });
                break;
            case 'shutdown':
                shelljs.exec('shutdown.bat', { async: true, silent: true });
                break;

        }
});

// setTimeout(() => {
//     qb.topic("/terminal/time");
//     qb.topic("/terminal/location");
// }, 500);
setInterval(() => {
    qb.publish("terminal/time", {
        type: "time",
        time: Date.now(),
    });
}, 1000);
setInterval(() => {
    qb.publish("terminal/location", {
        type: "location",
        locations: teamLocation
    });
}, 5000);

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

function getSchedule(first = false) {
    let interval = times["TEAMS_INTERVAL"];

    let start = new Date();
    start.setHours(6, 0, 0, 0);
    // console.log(start);

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

    if (first) {
        let midnight = new Date();
        midnight.setHours(0, 0, 0, 0);
        midnight.setSeconds(midnight.getSeconds() + interval);
        while (schedule[0].time > midnight) {
            let newTime =  new Date(schedule[0].time);
            newTime.setSeconds(newTime.getSeconds() - interval);
            schedule.unshift({time: newTime});
            // console.log(schedule[0].time.toString());
        }
    }
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
            bonus: {},
            ...team,
            room: null
        };
        activeTeams[id].questions = await getQuestions(team.languageId, team.categoryId);

        //launch countdown
        activeTeams[id].timers.push(
            setTimeout(countdownStage,
                timeofBegin - Date.now() - times["COUNTDOWN"] * ms, team.id)
        );
        //launch demo room
        activeTeams[id].timers.push(
            setTimeout(genericStage,
                timeofBegin - Date.now(), team.id, rooms[1], times["DEMO_ROOM"]),
        );
        let delta = times["DEMO_ROOM"] * ms;
        //launch training room
        activeTeams[id].timers.push(
            setTimeout(genericStage,
                timeofBegin - Date.now() + delta, team.id, rooms[2], times["TRAINING_ROOM"])
        );
        delta += times["TRAINING_ROOM"] * ms;
        //launch arena stage
        activeTeams[id].timers.push(
            setTimeout(arenaStage,
                timeofBegin - Date.now() + delta, team.id, rooms[0], rooms[2].rpi)
        );
        delta += times["ARENA"] * ms;
        //launch generic rooms
        for (let i = 3; i < rooms.length - 1; i++) {
            activeTeams[id].timers.push(
                setTimeout(genericStage,
                    timeofBegin - Date.now() + delta, team.id, rooms[i], times["GENERIC_ROOM"])
            );
            delta += times["GENERIC_ROOM"] * ms;
            activeTeams[id].timers.push(
                setTimeout(arenaStage,
                    timeofBegin - Date.now() + delta, team.id, rooms[0], rooms[i].rpi)
            );
            delta += times["ARENA"] * ms;
        }
        //launch bonus room
        activeTeams[id].timers.push(
            setTimeout(genericStage,
                timeofBegin - Date.now() + delta, team.id, rooms[rooms.length - 1], times["GENERIC_ROOM"])
        );
        delta += times["GENERIC_ROOM"] * ms;
        //launch finish stage
        activeTeams[id].timers.push(
            setTimeout(finishStage,
                timeofBegin - Date.now() + delta, team.id, rooms[0])
        );

        let timeofEnd = new Date(timeofBegin);
        timeofEnd.setMilliseconds(timeofEnd.getMilliseconds() + delta);
        await axios.put('/teams/' + id, { timeofEnd });
    }
    catch (e) {
        console.log(e);
    }
}

async function countdownStage(id) {
    try {
        const { data: team } = await axios.get(`/teams/${id}`);
        let now = new Date();
        // qb.send("terminal_countdown", {
        //     team,
        //     time: times["COUNTDOWN"]
        // });
        qb.publish("terminal/countdown", {
            team,
            time: times["COUNTDOWN"]
        });
        console.log(`[${now}]: countdown stage for "${team.name}" started`);
    }
    catch (e) {
        console.log(e);
    }
}

async function arenaStage(id, room, prevRoomName) {
    try {
        const { data: team } = await axios.get(`/teams/${id}`);
        let now = new Date();
        if (activeTeams[team.id].bonus[prevRoomName] && activeTeams[id].questions.length) {
            let question = activeTeams[id].questions[0];
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

        teamLocation[0].team = team.name;
        let timeOfEnd = new Date(now);
        timeOfEnd.setSeconds(timeOfEnd.getSeconds() + times["ARENA"]);
        teamLocation[0].timeOfEnd = timeOfEnd;

        qb.send("room_" + room.rpi, "play back.mef");
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "play siren.mef");
        }, (times["ARENA"] - 5 ) * ms));
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "setmode idle");
            teamLocation[0].team = null;
            teamLocation[0].timeOfEnd = null;
        }, times["ARENA"] * ms));
    }
    catch (e) {
        console.log(e);
    }
}

async function genericStage(id, room, time) {
    try {
        const { data: team } = await axios.get(`/teams/${id}`);
        if (activeTeams[id].categoryId !== team.categoryId || activeTeams[id].languageId !== team.languageId) {
            activeTeams[id].questions.splice(0, activeTeams[id].questions.length);
            activeTeams[id].questions = await getQuestions(team.languageId, team.categoryId);
        }
        let question = activeTeams[id].questions.length ? activeTeams[id].questions[0] : null;
        const { data: video } = await axios.get(`/videos/${question.videoId}`);
        if (room.rpi === 'demo' && activeTeams[id].questions.length) activeTeams[team.id].questions.shift();

        let now = new Date();
        console.log(`[${now}]: ${room.name.toLowerCase()} stage for "${team.name}" started`);

        qb.send("room_" + room.rpi, "setmode idle");
        qb.send("room_" + room.rpi, `set pwm.players.state ${team.members}`);
        qb.send("room_" + room.rpi, "setmode playing");
        qb.send("terminal_" + room.rpi, {
            team,
            time,
            videoPath: video.path,
            texts: {
                task: texts[team.languageId].tasks[room.id],
                target: texts[team.languageId]["TARGET_LABEL"],
                result: texts[team.languageId]["SCORE_LABEL"]
            },
            points: room.points,
        });

        let index = teamLocation.findIndex((item => item.room === room.name));
        if (index !== -1) {
            teamLocation[index].team = team.name;
            let timeOfEnd = new Date(now);
            timeOfEnd.setSeconds(timeOfEnd.getSeconds() + time);
            teamLocation[index].timeOfEnd = timeOfEnd;
        }

        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "play siren.mef");
        }, (time - 30 ) * ms));
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "play countdown.mef");
        }, (time - 10 ) * ms));
        activeTeams[team.id].timers.push(setTimeout(() => {
            qb.send("room_" + room.rpi, "setmode win");
            teamLocation[index].team = null;
            teamLocation[index].timeOfEnd = null;
        }, time * ms));
    }
    catch (e) {
        console.log(e);
    }
}

async function finishStage(id, room) {
    try {
        const { data: team } = await axios.get(`/teams/${id}`);
        let now = new Date();
        console.log(`[${now}]: finishing game for "${team.name}"`);
        await axios.put('/teams/' + team.id, { finished: true });
        delete activeTeams[team.id];

        qb.send("room_" + room.rpi, "play debriefing.mef");
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
        let index = teamLocation.findIndex((item => item.team === team.name));
        if (index !== -1) {
            teamLocation[index].team = null;
            teamLocation[index].timeOfEnd = null;
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
    schedule = getSchedule();
    return scheduleTeam(id);
}

// async function trainingStage(id, room, time) {
//     try {
//         const { data: team } = await axios.get(`/teams/${id}`);
//         if (activeTeams[id].categoryId !== team.categoryId || activeTeams[id].languageId !== team.languageId) {
//             activeTeams[id].questions.splice(0, activeTeams[id].questions.length);
//             activeTeams[id].questions = await getQuestions(team.languageId, team.categoryId);
//         }
//         let question = activeTeams[id].questions.length ? activeTeams[id].questions[0] : null;
//         const { data: video } = await axios.get(`/videos/${question.videoId}`);
//
//         let now = new Date();
//         console.log(`[${now}]: ${room.name.toLowerCase()} stage for "${team.name}" started`);
//
//         qb.send("room_" + room.rpi, "setmode idle");
//         qb.send("room_" + room.rpi, "setmode playing");
//         qb.send("terminal_" + room.rpi, {
//             team,
//             time,
//             videoPath: video.path,
//             texts: {
//                 task: texts[team.languageId].tasks[room.id],
//                 target: texts[team.languageId]["TARGET_LABEL"],
//                 result: texts[team.languageId]["SCORE_LABEL"]
//             },
//             points: room.points,
//         });
//
//         let index = teamLocation.findIndex((item => item.room === room.name));
//         if (index !== -1) {
//             teamLocation[index].team = team.name;
//             let timeOfEnd = new Date(now);
//             timeOfEnd.setSeconds(timeOfEnd.getSeconds() + time);
//             teamLocation[index].timeOfEnd = timeOfEnd;
//         }
//
//         activeTeams[team.id].timers.push(setTimeout(() => {
//             qb.send("room_" + room.rpi, "play siren.mef");
//         }, (time - 30 ) * ms));
//         activeTeams[team.id].timers.push(setTimeout(() => {
//             qb.send("room_" + room.rpi, "play countdown.mef");
//         }, (time - 10 ) * ms));
//         activeTeams[team.id].timers.push(setTimeout(() => {
//             qb.send("room_" + room.rpi, "setmode win");
//             teamLocation[index].team = null;
//             teamLocation[index].timeOfEnd = null;
//         }, time * ms));
//     }
//     catch (e) {
//         console.log(e);
//     }
// }

// async function bonusStage(id, room = rooms[rooms.length - 1]) {
//     try {
//         const { data: team } = await axios.get(`/teams/${id}`);
//         let now = new Date();
//         console.log(`[${now}]: bonus stage for "${team.name}" started`);
//
//         qb.send("room_" + room.rpi, "setmode idle");
//         qb.send("room_" + room.rpi, "setmode playing");
//         qb.send("terminal_" + room.rpi, {
//             team,
//             time: times["GENERIC_ROOM"],
//             texts: {
//                 task: texts[team.languageId].tasks[room.id],
//                 target: texts[team.languageId]["TARGET_LABEL"],
//                 result: texts[team.languageId]["SCORE_LABEL"]
//             },
//             points: room.points,
//         });
//
//         let index = teamLocation.findIndex((item => item.room === room.name));
//         if (index !== -1) {
//             teamLocation[index].team = team.name;
//             let timeOfEnd = new Date(now);
//             timeOfEnd.setSeconds(timeOfEnd.getSeconds() + times["TRAINING_ROOM"]);
//             teamLocation[index].timeOfEnd = timeOfEnd;
//         }
//
//         activeTeams[team.id].timers.push(setTimeout(() => {
//             qb.send("room_" + room.rpi, "play siren.mef");
//         }, (times["GENERIC_ROOM"] - 30 ) * ms));
//         activeTeams[team.id].timers.push(setTimeout(() => {
//             qb.send("room_" + room.rpi, "play countdown.mef");
//         }, (times["GENERIC_ROOM"] - 10 ) * ms));
//         activeTeams[team.id].timers.push(setTimeout(() => {
//             qb.send("room_" + room.rpi, "setmode win");
//             teamLocation[index].team = null;
//             teamLocation[index].timeOfEnd = null;
//         }, times["GENERIC_ROOM"] * ms));
//     }
//     catch (e) {
//         console.log(e);
//     }
// }

// async function demoStage(id, room) {
//     try {
//         const { data: team } = await axios.get(`/teams/${id}`);
//         if (activeTeams[id].categoryId !== team.categoryId || activeTeams[id].languageId !== team.languageId) {
//             activeTeams[id].questions.splice(0, activeTeams[id].questions.length);
//             activeTeams[id].questions = await getQuestions(team.languageId, team.categoryId);
//         }
//         let question = activeTeams[id].questions.length ? activeTeams[id].questions[0] : null;
//         const { data: video } = await axios.get(`/videos/${question.videoId}`);
//         if (activeTeams[id].questions.length) activeTeams[team.id].questions.shift();
//
//         let now = new Date();
//         console.log(`[${now}]: demo stage for "${team.name}" started`);
//
//         qb.send("room_" + room.rpi, "setmode idle");
//         qb.send("room_" + room.rpi, "setmode playing");
//         qb.send("terminal_" + room.rpi, {
//             team,
//             time: times["DEMO_ROOM"],
//             videoPath: video.path,
//             texts: {
//                 task: texts[team.languageId].tasks[room.id],
//                 target: texts[team.languageId]["TARGET_LABEL"],
//                 result: texts[team.languageId]["SCORE_LABEL"]
//             },
//             points: room.points,
//         });
//
//         let index = teamLocation.findIndex((item => item.room === room.name));
//         if (index !== -1) {
//             teamLocation[index].team = team.name;
//             let timeOfEnd = new Date(now);
//             timeOfEnd.setSeconds(timeOfEnd.getSeconds() + times["DEMO_ROOM"]);
//             teamLocation[index].timeOfEnd = timeOfEnd;
//         }
//
//         activeTeams[team.id].timers.push(setTimeout(() => {
//             qb.send("room_" + room.rpi, "play siren.mef");
//         }, (times["DEMO_ROOM"] - 30 ) * ms));
//         activeTeams[team.id].timers.push(setTimeout(() => {
//             qb.send("room_" + room.rpi, "play countdown.mef");
//         }, (times["DEMO_ROOM"] - 10 ) * ms));
//         activeTeams[team.id].timers.push(setTimeout(() => {
//             qb.send("room_" + room.rpi, "setmode win");
//             teamLocation[index].team = null;
//             teamLocation[index].timeOfEnd = null;
//         }, times["DEMO_ROOM"] * ms));
//
//     }
//     catch (e) {
//         console.log(e);
//     }
// }
