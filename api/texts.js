const uuid = require("uuid");

async function apiTextsGet(app, req, res) {
	try {
		result = await app.db.texts.findAll({ where: req.query, raw: true });
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'get /api/texts: ' + error});
	}
}

async function apiTextsPut(app, req, res) {
	try {
		if (req.body.id && req.body.id !== req.params.id) throw 'wrong body id';
		var affectedCount = await app.db.texts.update(req.body, {where: {id: req.params.id}});
		if (!affectedCount[0]) throw 'object not found';
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'put /api/texts: ' + error});
	}
}

async function apiTextsDelete(app, req, res) {
	try {
		await app.db.texts.destroy({where: {id: req.params.id}});
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'delete /api/texts: ' + error});
	}
}

async function apiTextsPost(app, req, res) {
	try {
		req.body.id = req.body.id ? req.body.id : uuid.v4();
		result = await app.db.texts.create(req.body);
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'post /api/texts: ' + error});
	}
}

module.exports = (app) => {
	app.get( "/api/texts", (req, res) => {
		apiTextsGet(app, req, res);
	});
	app.put( "/api/texts/:id", (req, res) => {
		apiTextsPut(app, req, res);
	});
	app.delete( "/api/texts/:id", (req, res) => {
		apiTextsDelete(app, req, res);
	});
	app.post( "/api/texts", (req, res) => {
		apiTextsPost(app, req, res);
	});
}

