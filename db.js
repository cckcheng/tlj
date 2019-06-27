module.exports = SqlDb;

var sqlite3 = require('sqlite3').verbose();
var Config = require('./conf');

function SqlDb() {

}

SqlDb.prototype.getCountryCode = function (ip, cb) {
    var country_db = new sqlite3.Database(Config.COUNTRY_DB);
    var aa = ip.split('.');
    var ipVal = 0;
    for (var x = aa.length - 1, pow = 1; x >= 0; x--, pow *= 256) {
        ipVal += pow * parseInt(aa[x]);
    }

    var q = 'Select country_code from ip2country where ip_from<= ? and ip_to>= ?';
    country_db.get(q, [ipVal, ipVal], (err, row) => {
        if (err) {
            console.log(err.message);
            cb('-');
        } else {
            cb(row.country_code);
        }
    });

    country_db.close();
};

SqlDb.prototype.recordUser = function (o) {
    this.getCountryCode(o.ip, function (countryCode) {
        var db = new sqlite3.Database(Config.MAIN_DB);
        var q = "insert or replace into users (player_id,player_name,lang,country_code,last_time)"
                + " values (?,?,?,?,datetime('now'))";
        db.run(q, [o.id, o.name, o.lang, countryCode], function (err) {
            if (err) {
                console.log(err.message);
            }
        });
        db.close();
    });
};

var sqlDB = new SqlDb();
var o = Object.assign({
    ip: '104.243.110.169'
}, {
    id: 'tlj123',
    name: 'ck',
    lang: 'zh'
});
sqlDB.recordUser(o);