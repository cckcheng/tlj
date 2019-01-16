var Card = require('./card');
var HandStat = require('./stat');
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
        iTrump: this.intendTrumpSuite ? this.intendTrumpSuite : '',
        minBid: Table.Debugging ? this.minBid : -1,
        players: playerInfo,
        S: S,
        H: H,
        D: D,
        C: C,
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

Player.prototype.evaluate = function () {
    debugger;
    var currentGameRank = this.matchInfo.currentRank;
    var honorPoints = 0;
    for (var x = 0, c; c = this.trumps[x]; x++) {
        if (c.rank === Card.RANK.BigJoker) {
            honorPoints += 4;
        } else if (c.rank === Card.RANK.SmallJoker) {
            honorPoints += 2;
        }
    }

    function totalGameRankCard(suite) {
        var n = 0;
        for (var x = 0, c; c = suite[x]; x++) {
            if (c.rank === currentGameRank) n++;
        }
        return n;
    }

    function trumpPoint(p, cSuite) {
        // evaluate the trump strongth for a given suite
        var iTrumps = [];
        for (var x = 0, c; c = p.trumps[x]; x++) {
            iTrumps.push(c);
        }
        for (var x = 0, c; c = p.spades[x]; x++) {
            if (c.suite === cSuite || c.rank === currentGameRank) iTrumps.push(c);
        }
        for (var x = 0, c; c = p.hearts[x]; x++) {
            if (c.suite === cSuite || c.rank === currentGameRank) iTrumps.push(c);
        }
        for (var x = 0, c; c = p.diamonds[x]; x++) {
            if (c.suite === cSuite || c.rank === currentGameRank) iTrumps.push(c);
        }
        for (var x = 0, c; c = p.clubs[x]; x++) {
            if (c.suite === cSuite || c.rank === currentGameRank) iTrumps.push(c);
        }

        var point = iTrumps.length / 3.0; // length point
        if (iTrumps.length > 14) {
            // extra length bonus
            var extra = iTrumps.length - 14;
            point += extra * extra * 0.1;
        }

        iTrumps.sort(function (a, b) {
            var aRank = a.trumpRank(cSuite, currentGameRank);
            var bRank = b.trumpRank(cSuite, currentGameRank);
            if (aRank === bRank) return a.suite === b.suite ? 0 : (a.suite > b.suite ? 1 : -1);
            return aRank > bRank ? 1 : -1;
        });
        console.log(Card.showCards(iTrumps));
        var stat = new HandStat(iTrumps, cSuite, currentGameRank);
        point += stat.totalPairs;
        point += stat.totalTrips;
        point += stat.totalQuads * 2;
        if (stat.totalPairs > 0) {
            var arr = stat.sortedRanks(2);
            for (var x = 0, rnk, lRnk = -1, addon = 2; rnk = arr[x]; x++) {
                if (rnk === lRnk + 1) {
                    point += addon + (rnk >= 10 ? 1 : 0);
                    addon++;
                } else {
                    addon = 2;
                    if (rnk > 13) point += 2;
                }
                lRnk = rnk;
            }
        }
        return point;
    }

    var gameCardNumSpade = totalGameRankCard(this.spades);
    var gameCardNumHeart = totalGameRankCard(this.hearts);
    var gameCardNumDiamond = totalGameRankCard(this.diamonds);
    var gameCardNumClub = totalGameRankCard(this.clubs);

    var totalGameCardNum = gameCardNumSpade + gameCardNumHeart + gameCardNumDiamond + gameCardNumClub;
    honorPoints += totalGameCardNum;

    var handStrongth = honorPoints;
    this.canBid = honorPoints > 0;
    if (!this.canBid) return;

    if (totalGameCardNum > 0) {
        this.intendTrumpSuite = Card.SUITE.SPADE;
        var maxTrumpPoint = (gameCardNumSpade === 0 ? -1 : trumpPoint(this, Card.SUITE.SPADE));
        var trumpPointHeart = (gameCardNumHeart === 0 ? -1 : trumpPoint(this, Card.SUITE.HEART));
        if (trumpPointHeart > maxTrumpPoint) {
            maxTrumpPoint = trumpPointHeart;
            this.intendTrumpSuite = Card.SUITE.HEART;
        }
        var trumpPointDiamond = (gameCardNumDiamond === 0 ? -1 : trumpPoint(this, Card.SUITE.DIAMOND));
        if (trumpPointDiamond > maxTrumpPoint) {
            maxTrumpPoint = trumpPointDiamond;
            this.intendTrumpSuite = Card.SUITE.DIAMOND;
        }
        var trumpPointClub = (gameCardNumClub === 0 ? -1 : trumpPoint(this, Card.SUITE.CLUB));
        if (trumpPointClub > maxTrumpPoint) {
            maxTrumpPoint = trumpPointClub;
            this.intendTrumpSuite = Card.SUITE.CLUB;
        }

        handStrongth += maxTrumpPoint;
    } else {
        this.intendTrumpSuite = Card.SUITE.JOKER;
    }

    var totalPairs = 0;
    var totalTrips = 0;
    var totalQuads = 0;
    
    var tractorPoints = 0;
    var additionPoints = 0;

    function evalSuiteStrongth(suite) {
        var stat = new HandStat(suite, Card.SUITE.JOKER, currentGameRank);
        totalPairs += stat.totalPairs;
        totalTrips += stat.totalTrips;
        totalQuads += stat.totalQuads;
        
        if(stat.totalTrips > 0) {
            var arr = stat.sortedRanks(3);
            for (var x = 0, rnk, lRnk = -1, addon = 3; rnk = arr[x]; x++) {
                if(rnk === 14) {
                    // the special card, card rank equals to players's current game rank
                    continue;
                }
                if(rnk === lRnk+1) {
                    tractorPoints += addon;
                    addon++;
                } else {
                    addon = 3;
                }
                lRnk = rnk;
            }
        }
        if(stat.totalPairs > 0) {
            var arr = stat.sortedRanks(2);
            for (var x = 0, rnk, lRnk = -1, addon = 2; rnk = arr[x]; x++) {
                if(rnk === 14) {
                    // the special card, card rank equals to players's current game rank
                    continue;
                }
                if(rnk === lRnk+1) {
                    tractorPoints += addon + (rnk >= 10 ? 1 : 0);
                    if (rnk === 13) tractorPoints++;
                    addon++;
                } else {
                    addon = 2;
                }
                lRnk = rnk;
            }
        }
    }
    
    if (this.intendTrumpSuite !== Card.SUITE.SPADE) evalSuiteStrongth(this.spades);
    if (this.intendTrumpSuite !== Card.SUITE.HEART) evalSuiteStrongth(this.hearts);
    if (this.intendTrumpSuite !== Card.SUITE.DIAMOND) evalSuiteStrongth(this.diamonds);
    if (this.intendTrumpSuite !== Card.SUITE.CLUB) evalSuiteStrongth(this.clubs);
    
    handStrongth += totalPairs * 2;
    handStrongth += totalTrips;
    handStrongth += totalQuads * 3;
    handStrongth += tractorPoints;
    handStrongth += additionPoints;

    this.minBid = 200 + Math.round((30 - handStrongth) * 2 / 3) * 5;
    console.log('minBid: ' + this.minBid + "\n");
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
