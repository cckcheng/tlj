var Card = require('./card');
var Table = require('./table');

module.exports = Player;

function Player(o) {
    if (o) {
        this.id = o.id;
        this.sock = o.sock;
    }
    this.spades = [];
    this.hearts = [];
    this.diamonds = [];
    this.clubs = [];
    this.trumps = [];

    this.currentTable = null;
    this.matchInfo = null;

    this.replaceRobot = function (id, sock) {
        this.id = id;
        this.sock = sock;
    };

    this.toRobot = function () {
        this.sock = null;
    };
}

Player.prototype.newHand = function () {
    this.spades = [];
    this.hearts = [];
    this.diamonds = [];
    this.clubs = [];
    this.trumps = [];
};

Player.prototype.addCard = function (card) {
    switch (card.suite) {
        case Card.SUITE.SPADE:
            this.spades.push(card);
            break;
        case Card.SUITE.CLUB:
            this.clubs.push(card);
            break;
        case Card.SUITE.HEART:
            this.hearts.push(card);
            break;
        case Card.SUITE.DIAMOND:
            this.diamonds.push(card);
            break;
        default:
            this.trumps.push(card);
            break;
    }
};

Player.prototype.removeCard = function (card) {
    var x = this.trumps.indexOf(card);
    if (x >= 0) {
        this.trumps.splice(x, 1);
        return;
    }
    switch (card.suite) {
        case Card.SUITE.SPADE:
            x = this.spades.indexOf(card);
            if (x >= 0) this.spades.splice(x, 1);
            break;
        case Card.SUITE.CLUB:
            x = this.clubs.indexOf(card);
            if (x >= 0) this.clubs.splice(x, 1);
            break;
        case Card.SUITE.HEART:
            x = this.hearts.indexOf(card);
            if (x >= 0) this.hearts.splice(x, 1);
            break;
        case Card.SUITE.DIAMOND:
            x = this.diamonds.indexOf(card);
            if (x >= 0) this.diamonds.splice(x, 1);
            break;
    }
};

Player.prototype.sortHand = function () {
    this.trumps.sort(Card.compare);
    this.spades.sort(Card.compare);
    this.hearts.sort(Card.compare);
    this.clubs.sort(Card.compare);
    this.diamonds.sort(Card.compare);
};

Player.prototype.resortCards = function (trump_suite, game_rank) {
    function moveCardToTrump(trumpCollection, suiteCollection) {
        for (var x = suiteCollection.length - 1, c; x >= 0 && (c = suiteCollection[x]); x--) {
            if (c.rank === game_rank || c.suite === trump_suite) {
                trumpCollection.push(c);
                suiteCollection.splice(x, 1);
            }
        }
    }

    moveCardToTrump(this.trumps, this.spades);
    moveCardToTrump(this.trumps, this.hearts);
    moveCardToTrump(this.trumps, this.diamonds);
    moveCardToTrump(this.trumps, this.clubs);

    this.trumps.sort(function (a, b) {
        var aRank = a.trumpRank(trump_suite, game_rank);
        var bRank = b.trumpRank(trump_suite, game_rank);
        if (aRank === bRank) return a.suite === b.suite ? 0 : (a.suite > b.suite ? 1 : -1);
        return aRank > bRank ? 1 : -1;
    });
};

Player.prototype.showHand = function () {
    var s = '';
    for (var x = this.trumps.length - 1; x >= 0; x--) {
        s += this.trumps[x].display();
    }
    s += '\n';
    for (var x = this.spades.length - 1; x >= 0; x--) {
        s += this.spades[x].display();
    }
    s += '\n';
    for (var x = this.hearts.length - 1; x >= 0; x--) {
        s += this.hearts[x].display();
    }
    s += '\n';
    for (var x = this.diamonds.length - 1; x >= 0; x--) {
        s += this.diamonds[x].display();
    }
    s += '\n';
    for (var x = this.clubs.length - 1; x >= 0; x--) {
        s += this.clubs[x].display();
    }
    s += '\n';

    return s;
};

Player.prototype.pushJson = function (json) {
    try {
        this.sock.write(JSON.stringify(json));
    } catch (err) {
    }
};

Player.prototype.pushData = function () {
    if (this.sock == null) return;

    var S = Card.getRanks(this.spades);
    var H = Card.getRanks(this.hearts);
    var D = Card.getRanks(this.diamonds);
    var C = Card.getRanks(this.clubs);
    var T = [];

    for (var x = 0, c; c = this.trumps[x]; x++) {
        switch (c.suite) {
            case Card.SUITE.SPADE:
                S.push(c.rank);
                break;
            case Card.SUITE.HEART:
                H.push(c.rank);
                break;
            case Card.SUITE.CLUB:
                C.push(c.rank);
                break;
            case Card.SUITE.DIAMOND:
                D.push(c.rank);
                break;
            default:
                T.push(c.rank);
                break;
        }
    }

    var seat = this.currentTable.getSeat(this);
    var playerInfo = [];
    var totalPlayer = this.currentTable.players.length;
    for (var count = totalPlayer - 1, p, x = seat; count > 0; count--, x++) {
        if (x >= totalPlayer) x -= totalPlayer;
        p = this.currentTable.players[x];
        playerInfo.push({
            seat: x + 1,
            rank: p.matchInfo.currentRank
        });
    }

    var json = {
        rank: this.matchInfo.currentRank,
        game: this.currentTable.games.length,
        seat: seat,
        players: playerInfo,
        S: S,
        H: H,
        D: C,
        C: D,
        T: T
    };

    try {
        this.sock.write(JSON.stringify(json));
    } catch (err) {
    }
};

Player.prototype.playCards = function (cards) {
    this.playedCards = cards;
    for (var x = 0, c; c = cards[x]; x++) {
        this.removeCard(c);
    }
};

Player.prototype.promote = function (delta) {
    this.matchInfo.currentRank = this.currentTable.getNextRank(this.matchInfo.currentRank, delta);
};

Player.prototype.sendMessage = function (msg) {
    var json = {
        message: msg
    };

    try {
        this.sock.write(JSON.stringify(json));
    } catch (err) {
    }
};
