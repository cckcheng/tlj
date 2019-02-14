module.exports = Table;

var Player = require('./player');
var Card = require('./card');
const {Game, Hand, SimpleHand} = require('./game');

Table.Debugging = false;
Table.FastMode = false;
Table.HOLE_POINT_TIMES = 4;

const SEAT_NUMBER = 6;
const DECK_NUMBER = 4;
const ADD_SECONDS = 2;
const PENDING_SECONDS = 5;
const PAUSE_SECONDS_BETWEEN_GAME = 300;

function Table(o) {
    this.players = new Array(SEAT_NUMBER);
    this._positions = [];
    var pos = 0;
    while (pos < SEAT_NUMBER) {
        this._positions.push(pos++);
    }

    if (o && o.matchType) {
        this.matchType = o.matchType;
    } else {
        this.matchType = Table.MATCH_TYPE.FULL;
    }

    this.deckNumber = o.deckNumber || DECK_NUMBER;

    this.games = [];

    this.TIMEOUT_SECONDS = Table.FastMode ? 8 : 30;     // default: 32 seconds (30s for client side + 2s)
    this.ROBOT_SECONDS = Table.FastMode ? 1 : 2;
}

Table.MATCH_TYPE = {
    FULL: {
        title: 'Full(2->A)',
        ranks: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
    },
    HALF: {
        title: 'Half(8->A)',
        ranks: [8, 9, 10, 11, 12, 13, 14]
    },
    POINTS: {
        title: 'All Points(5/10/K)',
        ranks: [5, 10, 13, 14]
    },
    FREE: {
        title: 'Free(2->5)',
        ranks: [2, 3, 4, 5]
    },
    EXPRESS: {
        title: 'Express(10->A)',
        ranks: [10, 11, 12, 13, 14]
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

Table.prototype.dismiss = function (activePlayers, playerId) {
    if(this.autoTimer != null) {
        clearTimeout(this.autoTimer);
        this.autoTimer = null;
    }
    var pauseMinutes = Table.Debugging ? (Table.FastMode ? 2 : 5) : 30;  // 5(or 2) minutes, set to 30 minutes when release
    this.pauseTimer = setTimeout(function (t) {
        t.pauseTimer = null;
        for (var x = 0, p; x < t.players.length; x++) {
            p = t.players[x];
            if (p == null)
                continue;
            p.currentTable = null;
        }

        console.log('table dismissed');
        t.dismissed = true;
        delete activePlayers[playerId];
    }, pauseMinutes * 60000, this);
};

Table.prototype.resume = function (player) {
    if(this.pauseTimer != null) {
        clearTimeout(this.pauseTimer);
        this.pauseTimer = null;
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
    } else {
        if (player && player === this.players[this.actionPlayerIdx]) {
            if (this.autoTimer != null) {
                this.autoTimer.refresh();
            }
        }
    }
};

Table.prototype.addPlayer = function (player) {
    if (this._positions.length < 1) {
        // no seat available
        return false;
    }

    if (this.players.indexOf(player) >= 0) {
        console('already in this table');
        return true;
    }

    var pos = Math.floor(Math.random() * (this._positions.length));
    this.players[this._positions[pos]] = player;
    this._positions.splice(pos, 1);
    player.currentTable = this;
    return true;
};

Table.prototype.startGame = function (testOnly) {
    this.game = new Game(this.players, this.deckNumber);
    this.games.push(this.game);
//    debugger;
    if (this.games.length === 1) {
        // first game, init match info
        for (var x = 0, p; p = this.players[x]; x++) {
            p.matchInfo = new MatchInfo(this, p);
        }
    } else {
        shuffleArray(this.players);
        // init game info
        for (var x = 0, p; p = this.players[x]; x++) {
            p.matchInfo.lastBid = '-';
            p.matchInfo.points = 0;
        }
    }

    this.actionPlayerIdx = 0;
    for (var x = 0, p; p = this.players[x]; x++) {
        p.evaluate();
        p.pushData();
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

Table.prototype.autoPlay = function () {
    if (this.autoTime != null) return;  // prevent multi timeout
    if (this.actionPlayerIdx < 0) {
        procAfterPause(this);
        return;
    }

//    console.log('actionPlayerIdx: ' + this.actionPlayerIdx);
    var player = this.players[this.actionPlayerIdx];
    var waitSeconds = this.ROBOT_SECONDS;
    if (player.sock != null) {
        if (player.isOut()) {
            waitSeconds *= 2;
        } else {
            waitSeconds = this.TIMEOUT_SECONDS + ADD_SECONDS;
        }
    }

    this.autoTimer = setTimeout(function (t) {
        t.autoTimer = null;
        if (waitSeconds > 5)
            player.timeoutTimes++;
        if (t.game.stage === Game.BIDDING_STAGE) {
            var currentPlayer = t.players[t.actionPlayerIdx];
            if (currentPlayer.canBid && currentPlayer.minBid < t.game.contractPoint) {
//                console.log('minBid=' + currentPlayer.minBid + ',contractPoint ' + t.game.contractPoint);
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
    this.declareTrump();
};

function procSetTrump(t, trump) {
    t.game.setTrump(trump);
    t.broadcastGameInfo({
        action: 'set_trump',
        seat: t.actionPlayerIdx + 1,
        gameRank: t.game.rank,
        contract: t.game.contractPoint,
        acttime: t.TIMEOUT_SECONDS * 5,
        trump: t.game.trump
    });

    t.game.contractor.pushJson({
        action: 'add_remains',
        cards: Card.cardsToString(t.game.deck.remains),
        acttime: t.TIMEOUT_SECONDS * 5     // more action time when bury hole cards
    });

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
    t.autoPlay();
}

function procPlayCards(t, cards) {
    var player = t.players[t.actionPlayerIdx];
    var status = player.playCards(cards);
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
                    if (p.matchInfo.points < 0) game.collectedPoint -= p.matchInfo.points;
                } else {
                    game.collectedPoint += p.matchInfo.points;
                }
                p.matchInfo.points = 0;
            }
        }
    }

    if (player.matchInfo.alert != null) {
        json.alert = player.matchInfo.alert;
    }
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

        t.goPause(PENDING_SECONDS);
    } else {
        t.rotatePlayer();
        json.next = t.actionPlayerIdx + 1
        t.broadcastGameInfo(json);
        t.autoPlay();
    }
}

function gameOver(t) {
    var summary = '';
    var holeCardsPoint = Card.getTotalPoints(t.game.holeCards);
    if (holeCardsPoint > 0) {
        var leadPlayer = t.game.currentRound.getNextLeadingPlayer();
        if (leadPlayer !== t.game.contractor && leadPlayer != t.game.partner) {
            var times = Table.HOLE_POINT_TIMES * t.game.currentRound.maxSubHandLength();
            var holePoints = holeCardsPoint * times;
            leadPlayer.addPoints(holePoints);
            summary += '闲家抠底，底分翻' + times + '倍,共' + holePoints + '\n\n';
        }
    }

    summary += t.game.promote();
    t.broadcastGameInfo({
        action: 'gameover',
        hole: Card.cardsToString(t.game.holeCards),
        summary: summary
    });
    t.game = null;
    t.goPause(PAUSE_SECONDS_BETWEEN_GAME);
}

function procAfterPause(t) {
    t.onPause = false;
    if (t.game != null) {
        if (t.game.stage === Game.PLAYING_STAGE) {
            t.actionPlayerIdx = t.players.indexOf(t.game.leadingPlayer);
            t.players.forEach(function (p) {
                p.matchInfo.playedCards = '';
            });
            t.broadcastGameInfo({
                action: 'play',
                next: t.actionPlayerIdx + 1
            });
        } else {
            t.actionPlayerIdx = 0;
        }
        t.autoPlay();
    } else {
        t.startGame();
    }
}

Table.prototype.goPause = function (seconds) {
    this.onPause = true;
    this.autoTimer = setTimeout(function (t) {
        t.autoTimer = null;
        procAfterPause(t);
    }, seconds * 1000, this);
};

Table.prototype.declareTrump = function () {
    var player = this.game.contractor;
    var waitSeconds = this.ROBOT_SECONDS;
    if (player.sock != null) {
        if (player.isOut()) {
            waitSeconds *= 2;
        } else {
            waitSeconds = this.TIMEOUT_SECONDS + ADD_SECONDS;
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
    var player = this.game.contractor;
    var waitSeconds = this.ROBOT_SECONDS;
    if (player.sock != null) {
        if (player.isOut()) {
            waitSeconds *= 2;
        } else {
            waitSeconds = this.TIMEOUT_SECONDS * 5 + ADD_SECONDS;
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
//    debugger;

    var player = this.game.contractor;
    var waitSeconds = this.ROBOT_SECONDS;
    if (player.sock != null) {
        if (player.isOut()) {
            waitSeconds *= 2;
        } else {
            waitSeconds = this.TIMEOUT_SECONDS + ADD_SECONDS;
        }
    }

    this.autoTimer = setTimeout(function (t) {
        t.autoTimer = null;
        if (waitSeconds > 5)
            player.timeoutTimes++;
        procDefinePartner(t);
    }, waitSeconds * 1000, this);
};

Table.prototype.broadcastGameInfo = function (json, exceptPlayer) {
    this.players.forEach(function (p) {
        if(p === exceptPlayer) return;
        p.pushJson(json);
    });
};

Table.prototype.processPlayerAction = function (player, json) {
    if (player !== this.players[this.actionPlayerIdx])
        return;    // late response

    clearTimeout(this.autoTimer);
    this.autoTimer = null;

    switch (json.action) {
        case 'bid':
            if (this.game.stage !== Game.BIDDING_STAGE)
                return;
            var lastBid = json.bid;
            if (player.matchInfo.lastBid === 'pass') {
                // this should never happen
                console.log('Severe bug: passed player bid again');
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
            if (player !== this.game.contractor && this.game.trump != null)
                return;
            procSetTrump(this, json.trump);
            break;

        case 'bury':
            if (player !== this.game.contractor)
                return;
            procBuryCards(this, json.cards);
            break;

        case 'partner':
            if (player !== this.game.contractor)
                return;
            procDefinePartner(this, json.def);
            break;

        case 'play':
            if (this.game.stage !== Game.PLAYING_STAGE)
                return;
            procPlayCards(this, json.cards);
            break;
    }
};

Table.prototype.getSeat = function (player) {
    if (player == null)
        return -1;
    return this.players.indexOf(player) + 1;    // 1->6
};

Table.prototype.getNextRank = function (rank, delta) {
    var idx = this.matchType.ranks.indexOf(rank);
    var maxIdx = this.matchType.ranks.length - 1;
    if (idx < 0)
        return -1;
    var nextIdx = idx + delta;
    if (nextIdx < 0)
        nextIdx = 0;
    if (nextIdx > maxIdx) {
        return this.matchType.ranks[maxIdx] + nextIdx - maxIdx;
    }

    return this.matchType.ranks[nextIdx];
};

function shuffleArray(arr) {
    if (arr == null)
        return;
    for (var x = 0; x < arr.length; x++) {
        var idx = Math.floor(Math.random() * arr.length);
        if (idx === x)
            continue;
        var tmp = arr[x];
        arr[x] = arr[idx];
        arr[idx] = tmp;
    }
}

// record match info per player
function MatchInfo(t, player) {
    this.player = player;
    this.currentRank = t.matchType.ranks[0];
    this.lastBid = '-';   // last bid points, -: no bid yet, pass: not bid, number means bid point
    this.points = 0;    // points collected (before contractor's partner appears)
    this.contracts = 0; // contract times
    this.playedCards = ''; // cards played

    this.toJson = function (seat) {
        var json = {
            seat: seat,
            rank: this.currentRank,
            contracts: this.contracts
        };

        if (t.game != null) {
            if (t.game.stage === Game.PLAYING_STAGE) {
                json.cards = this.playedCards;
                json.pt1 = this.points;
                if (this.penalty != null) json.penalty = this.penalty;
            } else {
                json.bid = this.lastBid;
            }
        }
        return json;
    };
}
