const uuid = require("uuid");
var multipart = require('connect-multiparty');
var multipartMiddleware = multipart();
const path = require('path');
const fs = require('fs');

function prepareDir(dir) {
   if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}
}
prepareDir('./public/assets');

async function apiVideosGet(app, req, res) {
	try {
		result = await app.db.videos.findAll({raw: true});
		for (item of result) {
			item.path = '/assets/' + item.id + '.mp4';
		}
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'get /api/videos: ' + error});
	}
}

async function apiVideosPut(app, req, res) {
	try {
		if (req.body.id && req.body.id !== req.params.id) throw 'wrong body id';
		var affectedCount = await app.db.videos.update(req.body, {where: {id: req.params.id}});
		if (!affectedCount[0]) throw 'object not found';
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'put /api/videos: ' + error});
	}
}

async function apiVideosDelete(app, req, res) {
	try {
		var targetPath = './public/assets/' + req.params.id + '.mp4';
		fs.unlink(targetPath, (error) => {
			if (error) console.log("error on delete: " + targetPath);
		});
		await app.db.videos.destroy({where: {id: req.params.id}});
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'delete /api/videos: ' + error});
	}
}

// this code is taken from the 'video-stitch' project. Anyway, to use concat videos in ubuntu
// we should install ffmpeg on win32 or linux (sudo apt-get install ffmpeg) and tmp + shelljs libs:
let tmp = require('tmp');
let shelljs = require('shelljs');

function concatVideos(input, output) {
	return new Promise((resolve, reject) => {
		var fileList = tmp.tmpNameSync({postfix: '.txt'});
		fileListText = `file '${input[0]}'\nfile '${input[1]}'\n`
		fs.writeFileSync(fileList, fileListText, 'utf8');
		var child = shelljs.exec(`ffmpeg -f concat -safe 0 -i ${fileList} -c copy ${output} -y`, { async: true, silent: true });
		child.on('exit', (code, signal) => {
			if (code === 0) {
				resolve(output);
			} else {
				reject();
			}
		});
	})
}

async function apiVideosPost(app, req, res) {
	var resultFile = null;
	try {
		req.body.id = req.body.id ? req.body.id : uuid.v4();
		var ext = path.extname(req.files.video.path);
		var targetPath = app.appRoot + '/public/assets/' + req.body.id + ext;
		resultFile = await concatVideos([app.appRoot + '/public/countdown.mp4', req.files.video.path], targetPath);
		result = await app.db.videos.create({id: req.body.id, name: req.body.name});
		result = result.toJSON();
		result.path = '/assets/' + req.body.id + '.mp4';
		res.status(200).json(result);
	}
	catch(error) {
		if (resultFile) fs.unlink(resultFile, (error) => {});
		return res.status(400).json({error: 'post /api/videos: ' + error});
	}
}

module.exports = (app) => {
	app.get( "/api/videos", (req, res) => {
		apiVideosGet(app, req, res);
	});
	app.put( "/api/videos/:id", (req, res) => {
		apiVideosPut(app, req, res);
	});
	app.delete( "/api/videos/:id", (req, res) => {
		apiVideosDelete(app, req, res);
	});
	app.post( "/api/videos", multipartMiddleware, (req, res) => {
		apiVideosPost(app, req, res);
	});
}

