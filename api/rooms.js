const uuid = require("uuid");

async function apiRoomsGet(app, req, res) {
	try {
		result = await app.db.rooms.findAll({raw: true});
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'get /api/rooms: ' + error});
	}
}

async function apiRoomsPut(app, req, res) {
	try {
		if (req.body.id && req.body.id !== req.params.id) throw 'wrong body id';
		var affectedCount = await app.db.rooms.update(req.body, {where: {id: req.params.id}});
		if (!affectedCount[0]) throw 'object not found';
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'put /api/rooms: ' + error});
	}
}

async function apiRoomsDelete(app, req, res) {
	try {
		await app.db.rooms.destroy({where: {id: req.params.id}});
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'delete /api/rooms: ' + error});
	}
}

async function apiRoomsPost(app, req, res) {
	try {
      req.body.id = req.body.id ? req.body.id : uuid.v4();
		result = await app.db.rooms.create(req.body);
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'post /api/rooms: ' + error});
	}
}

module.exports = (app) => {
	app.get( "/api/rooms", (req, res) => {
		apiRoomsGet(app, req, res);
	});
	app.put( "/api/rooms/:id", (req, res) => {
		apiRoomsPut(app, req, res);
	});
	app.delete( "/api/rooms/:id", (req, res) => {
		apiRoomsDelete(app, req, res);
	});
	app.post( "/api/rooms", (req, res) => {
		apiRoomsPost(app, req, res);
	});
}

