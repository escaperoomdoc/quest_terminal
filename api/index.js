
module.exports = (app) => {
	require('./categories')(app);
	require('./languages')(app);
	require('./questions')(app);
	require('./rooms')(app);
	require('./texts')(app);
	require('./videos')(app);
	app.get('/api/glossary', (req, res, next) => {
		res.status(200).json(app.db.static);
	});
	app.get('/api/*', (req, res, next) => {
		return res.status(400).json({error: 'not implemented'});
	});		
	app.get('*', (req, res, next) => {
		return res.sendFile(app.appRoot + "/public/index.html");
	});	
};
