module.exports = Player;

var Card = require('./card');
var HandStat = require('./stat');
var Table = require('./table');
var Server = require('./server');
const {Game, Hand, SimpleHand} = require('./game');

function Player(o) {
    if (o) {
        this.id = o.id;
        this.sock = o.sock;
        this.name = o.name;
    }
    if (this.sock == null) this.name = 'Robot';
    this.lang = 'en';   // default language, support 'zh' (Chinese)
    this.spades = [];
    this.hearts = [];
    this.diamonds = [];
    this.clubs = [];
    this.trumps = [];

    this.currentTable = null;
    this.matchInfo = null;

    this.timeoutTimes = 0;

    this.totalCardLeft = function () {
        return this.trumps.length +
                this.spades.length +
                this.hearts.length +
                this.diamonds.length +
                this.clubs.length;
    };

    this.replaceRobot = function (id, name, sock) {
        this.id = id;
        this.sock = sock;
        this.name = name;
    };

    this.toRobot = function () {
        this.sock = null;
    };

    this.isHandEmpty = function() {
        return this.trumps.length === 0 &&
                this.spades.length === 0 &&
                this.hearts.length === 0 &&
                this.diamonds.length === 0 &&
                this.clubs.length === 0;
    };

    this.isOut = function () {
        return this.timeoutTimes >= 2;
    };

    this.getCardsBySuite = function (suite) {
        switch (suite) {
            case Card.SUITE.SPADE:
                return this.spades;
            case Card.SUITE.CLUB:
                return this.clubs;
            case Card.SUITE.HEART:
                return this.hearts;
            case Card.SUITE.DIAMOND:
                return this.diamonds;
        }

        return this.trumps;
    };

    this.autoPartner = function() {
        var arr = [];
        var gameRank = this.matchInfo.currentRank;
        var sCount = new SuiteCount(this.spades, gameRank);
        if (sCount.length > 0) arr.push(sCount);
        sCount = new SuiteCount(this.hearts, gameRank);
        if (sCount.length > 0) arr.push(sCount);
        sCount = new SuiteCount(this.diamonds, gameRank);
        if (sCount.length > 0) arr.push(sCount);
        sCount = new SuiteCount(this.clubs, gameRank);
        if (sCount.length > 0) arr.push(sCount);

        arr.sort(function (a, b) {
            if (a.lenHonor > 3 || b.lenHonor > 3) {
                return a.lenHonor != b.lenHonor ? a.lenHonor - b.lenHonor : a.lenPoint - b.lenPoint;
            }
            if (a.lenPoint === 1) return b.lenPoint === 1 ? a.length - b.length : -1;
            if (b.lenPoint === 1) return 1;
            if (a.lenPoint > b.lenPoint) return 1;
            if (a.lenPoint < b.lenPoint) return -1;
            return a.length - b.length;
        });

        return arr[0].getPartnerDef();
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

Player.prototype.pushJson = function (json) {
    if (this.sock == null)
        return;

    setImmediate(function (p) {
        // this seems no differents
        try {
            if (Table.Debugging) {
                p.sock.write(JSON.stringify(json) + '\n');
            } else {
                p.sock.write(Server.confusedData(Buffer.from(JSON.stringify(json)).toString('base64')) + '\n');
            }
        } catch (err) {
            console.log(new Date().toLocaleString() + ', ' + err.message);
        }
    }, this);
};

Player.prototype.pushData = function () {
    if (this.sock == null)
        return;

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
    if (game == null) {
        var sec = Table.PAUSE_SECONDS_BETWEEN_GAME;
        if (this.currentTable.resumeTime != null) {
            sec = Math.round((this.currentTable.resumeTime - (new Date()).getTime()) / 1000);
        }
        json = Object.assign({
            action: 'init',
            game: this.currentTable.games.length,
            info: this.lang === 'zh' ? '下一局' + sec + '秒后开始...'
                    : 'Next game will start in ' + sec + ' seconds...',
            pause: sec,
            players: playerInfo,
            timeout: this.currentTable.TIMEOUT_SECONDS // default timeout
        }, this.matchInfo.toJson(seat));
        this.pushJson(json);
        return;
    }

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

    var json = Object.assign({
        action: 'init',
        game: this.currentTable.games.length,
        stage: game.stage,
        contract: game.contractPoint,
        players: playerInfo,
        timeout: this.currentTable.TIMEOUT_SECONDS, // default timeout
        S: S,
        H: H,
        D: D,
        C: C,
        T: T
    }, this.matchInfo.toJson(seat));

    if (this.currentTable.actionPlayerIdx >= 0) {
        json.next = this.currentTable.actionPlayerIdx + 1;
    }

    if (this.currentTable.game.stage === Game.BIDDING_STAGE) {
        json = Object.assign({
            trump: this.intendTrumpSuite ? this.intendTrumpSuite : '',
            minBid: Table.SHOW_MINBID ? this.minBid : -1
        }, json);
    } else {
        var obj = {
            seatContractor: this.currentTable.getSeat(game.contractor),
            seatPartner: this.currentTable.getSeat(game.partner),
            gameRank: game.rank,
            pt0: game.collectedPoint
        };
        if (game.trump == null) {
            obj.trump = game.contractor.intendTrumpSuite;
            obj.act = 'dim';    // declare trump
        } else {
            obj.trump = game.trump;
            if (game.holeCards.length < 1) {
                obj.act = 'bury';
                obj.acttime = this.currentTable.TIMEOUT_SECONDS * 5;
            } else if(game.partnerDef == null) {
                obj.act = 'partner';
            } else {
                obj.act = 'play';
                obj.def = game.partnerDef.getDef();
            }
        }
        json = Object.assign(obj, json);
    }
    this.pushJson(json);
};

Player.prototype.playAllCards = function (cards) {
    var allCards = [];
    allCards = allCards.concat(this.spades);
    allCards = allCards.concat(this.hearts);
    allCards = allCards.concat(this.diamonds);
    allCards = allCards.concat(this.clubs);
    allCards = allCards.concat(this.trumps);

    for (var x = 0; x < allCards.length; x++) {
        cards.push(allCards[x]);
    }
};

Player.prototype.duckCards = function (cards, exSuite, pointFirst, num) {
    var allCards = [];

    if (exSuite !== Card.SUITE.SPADE) {
        allCards = allCards.concat(this.spades);
    }
    if (exSuite !== Card.SUITE.HEART) {
        allCards = allCards.concat(this.hearts);
    }
    if (exSuite !== Card.SUITE.DIAMOND) {
        allCards = allCards.concat(this.diamonds);
    }
    if (exSuite !== Card.SUITE.CLUB) {
        allCards = allCards.concat(this.clubs);
    }

    if (allCards.length < num) {
        allCards = allCards.concat(this.trumps);
    }
    allCards.sort(function (a, b) {
        var aPoint = a.getPoint();
        var bPoint = b.getPoint();
        return aPoint === bPoint ? a.rank - b.rank :
                (pointFirst ? bPoint - aPoint : aPoint - bPoint);
    });

    for (var x = 0; x < num; x++) {
        cards.push(allCards[x]);
    }
};

Player.prototype.ruff = function (cards) {
    var game = this.currentTable.game;
    var firstHand = game.currentRound.getFirstHand();
    if (this.trumps.length < firstHand.cardNumber) {
        this.duckCards(cards, firstHand.suite, false, firstHand.cardNumber);
        return;
    }

    var leadingHand = game.currentRound.getLeadingHand();
    if(leadingHand.isTrump) {
        if (this.tryBeatLeading(cards, this.trumps)) return;
        cards.splice(0, cards.length);  // clear cards
        this.duckCards(cards, firstHand.suite, false, firstHand.cardNumber);
        return;
    }

    if (firstHand.cardNumber < 2) {
        Card.selectCardsByPoint(cards, this.trumps, true, game.trump, game.rank, firstHand.cardNumber);
        return;
    }

    this.followPlay(cards, this.trumps, true);
    var tHand = new Hand(this, cards, game.trump, game.rank);
    if (tHand.compareTo(leadingHand, firstHand) <= 0) {
        cards.splice(0, cards.length);  // clear cards
        this.duckCards(cards, firstHand.suite, false, firstHand.cardNumber);
    }
};

Player.prototype.getStrongHand = function () {
    var game = this.currentTable.game;
    var arr = this.getAllSuites();
    var x = Math.floor(Math.random() * (arr.length));
    var stat,rnks, sHand, isTrump, tractors;
    for(var i=0; i<arr.length; i++) {
        if(arr[x].length >= 4) {
            isTrump = arr[x] === this.trumps;
            stat = new HandStat(arr[x], game.trump, game.rank);
            if(stat.totalQuads > 0) {
                rnks = stat.sortedRanks(4);
                sHand = new SimpleHand(Hand.SIMPLE_TYPE.QUADS, rnks[rnks.length-1], isTrump);
                return Hand.makeCards(sHand, arr[x], game.trump, game.rank);
            }
            tractors = stat.getTractors(3);
            if(tractors.length < 1) {
                tractors = stat.getTractors(2);
            }
            if(tractors.length > 0) {
                tractors.sort(function (a, b) {
                    if (a.type.len === b.type.len) return b.minRank - a.minRank;
                    return b.type.len - a.type.len;
                });
                return Hand.makeCards(tractors[0], arr[x], game.trump, game.rank);
            }
            if(stat.totalTrips > 0) {
                rnks = stat.sortedRanks(3);
                sHand = new SimpleHand(Hand.SIMPLE_TYPE.TRIPS, rnks[rnks.length-1], isTrump);
                return Hand.makeCards(sHand, arr[x], game.trump, game.rank);
            }
        }

        x++;
        if(x === arr.length) x=0;
    }

    return null;
};

Player.prototype.playPartnerCards = function (cards) {
    var game = this.currentTable.game;
    var partnerDef = game.partnerDef;
    if (partnerDef.noPartner) return false;
    var defCard = partnerDef.getDefCard();
    var cardList = this.getCardsBySuite(defCard.suite);
    if (cardList.length < 1) return false;
    for (var x = 0, c; c = cardList[x]; x++) {
        if (c.equals(defCard)) cards.push(c);
    }

    if (cards.length < 1) {
        var viceCard = partnerDef.getViceCard(this.currentTable.game.rank);
        for (var x = 0, c; c = cardList[x]; x++) {
            if (c.equals(viceCard)) {
                cards.push(c);
                break;
            }
        }
    }

    return cards.length > 0;
};

Player.prototype.shouldPlayPartner = function () {
    var game = this.currentTable.game;
    var partnerDef = game.partnerDef;
    if (partnerDef.noPartner) return false;
    var defCard = partnerDef.getDefCard();
    var cardList = this.getCardsBySuite(defCard.suite);
    if (cardList.length < 1) return false;
    var n = 0;
    for (var x = 0, c; c = cardList[x]; x++) {
        if (c.equals(defCard)) n++;
    }

    if (n < 1) return false;
    if (n > 1 || partnerDef.keyCardCount + n === 4) {
        return true;
    }
    return game.sumPoints(this) < game.contractPoint / 2;
};

Player.prototype.passToPartner = function (cards) {
    var game = this.currentTable.game;
    var partnerDef = game.partnerDef;
    if (partnerDef.noPartner) {
        this.randomPlay(cards);
        return false;
    }
    var cardList = this.getCardsBySuite(partnerDef.suite);
    if (cardList.length < 1) {
        this.randomPlay(cards);
        return false;
    }

    if (this.playPartnerCards(cards)) return true;
    Card.selectCardsByPoint(cards, cardList, true, game.trump, game.rank, 1);
    return true;
};

Player.prototype.getAllSuites = function () {
    var arr = [];
    if (this.spades.length > 0) arr.push(this.spades);
    if (this.diamonds.length > 0) arr.push(this.diamonds);
    if (this.clubs.length > 0) arr.push(this.clubs);
    if (this.hearts.length > 0) arr.push(this.hearts);
    if (this.trumps.length > 0) arr.push(this.trumps);
    return arr;
};

Player.prototype.randomPlay = function (cards) {
//    var arr = this.getAllSuites();

    // not totally random
    var game = this.currentTable.game;
    var exSuite = game.partnerDef.suite;

    var arr = [];
    for (var i = 0, suit, lst; suit = Card.SUITES[i]; i++) {
        if (suit === exSuite) continue;
        lst = this.getCardsBySuite(suit);
        if (lst.length < 1) continue;
        arr.push(lst);
    }

    if (arr.length < 1) {
        if (this.trumps.length > 0) {
            arr.push(this.trumps);
        } else {
            arr.push(this.getCardsBySuite(exSuite));
        }
    }

    var x = Math.floor(Math.random() * (arr.length));
    var y = Math.floor(Math.random() * (arr[x].length));

    var card = arr[x][y];
    for(var i=0,c;c=arr[x][i];i++){
        if(card.equals(c)) cards.push(c);
    }
};

Player.prototype.followPlay = function (cards, cardList, pointFirst) {
    var game = this.currentTable.game;
    var firstHand = game.currentRound.getFirstHand();

    var tmpCards = cardList.slice();
    switch(firstHand.type.cat) {
        case Hand.COMBINATION.SINGLE:
            Card.selectCardsByPoint(cards, tmpCards, pointFirst, game.trump, game.rank, firstHand.cardNumber);
            break;
        case Hand.COMBINATION.PAIR:
        case Hand.COMBINATION.TRIPS:
        case Hand.COMBINATION.QUADS:
            for (var x = 0, n = firstHand.cardNumber / firstHand.type.len; x < n; x++) {
                tmpCards = Card.selectSimpleHandByPoint(firstHand.type, cards, tmpCards, pointFirst, game.trump, game.rank);
            }
            break;
        case Hand.COMBINATION.TRACTOR2:
            Card.selectTractor2(firstHand.type.len, cards, cardList, pointFirst, game.trump, game.rank);
            break;
        case Hand.COMBINATION.TRACTOR3:
            Card.selectTractor3(firstHand.type.len, cards, cardList, pointFirst, game.trump, game.rank);
            break;
        case Hand.COMBINATION.TRACTOR4:
            Card.selectTractor4(firstHand.type.len, cards, cardList, pointFirst, game.trump, game.rank);
            break;
        case Hand.COMBINATION.MIXED:
            if (firstHand.subHands == null) {
                console.log(new Date().toLocaleString() + ', ERROR: MIXED_HAND subHands=null, ' + Card.showCards(firstHand.cards));
                Card.selectCardsByPoint(cards, cardList, pointFirst, game.trump, game.rank, firstHand.cardNumber);
            } else {
                for (var x = firstHand.subHands.length - 1, subH; x >= 0; x--) {
                    subH = firstHand.subHands[x];
                    switch (subH.type.cat) {
                        case Hand.COMBINATION.SINGLE:
                            break;
                        case Hand.COMBINATION.PAIR:
                        case Hand.COMBINATION.TRIPS:
                        case Hand.COMBINATION.QUADS:
                            tmpCards = Card.selectSimpleHandByPoint(subH.type, cards, tmpCards, pointFirst, game.trump, game.rank);
                            break;
                        case Hand.COMBINATION.TRACTOR2:
                            tmpCards = Card.selectTractor2(subH.type.len, cards, tmpCards, pointFirst, game.trump, game.rank);
                            break;
                        case Hand.COMBINATION.TRACTOR3:
                            tmpCards = Card.selectTractor3(subH.type.len, cards, tmpCards, pointFirst, game.trump, game.rank);
                            break;
                        case Hand.COMBINATION.TRACTOR4:
                            tmpCards = Card.selectTractor4(subH.type.len, cards, tmpCards, pointFirst, game.trump, game.rank);
                            break;
                    }
                }
                if (cards.length < firstHand.cardNumber) {
                    Card.selectCardsByPoint(cards, tmpCards, pointFirst, game.trump, game.rank, firstHand.cardNumber - cards.length);
                }
            }
            break;
        default:
            console.log(new Date().toLocaleString() + ', UNKNOWN HAND COMBINATION:' + firstHand.type.cat);
            Card.selectCardsByPoint(cards, cardList, pointFirst, game.trump, game.rank, firstHand.cardNumber);
            break;
    }
};

Player.prototype.tryBeatLeading = function (cards, cardList) {
    var game = this.currentTable.game;
    var firstHand = game.currentRound.getFirstHand();
    if (firstHand.isFlop) {
        // unable to beat
        this.followPlay(cards, cardList, false);
        return false;
    }
    var leadingHand = game.currentRound.getLeadingHand();
    if (leadingHand.isTrump) {
        if (!cardList[0].isTrump(game.trump, game.rank)) {
            // unable to beat
            this.followPlay(cards, cardList, false);
            return false;
        }
    }

    var maxRank,stat,rnks,cc,sHand;
    switch (firstHand.type.cat) {
        case Hand.COMBINATION.SINGLE:
            var card = cardList[cardList.length - 1];
            maxRank = card.trumpRank(game.trump, game.rank);
            if(maxRank > leadingHand.maxRank) {
                if(cardList.length>1 && game.partner == null && game.cardsPlayed <= 10) {
                    var partnerDef = this.currentTable.game.partnerDef;
                    if (!partnerDef.noPartner) {
                        var defCard = partnerDef.getDefCard();
                        var viceCard = partnerDef.getViceCard(game.rank);
                        if (card.equals(defCard)) {
                            var viceRank = viceCard.trumpRank(game.trump, game.rank);
                            if (viceRank === leadingHand.maxRank) {
                                if (game.contractor !== leadingHand.player && this.shouldPlayPartner()) {
                                    cards.push(card);
                                    return true;
                                }

                                cards.push(cardList[0]);
                                return false;
                            }

                            if (viceRank > leadingHand.maxRank && viceCard.indexOf(cardList) >= 0) {
                                cards.push(viceCard);
                                return true;
                            }
                            cards.push(cardList[0]);
                            return false;
                        }
                    }
                }
                cards.push(cardList[cardList.length - 1]);
                return true;
            } else {
                Card.selectCardsByPoint(cards, cardList, false, game.trump, game.rank, 1);
            }

            return false;
        case Hand.COMBINATION.PAIR:
        case Hand.COMBINATION.TRIPS:
        case Hand.COMBINATION.QUADS:
            stat = new HandStat(cardList, game.trump, game.rank);
            rnks = stat.sortedRanks(leadingHand.type.len);
            if(rnks.length > 0 && rnks[rnks.length-1] > leadingHand.maxRank) {
                sHand = new SimpleHand(leadingHand.type, rnks[rnks.length-1], cardList === this.trumps);
                cc = Hand.makeCards(sHand, cardList, game.trump, game.rank);
                cc.forEach(function (c) {
                    cards.push(c);
                });
                return true;
            }
            break;
        default:
            break;
    }

    this.followPlay(cards, cardList, false);
    var tHand = new Hand(this, cards, game.trump, game.rank);
    return tHand.compareTo(leadingHand, firstHand) > 0;
};

Player.prototype.autoPlayCards = function (isLeading) {
    var cards = [];
    var game = this.currentTable.game;
    var round = game.currentRound;
    if (isLeading) {
        if (this.totalCardLeft() < 2) {
            this.playAllCards(cards);
            return cards;
        }

        if (this === game.contractor && game.partner == null) {
            if (this.playPartnerCards(cards)) {
                return cards;
            }
        }

        var strongHand = this.getStrongHand();
        if (strongHand != null) {
            cards = strongHand;
        } else {
            if (game.partner == null) {
                if (this === game.contractor) {
                    this.passToPartner(cards);
                } else if (this.shouldPlayPartner()) {
                    this.playPartnerCards(cards);
                } else {
                    this.randomPlay(cards);
                }
            } else {
                if (this === game.contractor || this === game.partner) {
                    this.passToPartner(cards);
                } else {
                    this.randomPlay(cards);
                }
            }
        }
    } else {
        var firstHand = round.getFirstHand();
        if (this.totalCardLeft() <= firstHand.cardNumber) {
            this.playAllCards(cards);
            return cards;
        }

        var leadingPlayer = round.getNextLeadingPlayer();
        var cardList;
        var suite = firstHand.suite;
        if (firstHand.isTrump) {
            cardList = this.trumps;
            suite = Card.SUITE.JOKER;
        } else {
            cardList = this.getCardsBySuite(suite);
        }

        if (cardList.length > firstHand.cardNumber) {
            if (game.isSameSide(this, leadingPlayer)) {
                if (round.isWinning(game, this)) {
                    this.followPlay(cards, cardList, true);
                } else {
                    this.tryBeatLeading(cards, cardList);
                }
            } else {
                this.tryBeatLeading(cards, cardList);
            }
        } else if (cardList.length === 0) {
            if (firstHand.isTrump) {
                this.duckCards(cards, suite,
                        game.isSameSide(this, leadingPlayer) && round.isWinning(game, this),
                        firstHand.cardNumber);
            } else {
                if (game.isSameSide(this, leadingPlayer) && round.isWinning(game, this)) {
                    this.duckCards(cards, suite, true, firstHand.cardNumber);
                } else {
                    this.ruff(cards);
                }
            }
        } else {
            cardList.forEach(function (c) {
                cards.push(c);
            });

            if (cards.length < firstHand.cardNumber) {
                this.duckCards(cards, suite,
                        game.isSameSide(this, leadingPlayer) && round.isWinning(game, this),
                        firstHand.cardNumber - cards.length);
            }
        }
    }

    return cards;
};

Player.prototype.allValid = function (cards) {
    var cardCount = {};
    for (var x = 0, c; c = cards[x]; x++) {
        var k = c.suite + c.rank;
        if (cardCount[k]) {
            cardCount[k]++;
        } else {
            cardCount[k] = 1;
        }
    }

    for (var k in cardCount) {
        if (Card.getTotalCardNumber(this.trumps, k) >= cardCount[k]) continue;
        switch (k.charAt(0)) {
            case Card.SUITE.SPADE:
                if (Card.getTotalCardNumber(this.spades, k) < cardCount[k]) return false;
                break;
            case Card.SUITE.HEART:
                if (Card.getTotalCardNumber(this.hearts, k) < cardCount[k]) return false;
                break;
            case Card.SUITE.CLUB:
                if (Card.getTotalCardNumber(this.clubs, k) < cardCount[k]) return false;
                break;
            case Card.SUITE.DIAMOND:
                if (Card.getTotalCardNumber(this.diamonds, k) < cardCount[k]) return false;
                break;
            default:
                return false;
        }
    }

    return true;
};

// check if the following play is valid, MUST NOT a leading hand
Player.prototype.isValidPlay = function (hand) {
    var game = this.currentTable.game;
    var firstHand = game.currentRound.getFirstHand();
    if (firstHand.cardNumber !== hand.cardNumber) return false;
    var cardList;
    var suite = firstHand.suite;
    if (firstHand.isTrump) {
        cardList = this.trumps;
        suite = Card.SUITE.JOKER;
    } else {
        cardList = this.getCardsBySuite(suite);
    }

    if (cardList.length >= firstHand.cardNumber) {
        if (!Card.containsAll(cardList, hand.cards)) return false;
        if(hand.totalPairs < firstHand.totalPairs) {
            var stat = new HandStat(cardList, game.trump, game.rank);
            if(stat.totalPairs > hand.totalPairs) return false;
        }
    } else if (cardList.length > 0) {
        if (!Card.containsAll(hand.cards, cardList)) return false;
    }

    return true;
};

Player.prototype.playCards = function (strCards) {
    var cards = [];
    var hand = null;
    var game = this.currentTable.game;
    var isLeading = this === game.leadingPlayer;

    if (strCards != null) {
        cards = Card.stringToArray(strCards, game.trump, game.rank);
        if (cards.length > 0 && !this.allValid(cards)) { // bad play
            cards = [];
        }
    }

    if (isLeading) {
        if (cards.length > 0) {
            hand = new Hand(this, cards, game.trump, game.rank);
//            console.log('hand type: ' + hand.type.cat);
//            console.log('is flop: ' + hand.isFlop);
            if (hand.type.cat === Hand.COMBINATION.MIX_SUITE) {
                cards = this.autoPlayCards(isLeading);
                hand = null;
            } else {
                if (!game.isLeadingHandValid(hand)) {
                    console.log('invalid leading: ' + strCards);
                    var orgLen = cards.length;
                    var orgCards = Card.showCards(cards);
                    cards = Hand.makeCards(this.mustLead, cards, game.trump, game.rank);
                    this.matchInfo.penalty = (cards.length - orgLen) * 10;
                    this.matchInfo.alert = '甩牌失败' + orgCards + ',罚' + (-this.matchInfo.penalty);
                    this.addPoints(this.matchInfo.penalty);
                    hand = null;
                }
            }
        } else {
            cards = this.autoPlayCards(isLeading);
        }
    } else {
        if (cards.length > 0) {
            hand = new Hand(this, cards, game.trump, game.rank);
            if (!this.isValidPlay(hand)) {
                cards = this.autoPlayCards(isLeading);
                hand = null;
            }
        } else {
            cards = this.autoPlayCards(isLeading);
        }
    }

    if (cards.length < 1) {
        // temp: to avoid exception, should not run to here if normal
        console.log(new Date().toLocaleString() + ', Exception:  player.playCards(), isLeading: ' + isLeading);
        this.randomPlay(cards);
    }

    this.matchInfo.playedCards = Card.cardsToString(cards);
    for (var x = 0, c; c = cards[x]; x++) {
        this.removeCard(c);
    }

    if (game.currentRound.addHand(this, cards, hand)) {
        if(!this.isHandEmpty()){
            game.startNewRound();
            return 'newround';
        }

        return 'gameover';
    }
    return this.totalCardLeft() < 1 ? 'lasthand' : '';
};

Player.prototype.addPoints = function (points) {
    var game = this.currentTable.game;
    if (this === game.contractor || this === game.partner) {
        if (points < 0) {
            game.collectedPoint -= points;
        }
    } else if (game.partner == null) {
        this.matchInfo.points += points;
    } else {
        game.collectedPoint += points;
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
    this.lenTop = 0;   // total cards of top card (Ace, or King if gameRank is A)

    var reserved = [];  // reserve quads, trips, and tractors
    var stat = new HandStat(suite, Card.SUITE.JOKER, gameRank);
    if (stat.totalQuads > 0) {
        var rnks = stat.sortedRanks(4);
        for (var x = 0, rnk; rnk = rnks[x]; x++) {
            reserved.push(rnk < gameRank ? rnk : rnk + 1);
            this.lenHonor += 4;
        }
    }
    if (stat.totalTrips > 0) {
        var rnks = stat.sortedRanks(3);
        for (var x = 0, rnk; rnk = rnks[x]; x++) {
            if (rnk >= gameRank)
                rnk++;
            if (reserved.indexOf(rnk) < 0) {
                reserved.push(rnk);
                this.lenHonor += 3;
            }
        }
    }
    if (stat.totalPairs > 1) {
        var rnks = stat.sortedRanks(2);
        for (var x = 0, rnk, prev = 0; rnk = rnks[x]; x++) {
            if (rnk === prev + 1) {
                var orgPrev = prev < gameRank ? prev : prev + 1;
                var orgRnk = rnk < gameRank ? rnk : rnk + 1;
                if (reserved.indexOf(orgPrev) < 0) {
                    reserved.push(orgPrev);
                    this.lenHonor += 2;
                }
                if (reserved.indexOf(orgRnk) < 0) {
                    reserved.push(orgRnk);
                    this.lenHonor += 2;
                }
            }
            prev = rnk;
        }
    }

    this.cardsToBury = [];
    this.cardsPoint = [];
    for (var x = 0, c; c = suite[x]; x++) {
        if (c.rank === honorRank) this.lenTop++;
        if (reserved.indexOf(c.rank) >= 0) {
            continue;
        }
        if (c.rank === honorRank || c.rank === viceRank) {
            this.lenHonor++;
        } else if (c.getPoint() > 0) {
            this.lenPoint++;
            this.cardsPoint.push(c);
        } else {
            this.lenBury++;
            this.cardsToBury.push(c);
        }
    }

    this.getPartnerDef = function () {
        return suite[0].suite + (honorRank === 14 ? 'A' : 'K') + this.lenTop;
    };
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
        var sCount = new SuiteCount(this.spades, this.matchInfo.currentRank);
        if(sCount.length>0) arr.push(sCount);
        sCount = new SuiteCount(this.hearts, this.matchInfo.currentRank);
        if(sCount.length>0) arr.push(sCount);
        sCount = new SuiteCount(this.diamonds, this.matchInfo.currentRank);
        if(sCount.length>0) arr.push(sCount);
        sCount = new SuiteCount(this.clubs, this.matchInfo.currentRank);
        if(sCount.length>0) arr.push(sCount);

        arr.sort(function (a, b) {
            if (a.lenHonor > 3 || b.lenHonor > 3) {
                return a.lenHonor != b.lenHonor ? a.lenHonor - b.lenHonor : b.lenBury - a.lenBury;
            }

            var lenA = a.lenBury + a.lenPoint;
            var lenB = b.lenBury + b.lenPoint;
            if (lenA <= len + 1 && lenB <= len + 1) {
                if (a.lenPoint !== b.lenPoint) {
                    if (a.lenPoint === 1) return -1;
                    if (b.lenPoint === 1) return 1;
                    return a.lenPoint - b.lenPoint;
                }
                return a.lenBury != b.lenBury ? a.lenBury - b.lenBury : a.lenHonor - b.lenHonor;
            } else if (lenA <= len + 1) {
                return -1;
            } else if (lenB <= len + 1) {
                return 1;
            }

            if (lenA > lenB) return 1;
            if (lenA < lenB) return -1;
            if (a.lenPoint > b.lenPoint) return 1;
            if (a.lenPoint < b.lenPoint) return -1;
            return a.lenHonor - b.lenHonor;
        });

        var i = 0;
        do{
            sCount = arr[i];
            var maxLen = len - cards.length;
            var sLen = sCount.cardsToBury.length;
            if(i === 0 && sCount.lenPoint === 0) {
                sLen--;
            }
            if(sLen < maxLen) maxLen = sLen;

            for(var x=0; x<maxLen; x++) {
                cards.push(sCount.cardsToBury[x]);
            }
            i++;
        } while (cards.length < len && i < arr.length);

        if (cards.length < len) {
            // should be very rare
            console.log('AUTO-BURY: BURY POINT!');
            i = 0;
            do {
                sCount = arr[i];
                var maxLen = len - cards.length;
                var sLen = sCount.cardsPoint.length;
                if (sLen < maxLen)
                    maxLen = sLen;

                for (var x = 0; x < maxLen; x++) {
                    cards.push(sCount.cardsPoint[x]);
                }
                i++;
            } while (cards.length < len && i < arr.length);

            if (cards.length < len) {
                // not likely to be here
                console.log('AUTO-BURY: BURY TRUMP!!!');
                var maxLen = len - cards.length;
                for (var x = 0; x < maxLen; x++) {
                    cards.push(this.trumps[x]);
                }
            }
        }
    }

    for (var x = 0, c; c = cards[x]; x++) {
        this.removeCard(c);
    }
    game.holeCards = cards;

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
