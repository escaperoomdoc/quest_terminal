const uuid = require("uuid");

async function apiQuestionsGet(app, req, res) {
	try {
		result = await app.db.questions.findAll({ where: req.query, raw: true });
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'get /api/questions: ' + error});
	}
}

async function apiQuestionsPut(app, req, res) {
	try {
		if (req.body.id && req.body.id !== req.params.id) throw 'wrong body id';
		var affectedCount = await app.db.questions.update(req.body, {where: {id: req.params.id}});
		if (!affectedCount[0]) throw 'object not found';
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'put /api/questions: ' + error});
	}
}

async function apiQuestionsDelete(app, req, res) {
	try {
		await app.db.questions.destroy({where: {id: req.params.id}});
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'delete /api/questions: ' + error});
	}
}

async function apiQuestionsPost(app, req, res) {
	try {
		req.body.id = req.body.id ? req.body.id : uuid.v4();
		result = await app.db.questions.create(req.body);
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'post /api/questions: ' + error});
	}
}

module.exports = (app) => {
	app.get( "/api/questions", (req, res) => {
		apiQuestionsGet(app, req, res);
	});
	app.put( "/api/questions/:id", (req, res) => {
		apiQuestionsPut(app, req, res);
	});
	app.delete( "/api/questions/:id", (req, res) => {
		apiQuestionsDelete(app, req, res);
	});
	app.post( "/api/questions", (req, res) => {
		apiQuestionsPost(app, req, res);
	});
}
