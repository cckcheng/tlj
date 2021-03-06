module.exports = Table;

var Config = require('./conf');
var Mylog = require('./mylog');
var Player = require('./player');
var Func = require('./func');
var Card = require('./card');
var Group = require('./group');
const {Game, Hand, SimpleHand} = require('./game');

Table.init = function() {
    Config = require('./conf');
    Table.FastMode = false;
    Table.HOLE_POINT_TIMES = 4;  // default
    Table.SHOW_MINBID = Config.SHOW_MINBID ? true : false;
    Table.PAUSE_SECONDS_BETWEEN_GAME = Config.PAUSE_SECONDS_BETWEEN_GAME;
    Table.PAUSE_SECONDS_BETWEEN_ROUND = Config.PAUSE_SECONDS_BETWEEN_ROUND;
    Table.TIMEOUT_SECONDS_BURYCARDS = Config.TIMEOUT_SECONDS_BURYCARDS;
    Table.MAX_IDLE_MINUTES = Config.MAX_IDLE_MINUTES;
};

Table.Messages = {
    Winning: {
        en: 'Congratulations, you win \u2666{0}',
        zh: '祝贺，您赢得奖金\u2666{0}'
    },

    InsufficientBalance : {
        en: 'Insufficient Balance',
        zh: '账户余额不足',
    },
    
    First: {
        en: 'Winner',
	zh: '冠军'
    },
    Second: {
        en: 'Runner-up',
        zh: '亚军'
    },
    Third: {
        en: 'No. 3',
        zh: '季军'
    },
    Fourth: {
        en: 'No. 4',
        zh: '第四'
    },
    Fifth: {
        en: 'No. 5',
        zh: '第五'
    },
    Sixth: {
        en: 'No. 6',
        zh: '第六'
    },

    AnyTrumpLate: {
        en: 'Late trump definition, no restriction\n',
        zh: '起底后任意定主\n'
    },
    AnyTrump: {
        en: 'No trump restriction\n',
        zh: '任意定主\n'
    },
    LateTrump: {
        en: 'Late trump definition\n',
        zh: '起底后定主\n'
    },
    HoleMultiple: {
        en: 'Hole point multiple: ',
        zh: '底分倍数: '
    },
    MissionOn: {
        en: 'Contract times needed: 2\n',
        zh: '要求坐庄次数: 2\n'
    },

    PlayerIn: {
        en: '{0} in',
        zh: '{0}来了'
    },
    PlayerOut: {
        en: '{0} out',
        zh: '{0}走了'
    },
    PlayerWatching: {
        en: '{0} is watching',
        zh: '{0}来了, 在旁观'
    },
    InvalidPlayer: {
        en: 'Invalid player, unable to join',
        zh: '非参赛选手, 无法加入'
    },
    
    GameNumber: {
        en: 'Game {0}',
        zh: '第{0}局'
    },
    
    TableEnded: {
        en: 'Table ended',
        zh: '该局已结束'
    },
    WrongPass: {
        en: 'Wrong Password',
        zh: '密码错误'
    },
    NoSeat: {
        en: 'No Seat Available',
        zh: '没有空座'
    },

    JoinTooLate:
    {
        en: 'Too late to join',
        zh: '太晚，无法加入'
    },
    TableCloseEnd: 
    {
	en: 'Table close to end',
	zh: '该局即将结束，无法加入'
    },

    AllTableFull: {
        en: 'No table available. Please wait...',
        zh: '没有空桌. 请稍候...'
    }
};

const SEAT_NUMBER = 6;
const DECK_NUMBER = 4;
const ADD_SECONDS = 2;

Table.init();

function Table(o, mainServer, category) {
    this.mainServer = mainServer;

    this.id = null;
    this.category = category ? category : 'NOVICE';
    this.options = {};
    this.coins = 0;
    this.prizePoolScale = 1;
    this.players = new Array(SEAT_NUMBER);
    
    this.playerRecord = {};
    this.visiters = [];
    this.robots = [];
    this._positions = [];
    this.dismissed = false;
    this.allowJoin = o ? o.allowJoin : true;
    this.showMinBid = o ? o.showMinBid : false;

    var pos = 0;
    while (pos < SEAT_NUMBER) {
        this._positions.push(pos++);
    }

    if (o && o.matchType) {
        this.matchType = o.matchType;
    } else {
        this.matchType = Table.MATCH_TYPE.FULL;
    }

    this.timerScale = this.matchType.timerScale > 0 ? this.matchType.timerScale : 1;
    this.maxRank = this.matchType.ranks[this.matchType.ranks.length - 1];
    this.deckNumber = o.deckNumber || DECK_NUMBER;

    this.games = [];

    this.TIMEOUT_SECONDS = Table.FastMode ? Config.FAST_TIMEOUT_SECONDS : Config.TIMEOUT_SECONDS;
    this.ROBOT_SECONDS = Table.FastMode ? 0.1 : Config.ROBOT_SECONDS;

    this.status = 'running';
    this.playerStatus = '';  // record player names and latest ranks

    if(this.mainServer) this.mainServer.myDB.addTable(this);
    
    this.addVisiter = function(player) {
        if(this.visiters.indexOf(player) >= 0) return;
        this.visiters.push(player);
        player.currentTable = this;
        if(this.options.summary != null) {
            player.sendMessage(this.options.summary[player.lang]);
        }
    };

    this.removeVisiter = function(player) {
        var idx = this.visiters.indexOf(player);
        if(idx >=0 ) this.visiters.splice(idx, 1);
        player.currentTable = null;
    };

    this.updateTableList = function(action_type) {
        if(this.mainServer == null) return;
        var tableList = this.mainServer.tableListById;
        switch(action_type) {
            case 'add':
                tableList[this.id] = this;
                break;
            case 'remove':
                if(tableList[this.id]) delete tableList[this.id];
                if(this.passCode > 0) {
                    delete this.mainServer.protectedTables[this.passCode];
                } 
                if(this.mainServer.pendingReboot && Object.keys(tableList).length < 1) {
                    mainServer.stop();
                }
                break;
        }
    };
    
    this.matchSummary = function () {
        if(this.games) {
            var gameNum = this.games.length;
            if (gameNum < 1) return '';
        }

        if(!this.matchOver) return this.playerStatus;
        
        if(this.finalSummary) return this.finalSummary;  // avoid run twice

        var summary = '';
        var summary_zh = '';
        this.players.sort(function (a, b) {
            return b.matchInfo.currentRank - a.matchInfo.currentRank;
        });

        var pRank = 0, rnk;
        var winners = {};
        for (var r = 1, x = 0, p; p = this.players[x]; x++) {
            rnk = p.matchInfo.currentRank;
            if (pRank !== 0 && rnk !== pRank) r = x + 1;
            if(r<=3) {
                if(winners[r] == null) {
                    winners[r] = [];
                }
                winners[r].push(p);
            }
            
            switch(r) {
                case 1:
                    summary += Table.Messages.First['en'];
                    summary_zh += Table.Messages.First['zh'];
                    break;
                case 2:
                    summary += Table.Messages.Second['en'];
                    summary_zh += Table.Messages.Second['zh'];
                    break;
                case 3:
                    summary += Table.Messages.Third['en'];
                    summary_zh += Table.Messages.Third['zh'];
                    break;
                case 4:
                    summary += Table.Messages.Fourth['en'];
                    summary_zh += Table.Messages.Fourth['zh'];
                    break;
                case 5:
                    summary += Table.Messages.Fifth['en'];
                    summary_zh += Table.Messages.Fifth['zh'];
                    break;
                case 6:
                    summary += Table.Messages.Sixth['en'];
                    summary_zh += Table.Messages.Sixth['zh'];
                    break;
            }
            summary += ': ' + p.name + ' (' + Card.RankToString(p.matchInfo.currentRank) + ')\n';
            summary_zh += ': ' + p.name + ' (' + Card.RankToString(p.matchInfo.currentRank) + ')\n';
            pRank = rnk;
        }
        
        this.finalSummary = summary;
        
        this.matchSummaryLang = {
            en: {
                summary: summary
            },
            zh: {
                summary: summary_zh
            }
        };
        
        // reword winners
        if(this.coins > 0) {
            var totalPrize = this.players.length * this.coins * this.prizePoolScale;
            if(this.passCode > 0) totalPrize *= Config.PRIVATE_PRIZE_SCALE;  // fee for private table
            var p1 = totalPrize * 0.6;
            var p2 = totalPrize * 0.25;
            var p3 = totalPrize * 0.15;
            var nm = winners[1].length;
            
            var totalScore = Config.SCORE_1ST + Config.SCORE_2ND + Config.SCORE_3RD;
            if(nm >= 3) {
                this.splitPrize(winners[1], totalPrize, totalScore, 1);
            } else if(nm === 2) {
                this.splitPrize(winners[1], p1 + p2, Config.SCORE_1ST + Config.SCORE_2ND, 1);
                this.splitPrize(winners[3], p3, Config.SCORE_3RD, 3);
            } else {
                this.rewardPlayer(winners[1][0], Math.round(p1), Config.SCORE_1ST, 1);
                
                nm = winners[2].length;
                if(nm > 1) {
                    this.splitPrize(winners[2], p2 + p3, Config.SCORE_2ND + Config.SCORE_3RD, 2);
                } else {
                    this.rewardPlayer(winners[2][0], Math.round(p2), Config.SCORE_2ND, 2);
                    this.splitPrize(winners[3], p3, Config.SCORE_3RD, 3);
                }
            }
        }
        
//        Mylog.log(summary);
        return summary;
    };
    
    this.splitPrize = function(players, total, totalScore, rank) {
        var avgPrize = Math.round(total / players.length);
        var avgScore = totalScore / players.length;
        for(var i in players) {
            this.rewardPlayer(players[i], avgPrize, avgScore, rank);
        }
    };
    
    this.rewardPlayer = function(p, prize, score, rank) {
        if(!p.isRobot()) {
            if(this.playerRecord[p.id] == null || !this.playerRecord[p.id].deducted) return;
            this.mainServer.myDB.updateAccount(p.id, Config.TRANSACTION.WIN, prize);
            if(p.sock != null) {
                var player = Table.getOnlinePlayer(this.mainServer, p.sock);
                if(player) {
                    if(player.updateBalance(prize)) {
                        this.playerRecord[p.id].winning = Table.Messages.Winning[p.lang].format(prize);
                    }
                }
            }
        }

        if(score && this.group_id && p.property.account_id && this.mainServer) {
            this.mainServer.myDB.recordGroupScore(this.group_id, p.property.account_id, score, rank);
        }
    };
    
    this.playerNames = function () {
        var s = '';
        this.players.forEach(function (p) {
            s += ', ' + p.name + '(' + Card.RankToString(p.matchInfo.currentRank);
            if (p.id != null && p.sock == null) {
                s += ',away';
            }
            s += ')';
        });
        return s.substr(2);
    };

    this.realPlayerNames = function () {
        var s = '';
        this.players.forEach(function (p) {
            if(p.isRobot()) return;
            s += ', ' + p.name;
        });
        return s.substr(2);
    };

    this.getAiLevel = function() {
        var ai = Config.AI_LEVEL[this.category];
        for(var x=0,p; p=this.players[x]; x++) {
            if(p.id && p.property.priority >= 5) {
                if(p.property.aiLevel > ai) ai = p.property.aiLevel;
            }
        }
        return ai;
    };
    
    this.getDefaultOption = function() {
        var opt = '';
        if(Config.TESTING) {
        } else if(this.matchType !== Table.MATCH_TYPE.FULL && this.matchType !== Table.MATCH_TYPE.HALF) {
            return opt;
        }

        if(Config.DEFAULT_OPTION[this.category]) opt += Config.DEFAULT_OPTION[this.category];
        
        return opt;
    };
    
    this.setOptions = function(opt) {
        if(opt == null || opt.length < 1) return;
        opts = opt.split(',');
        for(var x in opts) {
            switch(opts[x].charAt(0)) {
                case 'A':
                    this.options.anyTrump = true;
                    break;
                case 'L':
                    this.options.lateTrump = true;
                    break;
                case 'M':
                    this.options.holeMultiple = opts[x].substring(1);
                    break;
                case 'W':
                    this.options.minPlayers = opts[x].charAt(1) - '0';
                    break;
                case 'B':
                    this.options.longBreakMinutes = parseInt(opts[x].substring(1));
                    break;
                case 'T':  // contract task
                    this.options.missionOn = true;
                    break;
            }
        }
        
        this.options.summary = {en: '', zh: ''};
        if(this.options.anyTrump && this.options.lateTrump) {
            this.options.summary.en += Table.Messages.AnyTrumpLate.en;
            this.options.summary.zh += Table.Messages.AnyTrumpLate.zh;
        } else if(this.options.anyTrump) {
            this.options.summary.en += Table.Messages.AnyTrump.en;
            this.options.summary.zh += Table.Messages.AnyTrump.zh;
        } else if(this.options.lateTrump) {
            this.options.summary.en += Table.Messages.LateTrump.en;
            this.options.summary.zh += Table.Messages.LateTrump.zh;
        }
        
        if(this.options.missionOn) {
            this.options.summary.en += Table.Messages.MissionOn.en;
            this.options.summary.zh += Table.Messages.MissionOn.zh;
        }
        
        if(this.options.holeMultiple != null) {
            this.options.summary.en += Table.Messages.HoleMultiple.en + this.options.holeMultiple;
            this.options.summary.zh += Table.Messages.HoleMultiple.zh + this.options.holeMultiple;
        } 
        if(this.options.summary.en.length < 1) this.options.summary = null;
    };
}

Table.MATCH_TYPE = {
    FULL: {
        title: 'Full(2->A)',
        brief: '2->A',
        maxGame: 18,
        ranks: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
    },
    HALF: {
        title: 'Half(8->A)',
        brief: '8->A',
        maxGame: 10,
        ranks: [8, 9, 10, 11, 12, 13, 14]
    },
    POINTS: {
        title: 'All Points(5/10/K)',
        brief: '5 10 K',
        maxGame: 6,
        ranks: [2, 5, 10, 13, 14]
    },
    FREE: {
        title: 'Free(2->5)',
        brief: '2->5',
        maxGame: 6,
        timerScale: 2,
        ranks: [2, 3, 4, 5]
//        ranks: [2]
    },
    EXPRESS: {
        title: 'Express(10->A)',
        brief: '10->A',
        maxGame: 8,
        ranks: [10, 11, 12, 13, 14]
    }
};
Table.MATCH_TYPE['2->A'] = Table.MATCH_TYPE.FULL;
Table.MATCH_TYPE['8->A'] = Table.MATCH_TYPE.HALF;
Table.MATCH_TYPE['10->A'] = Table.MATCH_TYPE.EXPRESS;
Table.MATCH_TYPE['5 10 K'] = Table.MATCH_TYPE.POINTS;
Table.MATCH_TYPE['2->5'] = Table.MATCH_TYPE.FREE;

Table.OPTIONS = {
    A: {  // Any trump
        en: 'No trump restriction',
        zh: '任意定主'
    },
    
    L: {  // Late trump
        en: 'Late trump set',
        zh: '起底后定主'
    },
    
    M: {  // Penalty point multiple
        en: 'Hole point multiple',
        zh: '抠底倍数'
    },
    
    W: {  // match start waiting
        en: 'Wait for players join',
        zh: '等人入场'
    },
    
    B: {  // long break
        en: 'Long break time',
        zh: '中场休息'
    }
};

Table.CATEGORY = {
    PRACTICE: {
        icon: 58678,
        coins: 0,
        prizePoolScale: 1,
        en: 'Practice',
        zh: '练习'
    },
    NOVICE: {
        icon: 58726,
        coins: 50,
        prizePoolScale: 1,
        en: 'Novice',
        zh: '初级'
    },
    INTERMEDIATE: {
        icon: 58673,
        coins: 200,
        prizePoolScale: 1,
        en: 'Intermediate',
        zh: '中级'
    },
    ADVANCED: {
        icon: 58676,
        coins: 500,
        prizePoolScale: 1,
        en: 'Advanced',
        zh: '高级'
    }
};

Table.prototype.seatAvailable = function () {
    return this._positions.length > 0;
};

Table.prototype.allRobots = function () {
    for (var x = 0, p; x < SEAT_NUMBER; x++) {
        p = this.players[x];
        if (p == null)
            continue;
        if (p.sock != null)
            return false;
    }

    return true;
};

Table.prototype.dismiss = function () {
    if (this.dismissed) return true;

    if(this.group_id) {
        if(this.games.length < 2) return false;  // to avoid tour abort too soon
    }
    
    var noPlayerLeft = true;
    for (var x = 0, p; x < SEAT_NUMBER; x++) {
        p = this.players[x];
        if (p == null) continue;    // should not happen
        if (p.sock != null) return false; // has active player
        if (p.id != null) noPlayerLeft = false;
    }

    if (noPlayerLeft) {
        if (this.pauseTimer != null) {
            clearTimeout(this.pauseTimer);
            this.pauseTimer = null;
        }
        if (this.autoTimer != null) {
            clearTimeout(this.autoTimer);
            this.autoTimer = null;
        }
        this.terminate();
        return true;
    }

    if (this.status === 'break') return false;

    if (this.pauseTimer != null) return false;

    if(this.autoTimer != null) {
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
    }
    var pauseMinutes = Config.DEBUGGING ? 5 : Config.TABLE_IDLE_MINUTES;  // 5 minutes, set to 30 minutes when release
    this.pauseTimer = setTimeout(function (t) {
        t.pauseTimer = null;
        t.terminate();
    }, pauseMinutes * 60000, this);
    return false;
};

Table.prototype.terminate = function () {
//    Mylog.log(this.playerNames());
    this.dismissed = true;
    for (var x = 0, p; x < this.players.length; x++) {
        p = this.players[x];
        if (p == null) continue;
        if (p.id != null) {
            // need delete the player from activePlayers
            this.mainServer.removePlayer(p);
        }
        p.currentTable = null;
    }

    this.visiters.forEach(function (p) {
        p.currentTable = null;
    });
        
    Mylog.log(new Date().toLocaleString() + ', table ended: ' + this.id);
    this.mainServer.myDB.addTableSummary(this);
    this.updateTableList('remove');
    this.mainServer.removeTable(this);
    
    setTimeout(function (t) {
        // for garbage collection
        t.visiters = null;
        t.players = null;
        t.robots = null;
        t.games = null;
    }, 5000, this);
};

Table.prototype.resume = function (player) {
    if (this.dismissed) return false;
    if (player == null || player.currentTable !== this) return false;

    player.clearIdleTimer();
    if(this.pauseTimer != null) {
        clearTimeout(this.pauseTimer);
        this.pauseTimer = null;
        switch (this.status) {
            case 'running':
                player.pushData();

                if (this.game.stage === Game.PLAYING_STAGE) {
                    if (this.game.trump == null) {
                        this.enterPlayingStage();
                    } else if (this.game.holeCards.length < 1) {
                        this.buryCards();
                    } else if (this.game.partnerDef == null) {
                        this.definePartner();
                    } else {
                        this.autoPlay();
                    }
                } else {
                    this.autoPlay();
                }
                break;
            case 'break':
                player.pushData();
                break;
            case 'pending':
                this.startGame();
                break;
        }
    } else {
        switch (this.status) {
            case 'running':
                player.pushData();

                if (player === this.players[this.actionPlayerIdx]) {
                    if (this.autoTimer != null) {
//                        this.autoTimer.refresh(); // probably no need
                    }
                }
                break;
            case 'break':
                player.pushData();
                if(this.games.length < 1) {
                    var msg = '';
                    if(this.options.summary != null) {
                        msg = this.options.summary[player.lang];
                    } else {
                        msg = player.lang === 'zh' ? '新桌，等待玩家加入...' : 'New table, please wait for other players...';
                    }
                    if(msg != null) player.sendMessage(msg);
                    return true;
                }
                break;
            case 'pending':
                this.startGame();
                break;
        }
    }

    if(this.options.summary != null) {
        player.sendMessage(this.options.summary[player.lang]);
    }
    return true;
};

Table.prototype.addPlayer = function (player, isRobot) {
    if (this._positions.length < 1) {
        // no seat available
        return false;
    }

    if (this.players.indexOf(player) >= 0) {
        Mylog('already in this table');
        return true;
    }

    var pos = Math.floor(Math.random() * (this._positions.length));
    this.players[this._positions[pos]] = player;
    this._positions.splice(pos, 1);
    player.currentTable = this;
    
    if(isRobot) this.robots.push(player);
    return true;
};

const ROBOT_CODES = 'ABCDEF';
Table.prototype.initPlayerStatus = function () {
    if(this.inited) return;
    for (var x = 0, p; p = this.players[x]; x++) {
        p.matchInfo = new MatchInfo(this, p);
        p.robotCode = ROBOT_CODES.charAt(x);
        if(p.isRobot()) p.name = 'Robot' + p.robotCode;
    }
    this.playerStatus = this.playerNames();
    this.inited = true;  // only init once
};

Table.prototype.setPlayerMatchInfo = function (player) {
    player.matchInfo = new MatchInfo(this, player);
    player.currentTable = this;
};

Table.prototype.startGame = function (testOnly) {
    this.status = 'running';
    this.game = new Game(this.players, this.deckNumber);
    this.games.push(this.game);
//    debugger;
    if (this.games.length === 1) {
        // first game, init match info
        this.initPlayerStatus();
    } else {
        Func.shuffleArray(this.players);
        // init game info
        for (var x = 0, p; p = this.players[x]; x++) {
            p.matchInfo.reset();
            p.timeoutTimes = 0;
        }
    }

    if(this.mainServer != null) this.mainServer.myDB.addGame(this);
    this.actionPlayerIdx = 0;
    for (var x = 0, p; p = this.players[x]; x++) {
        p.evaluate();
        if(this.mainServer != null) this.mainServer.myDB.addGamePlayer(this, p, x+1);
    }

    if (!this.players[0].canBid && this.players[0].matchInfo.alert) {
        this.actionPlayerIdx = 1;
    }

    var broadJson;
    var langMsg;
    for (var x = 0, p; p = this.players[x]; x++) {
        p.pushData();
        if(!p.isRobot()) {
            this.updatePlayerRecord(p.id);
            if(this.options.summary != null) {
                p.sendMessage(this.options.summary[p.lang]);
            }
        }
        if (p.matchInfo.alert) {
            langMsg = p.matchInfo.alert;
            if (!p.canBid) {
                p.matchInfo.lastBid = 'pass';
                broadJson = {
                    action: 'bid',
                    seat: x + 1,
                    bid: 'pass'
                };
            }
        }
    }

    for (var x = 0, p; p = this.visiters[x]; x++) {
        p.pushData(this);
        if(this.options.summary != null) {
            p.sendMessage(this.options.summary[p.lang]);
        }
    }

    if(broadJson) {
        this.broadcastGameInfo(broadJson);
    }

    if (langMsg) {
        this.broadcastMessage(langMsg);
    }

    if (testOnly == null) this.autoPlay();
};

Table.prototype.rotatePlayer = function () {
    this.actionPlayerIdx++;
    if (this.actionPlayerIdx >= SEAT_NUMBER)
        this.actionPlayerIdx -= SEAT_NUMBER;
};

function findNextActivePlayer(t) {
    var currentPlayer = t.players[t.actionPlayerIdx];
    var count = SEAT_NUMBER;
    while (count > 0 && currentPlayer.matchInfo.lastBid === 'pass') {
        t.rotatePlayer();
        currentPlayer = t.players[t.actionPlayerIdx];
        count--;
    }
    if (count === 0) {
        // all pass, force first canBid player to bid
        for (var x = 0, p; p = t.players[x]; x++) {
            if (p.canBid) {
                t.actionPlayerIdx = x;
                t.game.contractPoint -= 5;
                p.matchInfo.lastBid = t.game.contractPoint;
                t.game.contractor = p;
                break;
            }
        }
        return false;
    }

    return true;
}

function procAfterBid(t) {
    var actionSeat = t.actionPlayerIdx + 1;
    var lastBid = t.players[t.actionPlayerIdx].matchInfo.lastBid;
    t.rotatePlayer();
    var suc = findNextActivePlayer(t);
    var obj = {
        action: 'bid',
        seat: actionSeat,
        bid: lastBid,
        contract: t.game.contractPoint,
        next: t.actionPlayerIdx + 1
    };
    var bidOver = t.players[t.actionPlayerIdx] === t.game.contractor;
    if (bidOver) {
        obj.bidOver = "yes";
        obj.itrump = t.game.contractor.intendTrumpSuite;
    }
    t.broadcastGameInfo(obj);

    if (!bidOver) {
        t.autoPlay();
    } else {
        //bidding over

        if (!suc) {
            //special case, all passes, force first canBid player to be contractor
            setTimeout((t) => {
                t.broadcastGameInfo({
                    action: 'bid',
                    seat: t.actionPlayerIdx + 1,
                    bid: t.game.contractPoint,
                    contract: t.game.contractPoint,
                    next: t.actionPlayerIdx + 1
                });
                t.enterPlayingStage();
            }, 1000, t);
        } else {
            t.enterPlayingStage();
        }
    }
}

Table.prototype.autoPlay = function (deemRobot) {
    if (this.autoTime != null) return;  // prevent multi timeout
    if (this.actionPlayerIdx < 0) {
        procAfterPause(this);
        return;
    }

    if (deemRobot == null) deemRobot = false;
//    Mylog.log('actionPlayerIdx: ' + this.actionPlayerIdx);
    var player = this.players[this.actionPlayerIdx];
    var waitSeconds = this.ROBOT_SECONDS;
    if (!deemRobot && player.sock != null) {
        if (player.isOut()) {
            waitSeconds *= 2;
        } else {
            waitSeconds = this.TIMEOUT_SECONDS * this.timerScale + ADD_SECONDS;
        }
    }

    this.autoTimer = setTimeout(function (t) {
        t.autoTimer = null;
        if (waitSeconds > 5)
            player.timeoutTimes++;
        if (t.game.stage === Game.BIDDING_STAGE) {
            var currentPlayer = t.players[t.actionPlayerIdx];
            if (currentPlayer.canBid && currentPlayer.minBid < t.game.contractPoint) {
//                Mylog.log('minBid=' + currentPlayer.minBid + ',contractPoint ' + t.game.contractPoint);
                t.game.contractPoint -= 5;
                currentPlayer.matchInfo.lastBid = t.game.contractPoint;
                t.game.contractor = currentPlayer;
            } else {
                currentPlayer.matchInfo.lastBid = 'pass';
            }

            procAfterBid(t);
        } else {
            if (t.game.trump == null) {
                t.enterPlayingStage();
            } else if (t.game.holeCards.length < 1) {
                t.buryCards();
            } else if(t.game.partnerDef == null) {
                procDefinePartner(t);
            } else {
                procPlayCards(t);
            }
        }
    }, waitSeconds * 1000, this);
};

Table.prototype.enterPlayingStage = function () {
    this.game.enterPlayStage();
    if(this.options.lateTrump) {
        this.game.contractor.pushJson({
            action: 'add_remains',
            cards: Card.cardsToString(this.game.deck.remains)
        });
        this.game.contractor.addRemains(this.game.deck.remains);        
    }
     
    this.declareTrump();
};

function procSetTrump(t, trump) {
    t.game.setTrump(trump);
    t.broadcastGameInfo({
        action: 'set_trump',
        seat: t.actionPlayerIdx + 1,
        gameRank: t.game.rank,
        contract: t.game.contractPoint,
        acttime: Math.floor(Table.TIMEOUT_SECONDS_BURYCARDS * t.timerScale),
        trump: t.game.trump
    });

    if(t.options.lateTrump) {
        t.game.contractor.pushJson({
            action: 'add_remains',
            acttime: Math.floor(Table.TIMEOUT_SECONDS_BURYCARDS * t.timerScale)
        });
    } else {
        t.game.contractor.pushJson({
            action: 'add_remains',
            cards: Card.cardsToString(t.game.deck.remains),
            acttime: Math.floor(Table.TIMEOUT_SECONDS_BURYCARDS * t.timerScale)
        });
    }

    if(t.options.missionOn) {
        var pName = t.playerNameWithAddon(t.game.contractor);
        t.broadcastGameInfo({action: 'in', name: pName, seat: t.getSeat(t.game.contractor)});
    }
    t.buryCards();
}

function procBuryCards(t, cards) {
    t.game.contractor.buryCards(cards);

    t.broadcastGameInfo({
        action: 'play',
        next: t.actionPlayerIdx + 1
    }, t.game.contractor);
    t.definePartner();
}

function procDefinePartner(t, def) {
    def = t.game.setPartnerDef(def);
    t.broadcastGameInfo({
        action: 'partner',
        seat: t.actionPlayerIdx + 1,
        def: def
    });

    t.mainServer.myDB.updateGameInfo(t, def);
    t.autoPlay();
}

function procPlayCards(t, cards) {
    if (t.actionPlayerIdx < 0) {
        procAfterPause(t);
        return;
    }
    var player = t.players[t.actionPlayerIdx];
    var status = player.playCards(cards);
    if (status === 'error') return;
    var seat = t.actionPlayerIdx + 1;

    var strCards = player.matchInfo.playedCards;
    var json = {
        action: 'play',
        seat: seat,
        cards: strCards
    };

    var game = t.game;
    if (game.partner == null) {
        if (game.partnerDef.partnerMatch(strCards)) {
            game.partner = player;
            json.isPartner = 'yes';
            for (var x = 0, p; p = t.players[x]; x++) {
                if (p === game.contractor) continue;
                if (p === game.partner) {
                    if (p.matchInfo.totalPenalty < 0) game.collectedPoint -= p.matchInfo.totalPenalty;
                } else {
                    game.collectedPoint += p.matchInfo.points;
                }
                p.matchInfo.points = 0;
            }
        }
    }

    var leadingHand = t.game.currentRound.getLeadingHand();
    var leadingPlayer = leadingHand ? leadingHand.player : t.game.leadingPlayer;
    if (player === leadingPlayer) json.lead = 1;

    json.pt1 = player.matchInfo.points;
    json.pt0 = game.collectedPoint;
    if (status === 'gameover') {
        t.broadcastGameInfo(json);
        gameOver(t);
        return;
    }

    if (status === 'newround') {
        t.actionPlayerIdx = -1;
        if (t.game.partner == null && t.game.leadingPlayer !== t.game.contractor) {
            json.pseat = t.getSeat(t.game.leadingPlayer);
            json.pt = t.game.leadingPlayer.matchInfo.points;
        }
        t.broadcastGameInfo(json);

        var addSeconds = 0;
        if (t.game.currentRound.cardNumber > 4) {
            addSeconds = t.game.currentRound.cardNumber - 4;
        }

        t.goPause(Table.PAUSE_SECONDS_BETWEEN_ROUND + addSeconds);
    } else {
        t.rotatePlayer();
        json.next = t.actionPlayerIdx + 1
        var nxtPlayer = t.players[t.actionPlayerIdx];
        if (nxtPlayer.sock == null || nxtPlayer.isOut()) {
            t.broadcastGameInfo(json);
        } else {
            var sugCards = nxtPlayer.suggestedCards();
            if (sugCards == null) {
                t.broadcastGameInfo(json);
            } else {
                t.broadcastGameInfo(json, nxtPlayer);
                nxtPlayer.pushJson(Object.assign({
                    sug: sugCards
                }, json));
            }
        }
        t.autoPlay(status === 'lasthand');
    }
}

function highestRank(players) {
    var maxRank = 0;
    for(var x=0,p; p=players[x]; x++) {
        if(p.matchInfo.currentRank > maxRank) {
            maxRank = p.matchInfo.currentRank;
        }
    }
    
    return maxRank;
}

function needLongBreak(t) {
    if(t.options.longBreakMinutes == null || t.options.longBreakMinutes <= 0) return false;
    var num = t.games.length;
    if(num < Config.LONG_BREAK_GAME_NUM || (num % Config.LONG_BREAK_GAME_NUM) !== 0) return false;
    var threshold = t.matchType.ranks[t.matchType.ranks.length - 2];
    return highestRank(t.players) < threshold;
}

function gameOver(t) {
    var enSummary = '';
    var zhSummary = '';
    var holeCardsPoint = Card.getTotalPoints(t.game.holeCards);
    if (holeCardsPoint > 0) {
        var leadPlayer = t.game.currentRound.getNextLeadingPlayer();
        if (leadPlayer !== t.game.contractor && leadPlayer != t.game.partner) {
            var maxLen = t.game.currentRound.maxSubHandLength();
            var times = Table.HOLE_POINT_TIMES * maxLen;
            if(t.options.holeMultiple === '2n') {
                times = 2 * maxLen;
            } else if(t.options.holeMultiple === '2^n') {
                times = Math.pow(2, maxLen);
            }
            var holePoints = holeCardsPoint * times;
            leadPlayer.addPoints(holePoints);
            zhSummary += '闲家抠底，底分翻' + times + '倍,共' + holePoints + '\n';
            enSummary += 'Hole cards\' points multipled by ' + times + ', total ' + holePoints + '\n';
        }
    }

    t.game.promote();
    enSummary += t.game.enSummary;
    zhSummary += t.game.zhSummary;
//    enSummary += t.game.playerStatusEn + '\n';
//    zhSummary += t.game.playerStatusZh + '\n';
    t.playerStatus = t.playerNames();
    t.mainServer.myDB.recordGameResult(t);

    t.matchOver = false;
    for (var x = 0, p; p = t.players[x]; x++) {
        if (p.messageTimer) {
            clearTimeout(p.messageTimer);
            p.messageTimer = null;
        }
        if (p.matchInfo.currentRank > t.maxRank) {
            t.matchOver = true;
        }
    }
    
    var pauseSeconds = Table.PAUSE_SECONDS_BETWEEN_GAME;
    if (!t.matchOver) {
        if(needLongBreak(t)) {
            pauseSeconds = t.options.longBreakMinutes * 60;
            enSummary += 'Break time. ';
            zhSummary += '休息一下, ';
        }
        enSummary += 'Next game will start in ' + pauseSeconds + ' seconds.';
        zhSummary += '下一局' + pauseSeconds + '秒后开始...';
    }

    var json = {
        action: 'gameover',
        seat: t.getSeat(t.game.contractor),
        hole: Card.cardsToString(t.game.holeCards),
        pt0: t.game.collectedPoint,
        pause: t.matchOver ? 0 : pauseSeconds
    };
    var langInfo = {
        en: {
            summary: enSummary
        },
        zh: {
            summary: zhSummary
        }
    };

    setTimeout(function (t) {
        t.broadcastGameInfo(json, null, langInfo);
    }, Config.PAUSE_SECONDS_BETWEEN_ROUND * 1000, t);

    Mylog.log(new Date().toLocaleString() + ', ' + t.id + '#' + t.games.length + ': ' + t.game.contractPoint + '|' + t.game.collectedPoint
         + ' ' + t.game.playerStatusEn);

    if (t.matchOver) {
        t.dismissed = true;
        if(t.options.missionOn) {
            for (var x = 0, p, adj=0; p = t.players[x]; x++) {
                adj = t.missionAdjust(p.matchInfo);
                if(adj !== 0) p.promote(adj);
            }
        }
        
        var summary = t.matchSummary();
        setTimeout(function (t) {
            t.broadcastGameInfo({
                action: 'gameover'
            }, null, t.matchSummaryLang, true);
            t.terminate();
        }, 8000, t);
    } else {
        pauseSeconds += Config.PAUSE_SECONDS_BETWEEN_ROUND;
        t.game = null;
        t.status = 'break';
        t.actionPlayerIdx = -1;
        t.resumeTime = (new Date()).getTime() + pauseSeconds * 1000;
        t.goPause(pauseSeconds);
    }
}

function procAfterPause(t) {
    t.onPause = false;
    if (t.game != null) {
        if (t.game.stage === Game.PLAYING_STAGE) {
            t.actionPlayerIdx = t.players.indexOf(t.game.leadingPlayer);
            t.players.forEach(function (p) {
                p.matchInfo.playedCards = '';
                p.matchInfo.alert = null;
            });
            t.broadcastGameInfo({
                action: 'play',
                next: t.actionPlayerIdx + 1
            });
        } else {
            t.actionPlayerIdx = 0;
        }

        t.autoPlay(t.game.leadingPlayer && t.game.leadingPlayer.totalCardLeft() <= 1);
    } else {
        if (t.allRobots()) {
            t.status = 'pending';
            t.dismiss();
        } else {
            t.startGame();
        }
    }
}

Table.prototype.goPause = function (seconds) {
    if (this.autoTime != null) return;  // prevent multi timeout
    this.onPause = true;
    this.autoTimer = setTimeout(function (t) {
        t.autoTimer = null;
        procAfterPause(t);
    }, seconds * 1000, this);
};

Table.prototype.declareTrump = function () {
    if (this.autoTime != null) return;  // prevent multi timeout
    var player = this.game.contractor;
    var waitSeconds = this.ROBOT_SECONDS;
    if (player.sock != null) {
        if (player.isOut()) {
            waitSeconds *= 2;
        } else {
            waitSeconds = this.TIMEOUT_SECONDS * this.timerScale + ADD_SECONDS;
        }
    }

    this.autoTimer = setTimeout(function (t) {
        t.autoTimer = null;
        if (waitSeconds > 5)
            player.timeoutTimes++;
        procSetTrump(t, player.intendTrumpSuite);
    }, waitSeconds * 1000, this);
};

Table.prototype.buryCards = function () {
    if (this.autoTime != null) return;  // prevent multi timeout

    var player = this.game.contractor;
    var waitSeconds = this.ROBOT_SECONDS;
    if (player.sock != null) {
        if (player.isOut()) {
            waitSeconds *= 2;
        } else {
            waitSeconds = Table.TIMEOUT_SECONDS_BURYCARDS * this.timerScale + ADD_SECONDS;
        }
    }

    this.autoTimer = setTimeout(function (t) {
        t.autoTimer = null;
        if (waitSeconds > 5)
            player.timeoutTimes++;
        procBuryCards(t);
    }, waitSeconds * 1000, this);
};

Table.prototype.definePartner = function () {
    if (this.autoTime != null) return;  // prevent multi timeout

    var player = this.game.contractor;
    var waitSeconds = this.ROBOT_SECONDS;
    if (player.sock != null) {
        if (player.isOut()) {
            waitSeconds *= 2;
        } else {
            waitSeconds = this.TIMEOUT_SECONDS * this.timerScale + ADD_SECONDS;
        }
    }

    this.autoTimer = setTimeout(function (t) {
        t.autoTimer = null;
        if (waitSeconds > 5)
            player.timeoutTimes++;
        procDefinePartner(t);
    }, waitSeconds * 1000, this);
};

Table.prototype.broadcastGameInfo = function (json, exceptPlayer, langInfo, matchOver) {
    var t = this;
    this.players.forEach(function (p) {
        if (p === exceptPlayer) return;
        //if (p.currentTable !== t) return;
        if (langInfo != null) {
            var jsonMsg = Object.assign(Object.assign({}, json), langInfo[p.lang]);
            if(matchOver && t.playerRecord[p.id] != null) {
                if(t.playerRecord[p.id].winning != null) jsonMsg.summary += '\n' + t.playerRecord[p.id].winning;
            }
            p.pushJson(jsonMsg);
        } else {
            p.pushJson(json);
        }
    });

    this.visiters.forEach(function (p) {
        if(p.sock == null || p.sock.destroyed || p.currentTable !== t) {
            t.removeVisiter(p);
            return;
        }
        if (langInfo != null) {
            p.pushJson(Object.assign(Object.assign({}, json), langInfo[p.lang]));
        } else {
            p.pushJson(json);
        }
    });
};

Table.prototype.broadcastMessage = function (langMessage, args) {
    var t = this;
    this.players.forEach(function (p) {
        //if (p.currentTable !== t) return;
        p.sendMessage(args ? langMessage[p.lang].format(args) : langMessage[p.lang]);
    });

    this.visiters.forEach(function (p) {
        p.sendMessage(args ? langMessage[p.lang].format(args) : langMessage[p.lang]);
    });
};

Table.prototype.processPlayerAction = function (player, json) {
    if (player !== this.players[this.actionPlayerIdx]) {
        if (json.action === 'robot' && json.on == 1) player.timeoutTimes = 9;
        player.pushJson({action: 'ack'});   // prevent client connection check error
        return;    // late response
    }
    
    clearTimeout(this.autoTimer);
    this.autoTimer = null;

    switch (json.action) {
        case 'robot':
            if (json.on == 1) {
                player.timeoutTimes = 9;
            } else {
                player.pushJson({action: 'ack'});
            }
            this.autoPlay(true);
            break;
        case 'bid':
            if (this.game.stage !== Game.BIDDING_STAGE) {
                this.autoPlay(true);
                return;
            }
            var lastBid = json.bid;
            if (player.matchInfo.lastBid === 'pass') {
                // this should never happen
                Mylog.log('Severe bug: passed player bid again');
                this.rotatePlayer();
                findNextActivePlayer(this);
                this.autoPlay();
                return;
            }

            if (lastBid !== 'pass') {
                if (lastBid < this.game.contractPoint) {
                    this.game.contractPoint = lastBid;
                    this.game.contractor = player;
                } else {
                    lastBid = 'pass';
                }
            }
            player.matchInfo.lastBid = lastBid;

            procAfterBid(this);

            break;

        case 'trump':
            if (player !== this.game.contractor && this.game.trump != null) {
                this.autoPlay(true);
                return;
            }
            procSetTrump(this, json.trump);
            break;

        case 'bury':
            if (player !== this.game.contractor) {
                this.autoPlay(true);
                return;
            }
            procBuryCards(this, json.cards);
            break;

        case 'partner':
            if (player !== this.game.contractor) {
                this.autoPlay(true);
                return;
            }
            procDefinePartner(this, json.def);
            break;

        case 'play':
            if (this.game.stage !== Game.PLAYING_STAGE) {
                this.autoPlay(true);
                return;
            }
            procPlayCards(this, json.cards);
            break;

        default:
            player.pushData();
            this.autoPlay(true);
            break;
    }
};

Table.prototype.getSeat = function (player) {
    if (player == null)
        return -1;
    return this.players.indexOf(player) + 1;    // 1->6
};

// check mission status
Table.prototype.missionAdjust = function (matchInfo) {
    var adj = 0;
    if(this.options.missionOn && !matchInfo.missionDone && matchInfo.contracts < 2) {
        adj = matchInfo.contracts > 0 ? -1 : -3;
        matchInfo.missionDone = true;
    }
    return adj;
};

Table.prototype.getNextRank = function (matchInfo, delta) {
    var rank = matchInfo.currentRank;
    var idx = this.matchType.ranks.indexOf(rank);
    var maxIdx = this.matchType.ranks.length - 1;
    if (idx < 0) return -1;
    var nextIdx = idx + delta;
    if (nextIdx < 0) return nextIdx;
//        nextIdx = 0;
    if (nextIdx > maxIdx) {
        nextIdx += this.missionAdjust(matchInfo);
        if(nextIdx > maxIdx) {
            return this.matchType.ranks[maxIdx] + nextIdx - maxIdx;
        }
    }

    return this.matchType.ranks[nextIdx];
};

Table.prototype.updatePlayerRecord = function (playerId, tblPlayer) {
    if(this.coins < 1) return;

    if(tblPlayer) {
        if(this.playerRecord[playerId]) {
            this.playerRecord[playerId].tblPlayer = tblPlayer;
        } else {
            this.playerRecord[playerId] = {
                tblPlayer: tblPlayer,
                deducted: false,  // whether deducted the match fee
                games: {}
            };
            if(tblPlayer.property && tblPlayer.property.account_id) {
                this.playerRecord[playerId].account_id = tblPlayer.property.account_id;
            }
        }
    } else {
        if(this.playerRecord[playerId] == null) {
            Mylog.log('EXCEPTION: missing playerRecord: ' + playerId);
            return;
        }
    }
    
    if(this.game && this.game.cardNumberPlayed <= Config.MAX_CARDS_PER_GAME_REWORD) {
        var gm = this.games.length;
        if(this.playerRecord[playerId].games[gm]) return;
        this.playerRecord[playerId].games[gm] = true;
        if(this.playerRecord[playerId].deducted) return;
        
        var gmPlayed = Object.keys(this.playerRecord[playerId].games).length;
        if(gmPlayed >= Config.MIN_GAMES_REWORD) {
            this.playerRecord[playerId].deducted = true;
            this.mainServer.myDB.updateAccount(playerId, Config.TRANSACTION.CONSUME, -this.coins);
            var sock = this.playerRecord[playerId].tblPlayer.sock;
            if(sock != null) {
                var player = Table.getOnlinePlayer(this.mainServer, sock);
                if(player) {
                    player.updateBalance(-this.coins);
                }
            }
        }
    }
};

Table.prototype.linkPlayer = function (player) {
    if(this.robots.length < 1) return false;
    var robot = this.robots.shift();
    robot.replaceRobot(player);
    this.mainServer.activePlayers[player.id] = robot;
    this.updatePlayerRecord(player.id, robot);
    return true;
};

Table.prototype.canJoin = function (player) {
    if(this.resumeReturnPlayer(player)) return true;

    player.alertMessage = Table.Messages.NoSeat[player.lang];  // MUST set player.alertMessage if return false 
    if(this.robots.length < 1) return false;

    var maxGame = this.matchType.maxGame;
    var gameLimit = maxGame > 10 ? maxGame / 3 : maxGame / 2;
//    if(this.coins > 0 && this.games.length > gameLimit) {
//        player.alertMessage = Table.Messages.JoinTooLate[player.lang];
//        return false;
//    }

    var maxRank = this.matchType.ranks[0];
    for(var x=0,p; p=this.players[x]; x++) {
        if(p.matchInfo.currentRank > maxRank) {
            maxRank = p.matchInfo.currentRank;
        }
    }
//    var maxIndex = Math.floor(this.matchType.ranks.length / 2);
    var maxIndex = this.matchType.ranks.length;
    if(maxIndex >= Table.MATCH_TYPE.HALF.ranks.length) {
        maxIndex -= 3;  // max rank: Q
    } else {
        maxIndex -= 2;  // max rank: K
    }
    
    if(this.coins > 0 && this.playerRecord[player.id] == null && maxRank >= this.matchType.ranks[maxIndex]) {
        player.alertMessage = Table.Messages.TableCloseEnd[player.lang];
        return false;
    }

    var watchTable = player.currentTable;
    var orgPlayer = player;
    
    var robot;
    if(this.playerRecord[player.id] != null) {
        robot = this.playerRecord[player.id].tblPlayer;
        var idx = this.robots.indexOf(robot);
        if(idx < 0) {
            // occupied by other player
            robot = this.robots.shift();
        } else {
            this.robots.splice(idx, 1);
        }
    } else {
        robot = this.robots.shift();
    }

    robot.replaceRobot(player);
    this.mainServer.activePlayers[player.id] = player = robot;
    if(!this.resume(player)) {
        player.alertMessage = Table.Messages.TableEnded[player.lang];
        return false;
    }
    
    this.updatePlayerRecord(player.id, robot);

    if(watchTable != null) {
        watchTable.removeVisiter(orgPlayer);
    }
    
    var pName = this.playerNameWithAddon(player);

    this.broadcastGameInfo({action: 'in', name: pName, seat: this.getSeat(player)}, player);
    this.broadcastMessage(Table.Messages.PlayerIn, player.name);
    return true;
};

Table.prototype.playerNameWithAddon = function (player) {
    var pName = player.name;
    if(this.options.missionOn && !player.matchInfo.missionDone) {
        if(player.matchInfo.contracts === 0) {
            pName += '(-3)';
        } else if(player.matchInfo.contracts === 1) {
            pName += '(-1)';
        }
    }
    return pName;
};

Table.prototype.resumeReturnPlayer = function (player) {
    var orgPlayer = player;
    var robot = null;
    if(this.playerRecord[player.id] != null) {
        if(this.robots.length < 1) return false;
        robot = this.playerRecord[player.id].tblPlayer;
        var idx = this.robots.indexOf(robot);
        if(idx < 0) {
            // occupied by other player
            robot = this.robots.shift();
        } else {
            this.robots.splice(idx, 1);
        }
    } else {
        if(player.property.account_id) {
            for(pid in this.playerRecord) {
                tPlayer = this.playerRecord[pid].tblPlayer;
                if(this.playerRecord[pid].account_id === player.property.account_id) {
                    if(tPlayer.id == null || tPlayer.id === pid) {
                        robot = tPlayer;
                        this.mainServer.removePlayer(tPlayer);
                    } else {
                        // occupied by other player
                        if(this.robots.length < 1) return false;
                        robot = this.robots.shift();
                    }
                    this.playerRecord[player.id] = this.playerRecord[pid];
                    delete this.playerRecord[pid];
                    break;
                }
            }
            if(robot == null) return false;
        } else {
            return false;
        }
    }
    
    robot.replaceRobot(player);
    this.mainServer.activePlayers[player.id] = player = robot;
    if(!this.resume(player)) {
        return false;
    }
    
    if(orgPlayer.currentTable != null) {
        orgPlayer.currentTable.removeVisiter(orgPlayer);
    }

    return true;
};

Table.createTable = function(player, category, o) {
    if(category == null || category == '') category = 'novice';
    category = category.toUpperCase();
    var coins = 0;
    var tabCat = Table.CATEGORY[category];
    if(tabCat) coins = tabCat.coins;
    if(!player.checkBalance(coins)) return;
    
    var mServer = player.mainServer;
    var mType = Table.MATCH_TYPE[o.tableType];
    if (mType == null) {
//        mType = Table.MATCH_TYPE.FREE;
        mType = Table.MATCH_TYPE[Config.tableType];
    }

    if (mServer.allTables[category].length >= Config.TABLE_LIMIT[category]) {
        player.sendNotification(Table.Messages.AllTableFull);
        return null;
    }
    
    var table = new Table({matchType: mType, allowJoin: o.private ? false: (o.allowJoin == null ? true : o.allowJoin),
        showMinBid: o.showMinBid}, mServer, category);
    var tblOpt = table.getDefaultOption();
    if(o.option) tblOpt += ',' + o.option;
    table.setOptions(tblOpt);
    table.coins = coins;
    if(coins > 0) table.prizePoolScale = tabCat.prizePoolScale;
    mServer.allTables[category].push(table);
//    table.addPlayer(player);

    var robot;
    for (var x = 0; x < SEAT_NUMBER; x++) {
        robot = new Player(null, mServer);
        table.addPlayer(robot, true);
    }
    
    if(o.private) setTableCode(table);

    table.initPlayerStatus();
    table.linkPlayer(player);
    Mylog.log(new Date().toLocaleString() + ', ' + mType.title + ' table created, total tables ('
        + category + '): ' + Object.keys(mServer.allTables[category]).length);
    return table;
};

Table.joinPlayer = function(player, category) {
    if(category == null || category == '') category = 'novice';
    category = category.toUpperCase();
    var mServer = player.mainServer;

    if(player.currentTable != null) {
        player.currentTable.removeVisiter(player);
    }
    switch(category) {
        case 'PRACTICE':
            var lenTables = mServer.allTables[category].length;
            if (lenTables > 0) {
                var lastTable = mServer.allTables[category][lenTables-1];
                if(lastTable.allowJoin && lastTable.canJoin(player)) return;
            }
            if (lenTables >= Config.TABLE_LIMIT[category]) {
                player.sendNotification(Table.Messages.AllTableFull);
                return;
            }

            var table = Table.createTable(player, category, {
                tableType: 'FREE', allowJoin: true, showMinBid: true
            });
//            table.startGame();
            Table.delayStart(table, 0, player);
            return;
        case 'NOVICE':
        case 'INTERMEDIATE':
        case 'ADVANCED':
            break;            
        default:
            Mylog.log("category= " + category);
            return;
    }

    if (!player.premium && !player.property.member) {
        player.sendNotification(Config.MEMBERSHIP);
        return;
    }

    var coins = Table.CATEGORY[category].coins;
    if(!player.checkBalance(coins)) return;

    var avlTables = mServer.allTables[category];
    for(var x=avlTables.length-1, t; x>=0 && (t=avlTables[x]); x--) {
        if(!t.allowJoin || t.passCode > 0) continue;
        if(t.canJoin(player)) return;
    }

    if (avlTables.length >= Config.TABLE_LIMIT[category]) {
        player.sendNotification(Table.Messages.AllTableFull);
        return;
    }

    var table = Table.createTable(player, category, {
        tableType: Config.tableType, allowJoin: true, showMinBid: false
    });

    var waitSeconds = getSecondsToNextSyncTable();
    if(waitSeconds < 0) waitSeconds = Config.START_WAIT_SECONDS;

    Table.delayStart(table, waitSeconds, player);
};

Table.delayStart = function(table, waitSeconds, player) {
    if(waitSeconds <= 0) {
        waitSeconds = 5;  // wait 5 seconds by default
//        table.startGame();
//        return;
    }
    var mServer = table.mainServer;
    table.status = 'break';
    table.actionPlayerIdx = -1;
    table.resumeTime = (new Date()).getTime() + waitSeconds * 1000;
    table.resume(mServer.activePlayers[player.id]);
    table.goPause(waitSeconds);
};

Table.joinTable = function(player, json, tblPlayer) {
    var mServer = player.mainServer;
    var table;
    if(json.pass) {
        table = mServer.protectedTables[json.pass];
        if(table == null) {
            player.sendMessage(Table.Messages.WrongPass[player.lang]);
            return;
        }
        if(table.dismissed) {
            player.sendMessage(Table.Messages.TableEnded[player.lang]);
            Table.pushTableList(player);
            return;
        }
    } else if(json.tid) {
        if(json.tid.startsWith('G')) {
            player.sendMessage(Table.Messages.InvalidPlayer[player.lang]);
            return;
        }
        table = mServer.tableListById[json.tid];
        if(table == null || table.dismissed) {
            player.sendMessage(Table.Messages.TableEnded[player.lang]);
            Table.pushTableList(player);
            return;
        }
        if(table.passCode > 0 && table.passcode != json.pass) {
            player.sendMessage(Table.Messages.WrongPass[player.lang]);
            return;
        }
    } else {
        return;
    }

    if (tblPlayer) {
        if(table === tblPlayer.currentTable) {
            tblPlayer.sock = player.sock;
            table.resume(tblPlayer);
            return;
        }
        tblPlayer.toRobot(-1);
    }

    if(table.resumeReturnPlayer(player)) return;  // possible same user switch device
    
    if(!player.checkBalance(table.coins)) return;    
    if(!table.canJoin(player)) {
        player.sendMessage(player.alertMessage);
    }
};

Table.watchTable = function(player, tid) {
    if(tid.startsWith('G')) {
        Group.proceedGroup(player, tid.substring(1));
        return;
    }
    var mServer = player.mainServer;
    var tableList = mServer.tableListById;
    var table = tableList[tid];
    if(table == null || table.dismissed) {
        player.sendMessage(Table.Messages.TableEnded[player.lang]);
        Table.pushTableList(player);
        return;
    }

    if(table.resumeReturnPlayer(player)) return;
    
    table.broadcastMessage(Table.Messages.PlayerWatching, player.name);
    player.pushData(table);

    table.addVisiter(player);
};

Table.pushTableList = function(player) {
    var mServer = player.mainServer;
    var json = {action: 'list', category: ''};
    
    var players = Object.keys(mServer.activePlayers);
    if(players.length > 0) {
        var tables = Object.keys(mServer.tableListById);
        json.stat = players.length + ' player' + (players.length>1 ? 's' : '') + ', ' 
                  + tables.length + ' table' + (tables.length>1 ? 's' : ''); 
    }

    var first = true, cat;
    for(k in Table.CATEGORY) {
        if(first) {
            first = false;
        } else {
            json.category += ',';
        }
        cat = Table.CATEGORY[k];
        json.category += k + '|' + cat[player.lang] + '|' + cat.icon + '|' + cat.coins;
        if(Config.TABLE_OPTION[k] != null) json.category += '|' + Config.TABLE_OPTION[k];
        writeTableList(player, json, k, mServer.allTables[k]);
    }

    Group.listGroups(player, json, 'INTERMEDIATE', mServer.groups);
    if(player.property.account_id) {
        json.coin = player.property.coins;
    }

    //Mylog.log(JSON.stringify(json));
    player.pushJson(json);
};

Table.getOnlinePlayer = function(mainServer, sock){
    var sockId = sock.remoteAddress + ':' + sock.remotePort;
    return mainServer.onlinePlayers[sockId];
};

function writeTableList(player, json, k, tables) {
    if(tables.length < 1) return;
    json[k] = '';
    for(var x=0,idx=tables.length-1,t,tk; idx>=0 && x<Config.MAX_LIST_TABLES; x++,idx--) {
        t = tables[idx];
        if(t.id == null || t.group_id) continue;
        if(json[k].length>0) json[k] += ',';
        tk = (t.passCode > 0 ? 'L' : 'P') + t.id;  // L: private, P: public
        json[k] += tk;
        json[tk] = t.matchType.brief + ': ' + t.realPlayerNames() + '; '
                  + Table.Messages.GameNumber[player.lang].format(t.games.length);
    }
}

function getSecondsToNextSyncTable() {
    var dt = new Date();
    var minutes = dt.getHours() * 60 + dt.getMinutes();
    for(var x=0, n=Config.SYNC_TABLE_TIME.length, delta; x<n; x++) {
        delta = Config.SYNC_TABLE_TIME[x] - minutes;
        if(delta > 0 && delta <= Config.SYNC_TABLE_WAIT_MINUTE) {
            var seconds = delta * 60 - dt.getSeconds();
            return seconds;
        }
    }

    return -1;
}

function setTableCode(t) {
    if(t.mainServer == null) return;
    var maxCode = 9999;
    var minCode = 1000;
    var tabCode;
    do {
        tabCode = Math.floor(Math.random() * maxCode);
        if(tabCode < minCode) tabCode += minCode;
    } while(t.mainServer.protectedTables[tabCode] != null);

    t.mainServer.protectedTables[tabCode] = t;
    t.passCode = tabCode;
}

// record match info per player
function MatchInfo(t, player) {
    this.player = player;
    this.currentRank = t.matchType.ranks[0];
    this.lastBid = '-';   // last bid points, -: no bid yet, pass: not bid, number means bid point
    this.points = 0;    // points collected (before contractor's partner appears)
    this.contracts = 0; // contract times
    this.playedCards = ''; // cards played
    this.alert = null;
    this.penalty = null;
    this.totalPenalty = 0;
    this.missionDone = false;

    this.reset = function () {
        // call reset when start a new game
        this.lastBid = '-';
        this.points = 0;
        this.playedCards = '';
        this.alert = null;
        this.penalty = null;
        this.totalPenalty = 0;
        if (this.player.messageTimer) {
            clearTimeout(this.player.messageTimer);
            this.player.messageTimer = null;
        }

        this.player.voids = {};
    };

    this.toJson = function (seat) {
        var pName = this.player.name;
        if(t.options.missionOn && !this.missionDone) {
            /*if(this.contracts < 2) {
                pName += '|\u0f1d';
                if(this.contracts < 1) {
                    pName += '\u0f1e';
                }
            }*/
            if(this.contracts === 0) {
                pName += '(-3)';
            } else if(this.contracts === 1) {
                pName += '(-1)';
            }
        }
        if (this.player.id != null && this.player.sock == null) {
            pName += '(away)';
        }
        var json = {
            name: pName,
            seat: seat,
            rank: this.currentRank,
            contracts: this.contracts
        };

        if (t.game != null) {
            if (t.game.stage === Game.PLAYING_STAGE) {
                if(t.game.currentRound) {
                    var leadingHand = t.game.currentRound.getLeadingHand();
                    var leadingPlayer = leadingHand ? leadingHand.player : t.game.leadingPlayer;
                    if (leadingPlayer === this.player) {
                        json.lead = 1;
                    }
                }
                json.cards = this.playedCards;
                json.pt1 = this.points;
                if (this.penalty != null) json.penalty = this.penalty;
            } else {
                json.bid = this.lastBid;
            }
            json.cnum = this.player.totalCardLeft();  //card number in hand
        }
        return json;
    };
}
