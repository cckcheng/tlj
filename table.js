module.exports = Table;

var Player = require('./player');
var Game = require('./game');
var Card = require('./card');
var Deck = require('./deck');

const SEAT_NUMBER = 6;
const DECK_NUMBER = 4;
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
    EXPRESS: {
        title: 'Express(10->A)',
        ranks: [10, 11, 12, 13, 14]
    }
};

Table.prototype.seatAvailable = function () {
    return this._positions.length > 0;
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
    var game = new Game(this.players, this.deckNumber);
    this.games.push(game);
    for (var x = 0, p; p = this.players[x]; x++) {
        if (p.currentRank == null) p.currentRank = this.matchType.ranks[0];
        p.pushData();
    }
};

Table.prototype.getSeat = function (player) {
    return this.players.indexOf(player);
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