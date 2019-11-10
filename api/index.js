
module.exports = (app) => {
	require('./categories')(app);
	require('./languages')(app);
//	require('./questions')(app);
	require('./rooms')(app);
	require('./texts')(app);
	require('./videos')(app);
};

