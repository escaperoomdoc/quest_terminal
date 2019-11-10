const uuid = require("uuid");

async function apiCategoriesGet(app, req, res) {
	try {
		result = await app.db.categories.findAll({raw: true});
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'get /api/categories: ' + error});
	}
}

async function apiCategoriesPut(app, req, res) {
	try {
		await app.db.categories.update(req.body, {where: {id: req.params.id}});
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'put /api/categories: ' + error});
	}
}

async function apiCategoriesDelete(app, req, res) {
	try {
		await app.db.categories.destroy({where: {id: req.params.id}});
		res.status(200).json({});
	}
	catch(error) {
		return res.status(400).json({error: 'delete /api/categories: ' + error});
	}
}

async function apiCategoriesPost(app, req, res) {
	try {
		result = await app.db.categories.create({
			id: uuid.v4(),
			name: req.body.name
		});
		res.status(200).json(result);
	}
	catch(error) {
		return res.status(400).json({error: 'delete /api/categories: ' + error});
	}
}

module.exports = (app) => {
	app.get( "/api/categories", (req, res) => {
		apiCategoriesGet(app, req, res);
	});
	app.put( "/api/categories/:id", (req, res) => {
		apiCategoriesPut(app, req, res);
	});
	app.delete( "/api/categories/:id", (req, res) => {
		apiCategoriesDelete(app, req, res);
	});
	app.post( "/api/categories", (req, res) => {
		apiCategoriesPost(app, req, res);
	});
}

