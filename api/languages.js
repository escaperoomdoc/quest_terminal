const uuid = require("uuid");

async function apiLanguagesGet(app, req, res) {
	try {
		result = await app.db.languages.findAll({raw: true});
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'get /api/languages: ' + error});
	}
}

async function apiLanguagesPut(app, req, res) {
	try {
		if (req.body.id && req.body.id !== req.params.id) throw 'wrong body id';
		var affectedCount = await app.db.languages.update(req.body, {where: {id: req.params.id}});
		if (!affectedCount[0]) throw 'object not found';
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'put /api/languages: ' + error});
	}
}

async function apiLanguagesDelete(app, req, res) {
	try {
		await app.db.languages.destroy({where: {id: req.params.id}});
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'delete /api/languages: ' + error});
	}
}

async function apiLanguagesPost(app, req, res) {
	try {
		req.body.id = req.body.id ? req.body.id : uuid.v4();
		result = await app.db.languages.create(req.body);
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'post /api/languages: ' + error});
	}
}

module.exports = (app) => {
	app.get( "/api/languages", (req, res) => {
		apiLanguagesGet(app, req, res);
	});
	app.put( "/api/languages/:id", (req, res) => {
		apiLanguagesPut(app, req, res);
	});
	app.delete( "/api/languages/:id", (req, res) => {
		apiLanguagesDelete(app, req, res);
	});
	app.post( "/api/languages", (req, res) => {
		apiLanguagesPost(app, req, res);
	});
}

