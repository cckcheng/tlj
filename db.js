module.exports = SqlDb;

var sqlite3 = require('sqlite3').verbose();
var Config = require('./conf');
var Mylog = require('./mylog');
var Card = require('./card');

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

SqlDb.prototype.addTable = function(table) {
    var mainDB = this.db;
    var q = "insert into tables (match_type, created) values (?,datetime('now'))";
    mainDB.run(q, [table.matchType.title], function(err) {
        if(err) {
            Mylog.log(err.message);
        } else {
            q = "select last_insert_rowid() as tbid";
            mainDB.get(q, [], (err, row) => {
                if(err) {
                } else {
                    table.id = row.tbid;
                }
            });
        }
    });
};

SqlDb.prototype.addTableSummary = function(table) {
    var mainDB = this.db;
    var q = "update tables set ended=datetime('now'),total_game=?,summary=? where rowid=?";
    mainDB.run(q, [table.games.length, table.matchSummary(), table.id], function(err) {
        if(err) {
            Mylog.log(err.message);
        }
    });
};

SqlDb.prototype.addGame = function(table) {
    var mainDB = this.db;
    function record() {
        var q = "insert into games (table_id, game, holecards0) values (?,?,?)";
        mainDB.run(q, [table.id,table.games.length,Card.showCards(table.game.deck.remains)], function(err) {
            if(err) {
                Mylog.log(err.message);
            }
        });
    }
    
    if(table.id != null ) {
        record();
    } else {
        setTimeout(function () {
            if(table.id == null) {
                Mylog.log('FAIL: addGame, null table_id after 2s');
            } else {
                record();
            }
        }, 2000);
    }
};

SqlDb.prototype.addGamePlayer = function(table, player, seat) {
    var mainDB = this.db;
    function record() {
        var q = "insert into game_player (table_id, game, player_id, seat, cards, rank) values (?,?,?,?,?,?)";
        mainDB.run(q, [table.id, table.games.length, player.id, seat, player.showHand(), player.matchInfo.currentRank], function(err) {
            if(err) {
                Mylog.log(err.message);
            }
        });
    }

    if(table.id != null ) {
        record();
    } else {
        setTimeout(function () {
            if(table.id == null) {
                Mylog.log('FAIL: addGamePlayer, null table_id after 2s');
            } else {
                record();
            }
        }, 2000);
    }
};

SqlDb.prototype.addRound = function(table, first_player, play_rec) {
    var mainDB = this.db;
    var q = "insert into rounds (table_id, game, lead_seat, play_rec) values (?,?,?,?)";
    mainDB.run(q, [table.id, table.games.length, table.getSeat(first_player), play_rec], function(err) {
        if(err) {
            Mylog.log(err.message);
        }
    });
};

SqlDb.prototype.updateGameInfo = function(table, def) {
    var mainDB = this.db;
    var game = table.game;
    var q = "update games set contract=?,game_rank=?,trump=?,holecards1=?,partner_def=? where table_id=? and game=?";
    mainDB.run(q, [game.contractPoint, game.rank, game.trump, Card.showCards(game.holeCards), def,
                     table.id, table.games.length], function(err) {
        if(err) {
            Mylog.log(err.message);
        }
    });
    
    var q1 = "update game_player set is_declarer=1 where table_id=? and game=? and seat=?";
    mainDB.run(q1, [table.id, table.games.length, table.getSeat(game.contractor)], function(err) {
        if(err) {
            Mylog.log(err.message);
        }
    });
};

SqlDb.prototype.recordGameResult = function(table) {
    var mainDB = this.db;
    var game = table.game;
    var q = "update games set collected=?,result=?,summary=? where table_id=? and game=?";
    mainDB.run(q, [game.collectedPoint, game.result, game.playerStatusEn, table.id, table.games.length], function(err) {
        if(err) {
            Mylog.log(err.message);
        }
    });
    
    var q1 = "update game_player set is_partner=1 where table_id=? and game=? and seat=?";
    mainDB.run(q1, [table.id, table.games.length, table.getSeat(game.partner)], function(err) {
        if(err) {
            Mylog.log(err.message);
        }
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