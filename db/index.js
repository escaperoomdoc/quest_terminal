// init sequelize
const Sequelize = require('sequelize');

function defineCategories(sequelize) {
	const Categories = sequelize.define("categories",
	{
		id: {
			type: Sequelize.UUID,
			primaryKey: true
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
		}
	});
	return Categories;
}

function defineLanguages(sequelize) {
	const Languages = sequelize.define("languages",
	{
		id: {
			type: Sequelize.UUID,
			primaryKey: true
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
			unique: true
		}
	});
	return Languages;
}

function defineRooms(sequelize) {
	const Rooms = sequelize.define("rooms",
	{
		id: {
			type: Sequelize.UUID,
			primaryKey: true
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
			unique: true
		},
		rpi: {
			type: Sequelize.STRING
		},
		order: {
			type: Sequelize.INTEGER
		}
	});
	return Rooms;
}

function defineTexts(sequelize) {
	const Texts = sequelize.define("texts",
	{
		id: {
			type: Sequelize.UUID,
			primaryKey: true
		},
		languageId: {
			type: Sequelize.UUID,
			allowNull: false,
		},
		name: {
			type: Sequelize.STRING
		},		
		text: {
			type: Sequelize.STRING
		}
	});
	return Texts;
}

function defineQuestions(sequelize) {
	const Questions = sequelize.define("questions",
	{
		id: {
			type: Sequelize.UUID,
			primaryKey: true
		},
		categoryId: {
			type: Sequelize.UUID,
			allowNull: false,
		},
		languageId: {
			type: Sequelize.UUID,
			allowNull: false,
		},
		videoId: {
			type: Sequelize.UUID,
			allowNull: false,
		},		
		text: {
			type: Sequelize.STRING
		},		
		variants: {
			type: Sequelize.STRING
		},		
		answer: {
			type: Sequelize.STRING
		}
	});
	return Questions;
}

function defineVideos(sequelize) {
	const Videos = sequelize.define("videos",
	{
		id: {
			type: Sequelize.UUID,
			primaryKey: true
		},
		name: {
			type: Sequelize.STRING,
			allowNull: false,
			unique: true
		}
	});
	return Videos;
}

module.exports = async (app) => {
	try {
		app.db = {};
		var sequelize = new Sequelize(app.config.db);
		await sequelize.authenticate();
		console.log('sequelize: database connected...');
		app.db.static = require('./static');
		app.db.categories = defineCategories(sequelize);
		app.db.languages = defineLanguages(sequelize);
		app.db.questions = defineQuestions(sequelize);
		app.db.rooms = defineRooms(sequelize);
		app.db.texts = defineTexts(sequelize);
		app.db.videos = defineVideos(sequelize);
		app.db.texts.belongsTo(app.db.languages, {foreignKey: 'languageId'});
		app.db.questions.belongsTo(app.db.categories, {foreignKey: 'categoryId'});
		app.db.questions.belongsTo(app.db.languages, {foreignKey: 'languageId'});
		app.db.questions.belongsTo(app.db.videos, {foreignKey: 'videoId'});
		// ... other tables
		await sequelize.sync();
		console.log('sequelize: sync succeded');
		app.db.sequelize = sequelize;
	}
	catch(error) {
		console.log('database init error: ' + error);
	}
}

