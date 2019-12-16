const uuid = require("uuid");

async function apiTimesGet(app, req, res) {
	try {
		result = await app.db.times.findAll({raw: true});
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'get /api/times: ' + error});
	}
}

async function apiTimesPut(app, req, res) {
	try {
		if (req.body.id && req.body.id !== req.params.id) throw 'wrong body id';
		var affectedCount = await app.db.times.update(req.body, {where: {id: req.params.id}});
		if (!affectedCount[0]) throw 'object not found';
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'put /api/times: ' + error});
	}
}

async function apiTimesDelete(app, req, res) {
	try {
		await app.db.times.destroy({where: {id: req.params.id}});
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'delete /api/times: ' + error});
	}
}

async function apiTimesPost(app, req, res) {
	try {
		req.body.id = req.body.id ? req.body.id : uuid.v4();
		result = await app.db.times.create(req.body);
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'post /api/times: ' + error});
	}
}

module.exports = (app) => {
	app.get( "/api/times", (req, res) => {
		apiTimesGet(app, req, res);
	});
	app.put( "/api/times/:id", (req, res) => {
		apiTimesPut(app, req, res);
	});
	app.delete( "/api/times/:id", (req, res) => {
		apiTimesDelete(app, req, res);
	});
	app.post( "/api/times", (req, res) => {
		apiTimesPost(app, req, res);
	});
}
