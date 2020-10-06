module.exports = SqlDb;

var sqlite3 = require('sqlite3').verbose();
var Config = require('./conf');
var Mylog = require('./mylog');
var Card = require('./card');
var Group = require('./group');
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

SqlDb.prototype.listGroups = function(mainServer, player, dt) {
    var json = {action: 'group', type: 'list'};
    if(dt.user == null || dt.user != 1) {
        player.pushJson(json);
        return;
    }

    var q = "select b.account_id,b.player_name,max(b.last_time) ltm from accounts a join users b on a.id=b.account_id"
        + " where b.last_time>datetime('now','-2 months') group by b.account_id order by ltm desc limit 50";
    this.db.all(q, [], (err, rows) => {
        if (err) {
            Mylog.log(err.message);
        } else {
            json.ids = '';
            rows.forEach((row) => {
                json.ids += ',' + row.account_id;
                json[row.account_id] = row.player_name;
            });
            if(json.ids.length > 0) {
                json.ids = json.ids.substr(1);
                player.pushJson(json);
            }
        }
    });
};

SqlDb.prototype.addGroup = function(mainServer, player, dt) {
    var thisObj = this;
    var mainDB = this.db;
    var q = "insert into tour_group (group_name,start_time,status) values (?,datetime(?,'unixepoch'),?)";
    mainDB.run(q, [dt.name,dt.time,Group.STATUS.OPEN], function(err) {
        if (err) {
            Mylog.log(err.message);
            player.pushJson({action: 'msg', lang: 'en', title: 'Alert', content: err.message});
        } else {
            if(dt.ids == null || dt.ids.length < 1) {
                player.pushJson({action: 'msg', lang: 'en', title: 'Success', content: 'Group created'});
                thisObj.loadGroups(mainServer);
                return;
            }
            var grpId = this.lastID;
            q = "Insert into group_player (group_id, account_id) select ?,id from accounts where id in (" + dt.ids + ")";
            mainDB.run(q, [grpId], function(err) {
                if (err) {
                    Mylog.log(err.message);
                    player.pushJson({action: 'msg', lang: 'en', title: 'Alert', content: err.message});
                } else {
                    player.pushJson({action: 'msg', lang: 'en', title: 'Success', content: 'Group created'});
                    thisObj.loadGroups(mainServer);
                }
            });
        }
    });
};

SqlDb.prototype.loadGroups = function(mainServer) {
    if(mainServer.groups == null) mainServer.groups = {};
    var q = 'select g.*,t.summary from tour_group g left join tables t on t.table_id=g.table_id where g.status!=' + Group.STATUS.CLOSED;
    this.db.all(q, [], (err, rows) => {
        if (err) {
            Mylog.log(err.message);
        } else {
            rows.forEach((row) => {
                org = mainServer.groups[row.id];
                if(org) {
                    if(org.table) return;
                    if(org.status === Group.STATUS.NEW || org.status === Group.STATUS.OPEN) {
                        mainServer.groups[row.id] = new Group(row, mainServer);
                    } else {
                        mainServer.groups[row.id].summary = row.summary;
                    }
                } else {
                    mainServer.groups[row.id] = new Group(row, mainServer);
                }
            });
        }
    });
};

SqlDb.prototype.getPlayerNames = function(group) {
    var q = 'select b.account_id,b.player_name,max(b.last_time) from group_player a'
        + ' join users b on a.account_id=b.account_id where a.group_id=? group by b.account_id';
    group.players = {};
    this.db.all(q, [group.id], (err, rows) => {
        if (err) {
            Mylog.log(err.message);
        } else {
            rows.forEach((row) => {
                group.players[row.account_id] = row.player_name;
            });
        }
    });
};

SqlDb.prototype.testSendReferal = function(mailto, lang, referBy) {
    Sendmail.sendReferal(mailto, lang, referBy);
};

SqlDb.prototype.sendReferal = function(accountId, lang) {
    var q = 'select * from referal where account_id=? and sent=0';
    var thisObj = this;
    var mainDB = this.db;
    mainDB.all(q, [accountId], (err, rows) => {
        if (err) {
            Mylog.log(err.message);
        } else {
            var ids = [];
            rows.forEach((row) => {
                Sendmail.sendReferal(row.email, lang, row.refer_by);
                ids.push(row.id);
            });
            
            ids.forEach((id) => {
                thisObj.updateRecord('referal', 'id', id, {sent: 1});
            });
        }
    });
};

SqlDb.prototype.addReferal = function(player, dt) {
    if(player.property.account_id == null) {
        player.pushJson({action: 'msg', lang: dt.lang, title: dt.lang === 'zh' ? '提示' : 'Alert',
              content: dt.lang === 'zh' ? '请先注册' : 'Please register first'});
        return;
    }

    var emails = dt.emails.split(',');
    if(emails.length < 1) {
        player.pushJson({action: 'ack'});
        return;
    }

    var params = [];
    var values = '';
    for(var x in emails) {
        values += ',(?,?,?)';
        params.push(emails[x], dt.myname, player.property.account_id);
    }

    var q = "Insert or Ignore Into referal (email, refer_by, account_id) values " + values.substring(1);
    
    var thisObj = this;
    var mainDB = this.db;
    mainDB.run(q, params, function(err) {
        if(err) {
            Mylog.log(err.message);
        } else {
//            Mylog.log('lastID referal: ' + JSON.stringify(Object.keys(this)));
//            Mylog.log('lastID ' + this.lastID);
//            Mylog.log('valid referals: ' + this.changes);
            var content = '';
            if(dt.lang === 'zh') {
                content = '提交成功: ' + this.changes + '个有效email';
            } else {
                content = this.changes + ' valid email(s) submmited';
            }
            player.pushJson({action: 'msg', lang: dt.lang, title: 'Success', content: content});
            thisObj.sendReferal(player.property.account_id, dt.lang);
        }
    });
};

SqlDb.prototype.getRanking = function(player, dt) {
    var mainDB = this.db;
    var json = {action: dt.action, lang: dt.lang, type: dt.type};
    if(dt.lang === 'zh') {
        json.title = '排行榜';
    } else {
        json.title = 'Ranking';
    }
    
    var content = '';
    var q1 = 'select b.player_name,a.profit,max(b.last_time) from accounts a join users b on a.id=b.account_id'
          + ' where a.prize>0 or a.profit!=0 group by a.id order by a.profit desc limit 10';
    var q2 = 'select b.player_name,a.prize,max(b.last_time) from accounts a join users b on a.id=b.account_id'
          + ' where a.prize>0 group by a.id order by a.prize desc limit 10';
    var x = 1;
    mainDB.serialize(() => {
        mainDB.all(q1, [], (err, rows) => {
            if (err) {
                Mylog.log(err.message);
                player.pushJson({action: 'ack'});
                return;
            } else {
                content += dt.lang === 'zh' ? '按总盈余排行' : 'Ranking by total profit';
                rows.forEach((row) => {
                    content += '\n' + (x++) + '. ' + row.player_name + '   ' + row.profit;
                });
                if(x === 1) content += '\n---';
            }
        });

        mainDB.all(q2, [], (err, rows) => {
            if (err) {
                Mylog.log(err.message);
                player.pushJson({action: 'ack'});
                return;
            } else {
                content += '\n\n';
                content += dt.lang === 'zh' ? '按总奖金排行' : 'Ranking by total prize';
                x = 1;
                rows.forEach((row) => {
                    content += '\n' + (x++) + '. ' + row.player_name + '   ' + row.prize;
                });
                if(x === 1) content += '\n---';
                json.content = content;
                player.pushJson(json);
            }
        });
    });
};

SqlDb.prototype.updateAccount = function (playerId, action, coins) {
    var mainDB = this.db;
    var q0 = "Select account_id from users where player_id=?";
    mainDB.get(q0, [playerId], (err, row) => {
        if (err) {
            Mylog.log(err.message);
            player.pushJson({action: 'ack'});
        } else {
            if(row) {
                var accId = row.account_id;
                if(accId == null) return;
                
                var q1 = "Update accounts set coins=coins+" + coins;
                if(action === Config.TRANSACTION.WIN) {
                    q1 += ",profit=profit+" + coins + ",prize=prize+" + coins;
                } else if(action === Config.TRANSACTION.CONSUME) {
                    q1 += ",profit=profit+" + coins;
                }
                mainDB.run(q1 + " where id=?", [accId], (err) => {
                    if(err) Mylog.log(err.message);
                }).run("Insert Into transactions (account_id,coins,action) values (?,?,?)",
                        [accId,coins,action], (err) => {
                    if(err) Mylog.log(err.message);
                });
            }
        }
    });
};

SqlDb.prototype.registerUser = function (player, o) {
    var mainDB = this.db;

    if(o.email) {
        o.email = o.email.toLowerCase();
        if(!Sendmail.isValidEmail(o.email)) {
            player.sendMessage(player.lang === 'zh' ? '非法邮箱地址' : 'Invalid Email address');
            return;
        }
    }
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
                        var accountId = this.lastID;
                        q22 = "update users set account_id=? where player_id=?"
                        mainDB.run(q22, [accountId, o.id], function(err) {
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
                                    account_id: accountId,
                                    authcode: authCode,
                                    code_expiry: codeExpiry,
                                    coins: Config.INIT_COIN
                                });
                            }
                        }).run('Insert Into transactions (account_id,coins,action) values (?,?,?)',
                                [accountId,Config.INIT_COIN,Config.TRANSACTION.TOPUP], function(err) {
                            if (err) {
                                Mylog.log(err.message);
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
            table.id = this.lastID;
            table.updateTableList('add');
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
