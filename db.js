module.exports = SqlDb;

var sqlite3 = require('sqlite3').verbose();
var Config = require('./conf');
var Mylog = require('./mylog');
var Card = require('./card');
var Sendmail = require('./sendmail');

function SqlDb() {
    this.country_db = new sqlite3.Database(Config.COUNTRY_DB);
    this.db = new sqlite3.Database(Config.MAIN_DB);
    
    this.close = function() {
        this.country_db.close();
        this.db.close();
    };
}

function randomAuthCode() {
    var maxCode = 999999;
    var minCode = 100000;
    var aCode = Math.floor(Math.random() * maxCode);
    if(aCode < minCode) aCode += minCode;
    return aCode;
}

function calcTime(addMinutes) {
    // return total seconds from 1970-1-1, add given minutes
    var seconds = Math.floor((new Date()).getTime()/1000);
    return seconds + addMinutes * 60;
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

SqlDb.prototype.registerUser = function (player, o) {
    var mainDB = this.db;

    var q20 = "select * from accounts where global_id=?";
    var q21, q22;
    var params;
    var gId = o.gid ? o.gid : o.email;
    mainDB.get(q20, [gId], (err, row) => {
        if (err) {
            Mylog.log(err.message);
            player.pushJson({action: 'ack'});
        } else {
            if(row) {
                player.setAccountInfo(row);
                if(o.gid || o.email == Config.REVIEW_USER) {
                } else {
                    var curTime = calcTime(0);
                    var codeExpiry = row.code_expiry;
                    var authCode = row.authcode;
                    var codeSentTime = row.code_send_time;
                    var expiryMinutes = Config.AUTHCODE_EXPIRE_MINUTE;
                    if(curTime >= codeExpiry) {
                        authCode = randomAuthCode();
                        codeExpiry = calcTime(Config.AUTHCODE_EXPIRE_MINUTE);
                        codeSentTime = curTime;
                        player.property.authcode = authCode;
                        player.property.code_expiry = codeExpiry;
                        player.property.code_send_time = codeSentTime;
                    } else if(curTime - codeSentTime >= 60) {
                        codeSentTime = curTime;
                        expiryMinutes = Math.floor((codeExpiry - curTime) / 60);
                        player.property.code_send_time = codeSentTime;
                    }
                    if(codeSentTime === curTime) {
                        if(player.regTimes > 5) {
                            return;
                        }
                        Sendmail.sendVerifyCode(o.email, o.lang, authCode, expiryMinutes);
                        player.regTimes++;
                        Mylog.log("1 code_expiry=" + player.property.code_expiry);
                    }
                    
                    q21 = "update accounts set email=?,authcode=?,code_send_time=?,code_expiry=? where global_id=?";
                    mainDB.run(q21, [o.email, authCode, codeSentTime, codeExpiry, gId], function(err) {
                        if (err) {
                            Mylog.log(err.message);
                        }
                    });
                }
                
                q22 = "update users set account_id=? where player_id=?"
                mainDB.run(q22, [row.id, o.id], function(err) {
                    if (err) {
                        Mylog.log(err.message);
                        player.pushJson({action: 'ack'});
                    } else {
                        if(o.gid || o.email == Config.REVIEW_USER) {
                            player.pushJson({action: 'reg'});   // good to go
                        } else {
                            player.pushJson({action: 'auth'});  // notify user to verify the authCode
                        }
                    }
                });
            } else {
                q21 = "Insert Into accounts (global_id,email,coins,verified,authcode,code_expiry,code_send_time)"
                    + " values (?,?,?,?,?,?,?)";
                var authCode = randomAuthCode();
                if(o.gid || o.email == Config.REVIEW_USER) {
                    // authorised with social, no need verify
                } else {
                    if(player.regTimes > 5) {
                        return;
                    }
                    Sendmail.sendVerifyCode(o.email, o.lang, authCode, Config.AUTHCODE_EXPIRE_MINUTE);
                    player.regTimes++;
                }

                var codeExpiry = calcTime(Config.AUTHCODE_EXPIRE_MINUTE);
                params = o.gid ? [o.gid, o.email, Config.INIT_COIN, 1, null, null, null]
                              : [o.email, o.email, Config.INIT_COIN, 0, authCode, codeExpiry, calcTime(0)];
                mainDB.run(q21, params, function(err) {
                    if (err) {
                        Mylog.log(err.message);
                        player.pushJson({action: 'ack'});
                    } else {
                        q = "select last_insert_rowid() as accid";
                        mainDB.get(q, [], (err, row) => {
                            if(err) {
                                Mylog.log(err.message);
                                player.pushJson({action: 'ack'});
                            } else {
                                q22 = "update users set account_id=? where player_id=?"
                                mainDB.run(q22, [row.accid, o.id], function(err) {
                                    if (err) {
                                        Mylog.log(err.message);
                                        player.pushJson({action: 'ack'});
                                    } else {
                                        if(o.gid || o.email == Config.REVIEW_USER) {
                                            player.pushJson({action: 'reg'});   // good to go
                                        } else {
                                            player.pushJson({action: 'auth'});  // notify user to verify the authCode
                                        }
                                        player.setAccountInfo({
                                            account_id: row.accid,
                                            authcode: authCode,
                                            code_expiry: codeExpiry,
                                            coins: Config.INIT_COIN
                                        });
                                    }
                                }).run('Insert Into transactions (account_id,coins,action) values (?,?,?)',
                                        [row.accid,Config.INIT_COIN,Config.TRANSACTION.TOPUP], function(err) {
                                    if (err) {
                                        Mylog.log(err.message);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        }
    });  
};

SqlDb.prototype.updateRecord = function (tableName, idField, idVal, o) {
    if(!o) return;
    var keys = Object.keys(o);
    if(!keys || keys.length < 1) return;
    
    var fields = "";
    var params = [];
    for(k in o) {
        fields += "," + k + "=?";
        params.push(o[k]);
    }
    var q = "update " + tableName + " set " + fields.substr(1) + " where " + idField + "=?";
    params.push(idVal);
    this.db.run(q, params, (err) => {
        if(err) Mylog.log(err.message);
    });
};

SqlDb.prototype.verifyAccount = function (player, o) {
    var curTime = calcTime(0);
    Mylog.log("code_expiry=" + player.property.code_expiry);
    Mylog.log("curTime=" + curTime);
    if(player.property.code_expiry && curTime > player.property.code_expiry) {
        player.sendMessage(player.lang === 'zh' ?  '验证码已失效' : 'Verification code expired');
        return;
    }

    if(o.code == player.property.authcode) {
        player.pushJson({action: 'reg'});
        this.updateRecord('accounts', 'id', player.property.account_id, {verified: 1});
    } else {
        player.sendMessage(player.lang === 'zh' ? '验证码错误' : 'Incorrect verification code');
    }
};

SqlDb.prototype.readAccount = function (player, o) {
    var port = player.sock.localPort;
    var mainDB = this.db;
    var thisObj = this;
    var q = "select * from users a left join accounts b on a.account_id=b.id where a.player_id=?";
    mainDB.get(q, [o.id], (err, row) => {
        if (err) {
        } else {
            if(row) {
                if(player) {
                    player.setProperty(row);
                    if(o.action === 'auth') {
                        thisObj.verifyAccount(player, o);
                    }
                }
            } else {
                if(port === Config.PORT_IOS) {
                    player.property.member = true;
                } 
            }
        }
    });
};

SqlDb.prototype.recordUser = function (player, o) {
    var port = player.sock.localPort;
    var mainDB = this.db;
    var thisObj = this;
    var q = "select * from users a left join accounts b on a.account_id=b.id where a.player_id=?";
    mainDB.get(q, [o.id], (err, row) => {
        if (err) {
        } else {
            if(row) {
                if(player) {
                    player.setProperty(row);
                    if(o.action === 'auth') {
                        thisObj.verifyAccount(player, o);
                    }
                }
            } else {
                if(port === Config.PORT_IOS) {
                    player.property.member = true;
                } 
            }
        }
    });

    this.getCountryCode(o.ip, function (countryCode) {
        var q0 = port !== Config.PORT_IOS ? "insert or ignore into users (player_id,port,start_time) values (?,?,datetime('now'))"
           : "insert or ignore into users (player_id,port,start_time,expire_time) values (?,?,datetime('now'),datetime('now','+1 month'))";
        var q1 = "update users set player_name=?,lang=?,country_code=?,last_time=datetime('now')"
                + ",ip=? where player_id=?";
        mainDB.serialize(() => {
            mainDB.run(q0, [o.id, player.sock.localPort], function (err) {
                if (err) {
                    Mylog.log(err.message);
                }
            }).run(q1, [o.name, o.lang, countryCode, o.ip, o.id], function (err) {
                if (err) {
                    Mylog.log(err.message);
                }
            });
            
            if(o.action === 'reg') {
                Mylog.log(JSON.stringify(o));
                thisObj.registerUser(player, o);
            }
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
                    table.updateTableList('add');
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
