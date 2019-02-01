var Card = require('./card');
var HandStat = require('./stat');
var Table = require('./table');
var Game = require('./game');

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

    this.timeoutTimes = 0;

    this.replaceRobot = function (id, sock) {
        this.id = id;
        this.sock = sock;
    };

    this.toRobot = function () {
        this.sock = null;
    };

    this.isOut = function () {
        return this.timeoutTimes >= 2;
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

Player.prototype.addCards = function (cards) {
    if (cards == null || cards.length < 1)
        return;
    var p = this;
    cards.forEach(function (c) {
        p.addCard(c);
    });
};

Player.prototype.removeCard = function (card) {
    debugger;
    var x = card.indexOf(this.trumps);
    if (x >= 0) {
        this.trumps.splice(x, 1);
        return;
    }
    switch (card.suite) {
        case Card.SUITE.SPADE:
            x = card.indexOf(this.spades);
            if (x >= 0)
                this.spades.splice(x, 1);
            break;
        case Card.SUITE.CLUB:
            x = card.indexOf(this.clubs);
            if (x >= 0)
                this.clubs.splice(x, 1);
            break;
        case Card.SUITE.HEART:
            x = card.indexOf(this.hearts);
            if (x >= 0)
                this.hearts.splice(x, 1);
            break;
        case Card.SUITE.DIAMOND:
            x = card.indexOf(this.diamonds);
            if (x >= 0)
                this.diamonds.splice(x, 1);
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
        if (aRank === bRank)
            return a.suite === b.suite ? 0 : (a.suite > b.suite ? 1 : -1);
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

Player.confusedData = function (data) {
    var t = data.replace(/T/g, '#');
    t = t.replace(/L/g, 'T');
    t = t.replace(/j/g, 'L');
    return t.replace(/#/g, 'j');
};

Player.prototype.pushJson = function (json) {
    if (this.sock == null)
        return;

    setImmediate(function (p) {
        // this seems no differents
        try {
            if (Table.Debugging) {
                p.sock.write(JSON.stringify(json) + '\n');
            } else {
                p.sock.write(Player.confusedData(Buffer.from(JSON.stringify(json) + '\n').toString('base64')));
            }
        } catch (err) {
            console.log(err.message);
        }
    }, this);
//    try {
//        if (Table.Debugging) {
//            this.sock.write(JSON.stringify(json) + '\n');
////            this.sock.write(Buffer.from(JSON.stringify(json)).toString('base64'));
//        } else {
//            this.sock.write(Player.confusedData(Buffer.from(JSON.stringify(json) + '\n').toString('base64')));
//        }
//    } catch (err) {
//        console.log(err.message);
//    }
};

Player.prototype.pushData = function () {
    if (this.sock == null)
        return;

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
        if (x >= totalPlayer)
            x -= totalPlayer;
        p = this.currentTable.players[x];
        playerInfo.push(p.matchInfo.toJson(x + 1));
    }

    var game = this.currentTable.game;

    var json = Object.assign({
        action: 'init',
        game: this.currentTable.games.length,
        stage: game.stage,
        actionSeat: this.currentTable.actionPlayerIdx + 1,
        contractPoint: game.contractPoint,
        players: playerInfo,
        timeout: this.currentTable.TIMEOUT_SECONDS, // default timeout
        S: S,
        H: H,
        D: D,
        C: C,
        T: T
    }, this.matchInfo.toJson(seat));

    if (this.currentTable.game.stage === Game.BIDDING_STAGE) {
        json = Object.assign({
            trump: this.intendTrumpSuite ? this.intendTrumpSuite : '',
            minBid: Table.Debugging ? this.minBid : -1
        }, json);
    } else {
        var obj = {
            seatContractor: this.currentTable.getSeat(game.contractor),
            seatPartner: this.currentTable.getSeat(game.partner),
            gameRank: game.rank,
            points: game.collectedPoint
        };
        if (game.trump == null) {
            obj.trump = game.contractor.intendTrumpSuite;
            obj.act = 'dim';    // declare trump
        } else {
            obj.trump = game.trump;
            if (game.holeCards.length < 1) {
                obj.act = 'bury';
                obj.acttime = this.currentTable.TIMEOUT_SECONDS * 5;
            }
        }
        json = Object.assign(obj, json);
    }
    this.pushJson(json);
};

Player.prototype.playCards = function (strCards) {
    var cards = Card.stringToArray(strCards);
    for (var x = 0, c; c = cards[x]; x++) {
        this.removeCard(c);
    }
};

function SuiteCount(suite, gameRank) {
    this.suite = suite;
    this.length = suite.length;
    if(this.length <1) return;
    var honorRank = 14;
    if(gameRank === 14) honorRank = 13;
    var viceRank = 13;
    if(gameRank >= 13) viceRank = 12;
    
    this.lenPoint = 0;    // total point catds except K
    this.lenBury = 0;   // total cards can be buried
    this.lenHonor = 0;   // total cards of Aces and Kings
    
    this.cardsToBury = [];
    for(var x=0,c; c=suite[x]; x++){
        if(c.rank === honorRank || c.rank ===viceRank) {
            this.lenHonor++;
        } else if(c.getPoint()>0) {
            this.lenPoint++;
        } else {
            this.lenBury++;
            this.cardsToBury.push(c);
        }
    }
}

Player.prototype.buryCards = function (strCards) {
    var game = this.currentTable.game;
    if (game.holeCards.length > 0)
        return ;

    var cards = Card.stringToArray(strCards);
    var len = game.deck.remains.length;

    if (cards.length !== len) {
        cards = [];
        var arr = [];
        var sCount = new SuiteCount(this.spades);
        if(sCount.length>0) arr.push(sCount);
        sCount = new SuiteCount(this.hearts);
        if(sCount.length>0) arr.push(sCount);
        sCount = new SuiteCount(this.diamonds);
        if(sCount.length>0) arr.push(sCount);
        sCount = new SuiteCount(this.clubs);
        if(sCount.length>0) arr.push(sCount);
        
        arr.sort(function(a,b) {
            if(a.lenBury > b.lenBury) return 1;
            if(a.lenBury < b.lenBury) return -1;
            if(a.lenPoint !== b.lenPoint) {
                if(a.lenPoint === 1) return -1;
                if(b.lenPoint === 1) return 1;
                return a.lenPoint - b.lenPoint;
            }
            if(a.lenHonor > b.lenHonor) return 1;
            if(a.lenHonor < b.lenHonor) return -1;
            return a.length - b.length;
        });
        
        var i=0;
        do{
            sCount = arr[i];
            var maxLen = len - cards.length;
            if(i === 0) {
                var sLen = sCount.cardsToBury.length;
                if(sCount.lenPoint === 0 && sLen <= maxLen ) {
                    maxLen = sLen-1;
                }
            }

            for(var x=0; x<maxLen; x++) {
                cards.push(sCount.cardsToBury[x]);
            }
            i++;
        } while (cards.length<len);
    }

    for (var x = 0, c; c = cards[x]; x++) {
        this.removeCard(c);
    }
    game.holeCards = cards;
    
    if (Table.Debugging)
        console.log("hole cards[] " + cards.join());
    strCards = Card.cardsToString(cards);
    if (Table.Debugging)
        console.log("hole cards: " + strCards);
    this.pushJson({
        action: 'bury',
        cards: strCards
    });
};

Player.prototype.promote = function (delta) {
    this.matchInfo.currentRank = this.currentTable.getNextRank(this.matchInfo.currentRank, delta);
};

Player.prototype.evaluate = function () {
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
            if (c.rank === currentGameRank)
                n++;
        }
        return n;
    }

    var gameCardNumSpade = totalGameRankCard(this.spades);
    var gameCardNumHeart = totalGameRankCard(this.hearts);
    var gameCardNumDiamond = totalGameRankCard(this.diamonds);
    var gameCardNumClub = totalGameRankCard(this.clubs);

    var totalGameCardNum = gameCardNumSpade + gameCardNumHeart + gameCardNumDiamond + gameCardNumClub;
    honorPoints += totalGameCardNum;

    var handStrongth = honorPoints;
    this.canBid = honorPoints > 0;
    if (!this.canBid)
        return;

    function trumpPoint(p, cSuite) {
        // evaluate the trump strongth for a given suite
        var iTrumps = p.trumps.slice(0);
        for (var x = 0, c; c = p.spades[x]; x++) {
            if (c.suite === cSuite || c.rank === currentGameRank)
                iTrumps.push(c);
        }
        for (var x = 0, c; c = p.hearts[x]; x++) {
            if (c.suite === cSuite || c.rank === currentGameRank)
                iTrumps.push(c);
        }
        for (var x = 0, c; c = p.diamonds[x]; x++) {
            if (c.suite === cSuite || c.rank === currentGameRank)
                iTrumps.push(c);
        }
        for (var x = 0, c; c = p.clubs[x]; x++) {
            if (c.suite === cSuite || c.rank === currentGameRank)
                iTrumps.push(c);
        }

        if (iTrumps.length <= 8)
            return 0;

        var point = iTrumps.length / 3.0; // length point
        if (iTrumps.length > 14) {
            // extra length bonus
            var extra = iTrumps.length - 14;
            point += extra * extra * 0.1;
        }

//        iTrumps.sort(function (a, b) {
//            var aRank = a.trumpRank(cSuite, currentGameRank);
//            var bRank = b.trumpRank(cSuite, currentGameRank);
//            if (aRank === bRank) return a.suite === b.suite ? 0 : (a.suite > b.suite ? 1 : -1);
//            return aRank > bRank ? 1 : -1;
//        });
//        console.log(Card.showCards(iTrumps));

        var stat = new HandStat(iTrumps, cSuite, currentGameRank);
        point += stat.totalPairs * 2;
        point += stat.totalTrips;
        point += stat.totalQuads * 3;
        if (stat.totalPairs > 0) {
            var arr = stat.sortedRanks(2);
            for (var x = 0, rnk, lRnk = -1, addon = 2; rnk = arr[x]; x++) {
                if (rnk === lRnk + 1) {
                    point += addon + (rnk >= 10 ? 1 : 0);
                    addon++;
                } else {
                    addon = 2;
                }
                lRnk = rnk;
            }
        }
//        console.log(point);
        return point * 1.5;
    }

    this.intendTrumpSuite = Card.SUITE.JOKER;
    if (totalGameCardNum > 0) {
        var maxTrumpPoint = 0;

        if(gameCardNumSpade >0 ){
            var trumpPointSpade = trumpPoint(this, Card.SUITE.SPADE);
            if (trumpPointSpade > maxTrumpPoint) {
                maxTrumpPoint = trumpPointSpade;
                this.intendTrumpSuite = Card.SUITE.SPADE;
            }
        }
        if(gameCardNumHeart >0 ){
            var trumpPointHeart = trumpPoint(this, Card.SUITE.HEART);
            if (trumpPointHeart > maxTrumpPoint) {
                maxTrumpPoint = trumpPointHeart;
                this.intendTrumpSuite = Card.SUITE.HEART;
            }
        }
        if(gameCardNumDiamond > 0) {
            var trumpPointDiamond = trumpPoint(this, Card.SUITE.DIAMOND);
            if (trumpPointDiamond > maxTrumpPoint) {
                maxTrumpPoint = trumpPointDiamond;
                this.intendTrumpSuite = Card.SUITE.DIAMOND;
            }
        }
        if(gameCardNumClub > 0) {
            var trumpPointClub = trumpPoint(this, Card.SUITE.CLUB);
            if (trumpPointClub > maxTrumpPoint) {
                maxTrumpPoint = trumpPointClub;
                this.intendTrumpSuite = Card.SUITE.CLUB;
            }
        }
        handStrongth += maxTrumpPoint;
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

        if (stat.totalTrips > 0) {
            var arr = stat.sortedRanks(3);
            for (var x = 0, rnk, lRnk = -1, addon = 3; rnk = arr[x]; x++) {
                if (rnk === 14) {
                    // the special card, card rank equals to players's current game rank
                    continue;
                }
                if (rnk === lRnk + 1) {
                    tractorPoints += addon;
                    addon++;
                } else {
                    addon = 3;
                }
                lRnk = rnk;
            }
        }
        if (stat.totalPairs > 0) {
            var arr = stat.sortedRanks(2);
            for (var x = 0, rnk, lRnk = -1, addon = 2; rnk = arr[x]; x++) {
                if (rnk === 14) {
                    // the special card, card rank equals to players's current game rank
                    continue;
                }
                if (rnk === lRnk + 1) {
                    tractorPoints += addon + (rnk >= 10 ? 1 : 0);
                    if (rnk === 13)
                        tractorPoints++;
                    addon++;
                } else {
                    addon = 2;
                }
                lRnk = rnk;
            }
        }
    }

    if (this.intendTrumpSuite !== Card.SUITE.SPADE)
        evalSuiteStrongth(this.spades);
    if (this.intendTrumpSuite !== Card.SUITE.HEART)
        evalSuiteStrongth(this.hearts);
    if (this.intendTrumpSuite !== Card.SUITE.DIAMOND)
        evalSuiteStrongth(this.diamonds);
    if (this.intendTrumpSuite !== Card.SUITE.CLUB)
        evalSuiteStrongth(this.clubs);

    handStrongth += totalPairs * 2;
    handStrongth += totalTrips;
    handStrongth += totalQuads * 3;
    handStrongth += tractorPoints;
    handStrongth += additionPoints;

    this.minBid = 200 + Math.round((40 - handStrongth) * 0.5) * 5;
    if (Table.Debugging)
        console.log('minBid: ' + this.minBid + "\n");
};

Player.prototype.sendMessage = function (msg) {
    if (this.sock == null)
        return;
    var json = {
        message: msg
    };

    this.pushJson(json);
};
