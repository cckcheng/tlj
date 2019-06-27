var sqlite3 = require('sqlite3').verbose();
var Config = require('./conf');

var db = new sqlite3.Database(Config.MAIN_DB);
var country_db = new sqlite3.Database(Config.COUNTRY_DB);

country_db.close();
db.close();