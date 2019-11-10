const uuid = require("uuid");

async function apiVideosGet(app, req, res) {
	try {
		result = await app.db.videos.findAll({raw: true});
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
		await app.db.videos.destroy({where: {id: req.params.id}});
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'delete /api/videos: ' + error});
	}
}

async function apiVideosPost(app, req, res) {
	try {
		req.body.id = req.body.id ? req.body.id : uuid.v4();
		result = await app.db.videos.create(req.body);
		res.status(200).json(result);
	}
	catch(error) {
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
	app.post( "/api/videos", (req, res) => {
		apiVideosPost(app, req, res);
	});
}

