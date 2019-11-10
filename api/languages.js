
function apiLanguagesGet(app, req, res) {
	try {
		
	}
	catch(error) {
		return res.status(400).json({error: 'get /api/languages: ' + error});
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

