module.exports = SqlDb;

var sqlite3 = require('sqlite3').verbose();
var Config = require('./conf');
var Mylog = require('./mylog');

function SqlDb() {
    this.country_db = new sqlite3.Database(Config.COUNTRY_DB);
    this.db = new sqlite3.Database(Config.MAIN_DB);
    
    this.close = function() {
        this.country_db.close();
        this.db.close();
    };
}

SqlDb.prototype.getCountryCode = function (ip, cb) {
    var aa = ip.split('.');
    var ipVal = 0;
    for (var x = aa.length - 1, pow = 1; x >= 0; x--, pow *= 256) {
        ipVal += pow * parseInt(aa[x]);
    }

    var q = 'Select country_code from ip2country where ip_from<= ? and ip_to>= ?';
    this.country_db.get(q, [ipVal, ipVal], (err, row) => {
        if (err) {
            Mylog.log(err.message);
            cb('-');
        } else {
            cb(row.country_code);
        }
    });
};

SqlDb.prototype.recordUser = function (player, o) {
    var mainDB = this.db;
    var q = "select * from users where player_id=?";
    mainDB.get(q, [o.id], (err, row) => {
        if (err) {
        } else {
            if(row && player) player.setProperty(row);
        }
    });

    this.getCountryCode(o.ip, function (countryCode) {
        var q0 = "insert or ignore into users (player_id,start_time) values (?,datetime('now'))";
        var q1 = "update users set player_name=?,lang=?,country_code=?,last_time=datetime('now')"
                + ",ip=? where player_id=?";
        mainDB.serialize(() => {
            mainDB.run(q0, [o.id], function (err) {
                if (err) {
                    Mylog.log(err.message);
                }
            }).run(q1, [o.name, o.lang, countryCode, o.ip, o.id], function (err) {
                if (err) {
                    Mylog.log(err.message);
                }
            });
        });
    });
};
/*
var sqlDB = new SqlDb();
var o = Object.assign({
    ip: '104.243.110.169'
}, {
    id: 'tlj123',
    name: 'ck',
    lang: 'zh'
});
sqlDB.recordUser(p ,o);
*/