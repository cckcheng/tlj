module.exports = Table;

var Player = require('./player');
var Game = require('./game');
var Card = require('./card');
var Deck = require('./deck');

Table.Debugging = false;
const SEAT_NUMBER = 6;
const DECK_NUMBER = 4;
const TIMEOUT = Table.Debugging ? 5 : 30;     // default: 30 seconds
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
        ranks: [2,3,4,5]
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
        if (p == null) continue;
        if (p.sock != null) return false;
    }

    return true;
};

Table.prototype.dismiss = function () {
    for (var x = 0, p; x < this.players.length; x++) {
        p = this.players[x];
        if (p == null) continue;
        p.currentTable = null;
    }
    clearInterval(this.rotateTimer);
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

Table.prototype.startGame = function () {
    this.game = new Game(this.players, this.deckNumber);
    this.games.push(this.game);
    debugger;
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
    for (var x = 0, p; p = this.players[x]; x++) {
        p.evaluate();
        p.pushData();
    }
    this.actionPlayerIdx = 0;

    function nextTurn(t) {
        t.actionPlayerIdx++;
        if (t.actionPlayerIdx >= SEAT_NUMBER) t.actionPlayerIdx -= SEAT_NUMBER;
//        console.log('nextTurn: ' + t.actionPlayerIdx);
//        game.nextPlayer();
        t.notifyPlayer(t.players[t.actionPlayerIdx], t.game.stage);
    }

    this.rotateTimer = setInterval(nextTurn, TIMEOUT * 1000, this);
};

Table.prototype.notifyPlayer = function (player, stage) {
    var json = {};
    switch (stage) {
        case Game.BIDDING_STAGE:
            json.action = 'bid';
            break;
        case Game.PLAYING_STAGE:
            json.action = 'play';
            break;
    }

    player.pushJson(json);
};

Table.prototype.processPlayerAction = function (player, json) {
    if (player != this.players[this.actionPlayerIdx]) return;    // late response
    if (json.game != this.games.length) teturn;  // not current game

    console.log('playerId: ' + player.id);
    this.actionPlayerIdx++;
    this.rotateTimer.refresh();
};

Table.prototype.getSeat = function (player) {
    return this.players.indexOf(player) + 1;    // 1->6
};

Table.prototype.getNextRank = function (rank, delta) {
    var idx = this.matchType.ranks.indexOf(rank);
    var maxIdx = this.matchType.ranks.length - 1;
    if (idx < 0) return -1;
    var nextIdx = idx + delta;
    if (nextIdx < 0) nextIdx = 0;
    if (nextIdx > maxIdx) {
        return this.matchType.ranks[maxIdx] + nextIdx - maxIdx;
    }

    return this.matchType.ranks[nextIdx];
};

function shuffleArray(arr) {
    if (arr == null) return;
    for (var x = 0; x < arr.length; x++) {
        var idx = Math.floor(Math.round(arr.length));
        if (idx === x) continue;
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

    this.toJson = function (seat) {
        return {
            seat: seat,
            rank: this.currentRank,
            bid: this.lastBid,
            points: this.points,
            contracts: this.contracts
        };
    };
}