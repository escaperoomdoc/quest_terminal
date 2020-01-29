const uuid = require("uuid");

async function apiTeamsGet(app, req, res) {
	try {
		result = await app.db.teams.findAll({raw: true});
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'get /api/teams: ' + error});
	}
}

async function apiActiveTeamsGet(app, req, res) {
	try {
		result = await app.db.teams.findAll({ where: { finished: false }, raw: true });
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'get /api/teams: ' + error});
	}
}

async function apiTeamGet(app, req, res) {
	try {
		result = await app.db.teams.findOne({where: {id: req.params.id}, raw: true });
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'get /api/teams: ' + error});
	}
}

async function apiTeamsPut(app, req, res) {
	try {
		if (req.body.id && req.body.id !== req.params.id) throw 'wrong body id';
		var affectedCount = await app.db.teams.update(req.body, {where: {id: req.params.id}});
		if (!affectedCount[0]) throw 'object not found';
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'put /api/teams: ' + error});
	}
}

async function apiTeamsDelete(app, req, res) {
	try {
		await app.db.teams.destroy({where: {id: req.params.id}});
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'delete /api/teams: ' + error});
	}
}

async function apiTeamsPost(app, req, res) {
	try {
		req.body.id = req.body.id ? req.body.id : uuid.v4();
		result = await app.db.teams.create(req.body);
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'post /api/teams: ' + error});
	}
}

module.exports = (app) => {
	app.get( "/api/teams", (req, res) => {
		apiTeamsGet(app, req, res);
	});
	app.get( "/api/teams/active", (req, res) => {
		apiActiveTeamsGet(app, req, res);
	});
	app.get( "/api/teams/:id", (req, res) => {
		apiTeamGet(app, req, res);
	});
	app.put( "/api/teams/:id", (req, res) => {
		apiTeamsPut(app, req, res);
	});
	app.delete( "/api/teams/:id", (req, res) => {
		apiTeamsDelete(app, req, res);
	});
	app.post( "/api/teams", (req, res) => {
		apiTeamsPost(app, req, res);
	});
}
