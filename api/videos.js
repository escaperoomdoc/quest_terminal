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
		var targetPath = './assets/' + req.params.id + '.mp4';
		fs.unlink(targetPath, (error) => {
			console.log("error on delete: " + targetPath);
		});
		await app.db.videos.destroy({where: {id: req.params.id}});
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'delete /api/videos: ' + error});
	}
}

/*
var fluent_ffmpeg = require("fluent-ffmpeg");
var mergedVideo = fluent_ffmpeg();
function concatVideos(input, output) {
	return new Promise((resolve, reject) => {
		mergedVideo
		.mergeAdd(input[0])
		.mergeAdd(input[1])
		.on('error', function(error) {
			reject(error.message);
		})
		.on('end', function() {
			resolve();
		})
		.mergeToFile(output);
	})
}
*/

var videoStitch = require('video-stitch');
var videoConcat = videoStitch.concat;

function concatVideos(input, target) {
	return new Promise((resolve, reject) => {
		videoConcat({
			silent: true, // optional. if set to false, gives detailed output on console
			overwrite: false // optional. by default, if file already exists, ffmpeg will ask for overwriting in console and that pause the process. if set to true, it will force overwriting. if set to false it will prevent overwriting.
		})
		.clips([
			{
				"fileName": input[0]
			},
			{
				"fileName": input[1]
			}
		])
		.output(target)
		.concat()
		.then((fname) => {
			resolve(fname);
		})
		.catch((error) => {
			reject(error);
		});
	})
}

async function apiVideosPost(app, req, res) {
	var resultFile = null;
	try {
		req.body.id = req.body.id ? req.body.id : uuid.v4();
		var ext = path.extname(req.files.video.path);
		var targetPath = './public/assets/' + req.body.id + ext;
		resultFile = await concatVideos(['./public/countdown.mp4', req.files.video.path], targetPath);
		result = await app.db.videos.create({id: req.body.id, name: req.body.name});
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

