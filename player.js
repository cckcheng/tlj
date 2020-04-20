module.exports = Player;

var Config = require('./conf');
var Func = require('./func');
var Card = require('./card');
var HandStat = require('./stat');
var Mylog = require('./mylog');
const {Game, Hand, SimpleHand} = require('./game');

Player.init = function() {
    Config = require('./conf');
};

function Player(o, mainServer) {
    this.mainServer = mainServer;

    this.premium = false;
    if (o) {
        this.id = o.id;
        this.sock = o.sock;
        this.name = o.name;
        if (o.premium) this.premium = o.premium;
    }
    if (this.name == null) this.name = 'Robot';
    this.robotCode = '';
    this.lang = 'en';   // default language, support 'zh' (Chinese)
    this.spades = [];
    this.hearts = [];
    this.diamonds = [];
    this.clubs = [];
    this.trumps = [];
    this.voids = {};  // record void suits
    this.orgLength = {};  // original suite length

    this.property = {
        member: false,  // membership, check when player login (this.setProperty())
        credit: 0,
        priority: 0,
        aiLevel: 0
    };

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

    this.ntLength = function () {
        return this.spades.length +
                this.hearts.length +
                this.diamonds.length +
                this.clubs.length;
    };

    this.setLang = function(lang) {
        if(lang === 'zh') {
            this.lang = lang;
        } else {
            this.lang = 'en';
        }
    };

    this.setVoids = function(suite, isVoid) {
        this.voids[suite] = isVoid;
    };

    this.hasTrump = function() {
        if(this.voids[Card.SUITE.JOKER]) return false;
        return true;
    };

    this.setProperty = function(rec) {
        // set property from DB record
        this.property = {
            credit: rec['credit'],
            priority: rec['priority'],
            aiLevel: rec['ai_level']
        };

        var expireTime = rec['expire_time'];
        if(expireTime == null) {
            this.property.member = false;
            return;
        }
        var currentTime = new Date().toISOString();
        this.property.member = currentTime <= expireTime;
    };

    this.isRobot = function() {
        return this.id == null && this.sock == null;
    };

    this.replaceRobot = function (p) {
        this.id = p.id;
        this.sock = p.sock;
        this.name = p.name;
        this.lang = p.lang;
        this.property = p.property;
    };

    this.toRobot = function (keepMinutes) {
        this.sock = null;
        if (this.idleTimer != null) return;

        if (this.currentTable != null && !this.currentTable.dismissed) {
            this.currentTable.broadcastGameInfo({action: 'out', seat: this.currentTable.getSeat(this)});
        }

        var timeout = Config.DEFAULT_KEEP_SECONDS ? Config.DEFAULT_KEEP_SECONDS * 1000 : 10;
        if (keepMinutes == null) {
            timeout = Config.MAX_IDLE_MINUTES * 60000;
        } else if (keepMinutes > 0) {
            timeout = keepMinutes * 60000;
        }
        this.idleTimer = setTimeout(function (p) {
            if (p.sock != null) return;
            p.mainServer.removePlayer(p);
            p.idleTimer = null;
            if (p.currentTable == null || p.currentTable.dismissed) return;
            p.id = null;
            p.name = 'Robot' + p.robotCode;
            p.property = {
                credit: 0,
                priority: 0,
                aiLevel: 0
            };
            if (!p.currentTable.dismiss()) {
                p.mainServer.addRobot(p);
            }
        }, timeout, this);
    };

    this.clearIdleTimer = function () {
        if (this.idleTimer != null) {
            clearTimeout(this.idleTimer);
            this.idleTimer = null;
        }
        if (this.currentTable != null && !this.currentTable.dismissed) {
            this.currentTable.broadcastGameInfo({action: 'in', name: this.name, seat: this.currentTable.getSeat(this)}, this);
        }
    };

    this.isHandEmpty = function() {
        return this.trumps.length === 0 &&
                this.spades.length === 0 &&
                this.hearts.length === 0 &&
                this.diamonds.length === 0 &&
                this.clubs.length === 0;
    };

    this.isOut = function () {
        if (this.timeoutTimes === Config.PLAYER_TIMEOUT_TIMES) {
            this.pushJson({action: 'robot'});
            this.timeoutTimes = 9;
        }
        return this.timeoutTimes >= Config.PLAYER_TIMEOUT_TIMES;
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
            /*
            if (a.lenPoint === 1) return b.lenPoint === 1 ? a.length - b.length : -1;
            if (b.lenPoint === 1) return 1;
            if (a.lenPoint > b.lenPoint) return 1;
            if (a.lenPoint < b.lenPoint) return -1;
            return a.length - b.length;
            */
            if(a.length !== b.length) return a.length - b.length;
            if(a.lenHonor != b.lenHonor) return b.lenHonor - a.lenHonor
            if(a.lenPoint !== b.lenPoint) return a.lenPoint - b.lenPoint;
            return a.lenTop - b.lenTop;
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

    this.orgLength[Card.SUITE.SPADE] = this.spades.length;
    this.orgLength[Card.SUITE.CLUB] = this.clubs.length;
    this.orgLength[Card.SUITE.HEART] = this.hearts.length;
    this.orgLength[Card.SUITE.DIAMOND] = this.diamonds.length;

    this.orgLength[Card.SUITE.JOKER] = this.trumps.length;
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
//Mylog.log(JSON.stringify(json));
    setImmediate(function (p) {
        // this seems no differents
        try {
            if (Config.DEBUGGING) {
                p.sock.write(JSON.stringify(json) + '\n');
            } else {
                p.sock.write(Func.confusedData(Buffer.from(JSON.stringify(json)).toString('base64')) + '\n');
            }
        } catch (err) {
            Mylog.log(new Date().toLocaleString() + ', ' + err.message);
            p.toRobot(0.001);
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
        var sec = Config.PAUSE_SECONDS_BETWEEN_GAME;
        if (this.currentTable.resumeTime != null) {
            sec = Math.round((this.currentTable.resumeTime - (new Date()).getTime()) / 1000);
        }

        var period = sec > 90 ? Math.round(sec/60) + (this.lang === 'zh' ? '分钟' : ' minutes')
                    : sec + (this.lang === 'zh' ? '秒' : ' seconds');
        json = Object.assign({
            action: 'init',
            game: this.currentTable.games.length,
            info: this.lang === 'zh' ? '下一局' + period + '后开始...'
                    : 'Next game will start in ' + period + '...',
            pause: sec,
            players: playerInfo,
            timeout: Math.floor(this.currentTable.TIMEOUT_SECONDS * this.currentTable.timerScale) // default timeout
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
        timeout: Math.floor(this.currentTable.TIMEOUT_SECONDS * this.currentTable.timerScale), // default timeout
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
            minBid: Config.SHOW_MINBID || this.currentTable.showMinBid ? this.minBid : -1
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
                obj.acttime = Math.floor(Config.TIMEOUT_SECONDS_BURYCARDS * this.currentTable.timerScale);
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
    var game = this.currentTable.game;
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

    var defCard = null;
    if(this.aiLevel >= 2 && game.partner == null) {
        defCard = game.partnerDef.getDefCard();
    }

    var stat = this.aiLevel >= 2 ? new HandStat(allCards, game.trump, game.rank) : null;

    if(this.aiLevel >= 3 && this.totalCardLeft() - num <= 4) {
        var pointNeeded = game.contractPoint - game.collectedPoint;
        var withDeclarer = pointNeeded > 40 ? 1 : -1;
        allCards.sort(function (a, b) {
            if(a.equals(defCard)) return -withDeclarer;
            if(b.equals(defCard)) return withDeclarer;
            var aPoint = a.getPoint();
            var bPoint = b.getPoint();

            if (aPoint === bPoint) {
                var aTrump = a.isTrump(game.trump, game.rank);
                var bTrump = b.isTrump(game.trump, game.rank);
                if (aTrump !== bTrump) return aTrump ? 1 : -1;

                return a.trumpRank(game.trump, game.rank) - b.trumpRank(game.trump, game.rank);
            }
            return pointFirst ? bPoint - aPoint : aPoint - bPoint;
        });
    } else {
        allCards.sort(function (a, b) {
            if(a.equals(defCard)) return 1;
            if(b.equals(defCard)) return -1;
            if (a.isHonor(game.trump, game.rank)) return 1;
            if (b.isHonor(game.trump, game.rank)) return -1;
            var aPoint = a.getPoint();
            var bPoint = b.getPoint();

            if (aPoint === bPoint) {
                var aTrump = a.isTrump(game.trump, game.rank);
                var bTrump = b.isTrump(game.trump, game.rank);
                if (aTrump !== bTrump) return aTrump ? 1 : -1;

                if(stat) {
                    var aDup = stat.stat[a.key(game.trump, game.rank)];
                    var bDup = stat.stat[b.key(game.trump, game.rank)];
                    if (aDup !== bDup) {
                        return aDup - bDup;
                    }
                }

                return a.trumpRank(game.trump, game.rank) - b.trumpRank(game.trump, game.rank);
            }
            return pointFirst ? bPoint - aPoint : aPoint - bPoint;
        });
    }

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
        if(this.aiLevel >= 2) {
            if(this.possibleOpponentRuff(game, firstHand.suite)) {
                cards.push(this.trumps[this.trumps.length-1]);
                return;
            }
        }
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
        if (arr[x].length >= 3) {
            isTrump = arr[x] === this.trumps;
            stat = new HandStat(arr[x], game.trump, game.rank);
            if (arr[x].length === 3) {
                if (stat.totalTrips > 0) {
                    rnks = stat.sortedRanks(3);
                    sHand = new SimpleHand(Hand.SIMPLE_TYPE.TRIPS, rnks[rnks.length - 1], isTrump);
                    return Hand.makeCards(sHand, arr[x], game.trump, game.rank);
                }
            } else {
                if (stat.totalQuads > 0) {
                    rnks = stat.sortedRanks(4);
                    sHand = new SimpleHand(Hand.SIMPLE_TYPE.QUADS, rnks[rnks.length - 1], isTrump);
                    return Hand.makeCards(sHand, arr[x], game.trump, game.rank);
                }
                tractors = stat.getTractors(3);
                if (tractors.length < 1) {
                    tractors = stat.getTractors(2);
                }
                if (tractors.length > 0) {
                    tractors.sort(function (a, b) {
                        if (a.type.len === b.type.len) return b.minRank - a.minRank;
                        return b.type.len - a.type.len;
                    });
                    return Hand.makeCards(tractors[0], arr[x], game.trump, game.rank);
                }
                if (stat.totalTrips > 0) {
                    rnks = stat.sortedRanks(3);
                    sHand = new SimpleHand(Hand.SIMPLE_TYPE.TRIPS, rnks[rnks.length - 1], isTrump);
                    return Hand.makeCards(sHand, arr[x], game.trump, game.rank);
                }
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
    if(this.possibleOpponentRuff(game, defCard.suite, game.contractor)) return false;

    for (var x = 0, c; c = cardList[x]; x++) {
        if (c.equals(defCard)) cards.push(c);
    }

    if (cards.length < 1) {
        if(this === game.partner && game.cardsPlayed[partnerDef.suite] > Config.MAX_SAFE_CARDS_PLAYED) return false;
        var viceCard = partnerDef.getViceCard(this.currentTable.game.rank);
        for (var x = 0, c; c = cardList[x]; x++) {
            if (c.equals(viceCard)) {
                cards.push(c);
                break;
            }
        }
    } else {
        this.tryAddViceHonor(cardList, cards, cards.length, game);
    }

    return cards.length > 0;
};

Player.prototype.isDeadPartner = function () {
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
    return partnerDef.keyCardCount + n === 4;
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
    if (n > 1 || partnerDef.keyCardCount + n === 4 || cardList.length < 5) {
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

    if(game.partner != null && this.aiLevel >= 2 && this.totalCardLeft() <= Config.CARD_NUMBER_ENDPLAY) {
        this.endPlay(cards, game);
        return false;
    }

    var cardList = this.getCardsBySuite(partnerDef.suite);
    if (cardList.length < 1) {
        this.randomPlay(cards);
        return false;
    }

    if (this.playPartnerCards(cards)) return true;
    if(this.aiLevel >= 2) {
        if(this === game.partner) {
            var suite = this.choosePartnerVoidSuite(game, game.contractor, partnerDef.suite);
            cardList = this.getCardsBySuite(suite);
            Card.selectCardsByPoint(cards, cardList, !this.possibleOpponentRuff(game, suite), game.trump, game.rank, 1);
            return true;
        }
    }
    Card.selectCardsByPoint(cards, cardList, true, game.trump, game.rank, 1);
    return true;
};

Player.prototype.choosePartnerVoidSuite = function (game, partner, pSuite) {
    var voidSuite = pSuite;
    var len = pSuite ? game.cardsPlayed[pSuite] : 0;
    for (var i = 0, suit, lst; suit = Card.SUITES[i]; i++) {
        if (suit === pSuite) continue;
        lst = this.getCardsBySuite(suit);
        if (lst.length > 0 && partner.voids[suit]) {
            var sLen = game.cardsPlayed[suit];
            if(len < 1 || sLen < len) {
                voidSuite = suit;
                len = sLen;
            }
        }
    }

    return voidSuite;
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

Player.prototype.drawTrump = function (cards) {
    if (this.trumps.length < 1) {
        this.randomPlay(cards);
        return;
    }

    var game = this.currentTable.game;
    var ntLen = this.ntLength();
    var stat = new HandStat(this.trumps, game.trump, game.rank);
    var rnks = stat.sortedRanks(2);
    var keepPairNum = this.aiLevel >= 3 && this === game.contractor && game.rank !== 10 && game.rank !== 13 && ntLen >= Config.THRESHOLD_NT_LEN ? 1 : 0;
    if (rnks.length > keepPairNum) {
        var sHand = new SimpleHand(Hand.SIMPLE_TYPE.PAIR, rnks[rnks.length - 1], true);
        cc = Hand.makeCards(sHand, this.trumps, game.trump, game.rank);
        cc.forEach(function (c) {
            cards.push(c);
        });
        return;
    }

    if(this.aiLevel >= 2 && this.totalCardLeft() <= Config.CARD_NUMBER_ENDPLAY) {
        this.endPlay(cards, game);
        return;
    }

    if (ntLen < Config.THRESHOLD_NT_LEN && this.trumps.length > 1) {
        // draw trumps, from high to low
        cards.push(this.trumps[this.trumps.length - 1]);
        return;
    }

    this.randomPlay(cards);
};

Player.prototype.tryAddViceHonor = function(cardList, cards, numHonorOwn, game) {
    if(this.aiLevel < 3) return;
    var suite = cards[0].suite;
    var vices = [];
    for(var x=cardList.length-numHonorOwn-1; x>=0 ; x--) {
        if(cardList[x].rank === game.viceHonorRank) {
            vices.push(cardList[x]);
        } else {
            break;
        }
    }
    if(vices.length < 1) return;
    var numHonorLeft = 4 - numHonorOwn - game.honorsPlayed[suite];
    if(numHonorLeft < vices.length) {
        vices.forEach(function (c) {
            cards.push(c);
        });
    }
};

function addHonorCard(cardList, honors, honorRank) {
    if(cardList.length < 1) return;
    var xCard = cardList[cardList.length - 1];
    if(xCard.rank === honorRank) honors.push(xCard);
}

Player.prototype.playHonor = function(cards, game, maxSuiteLength) {
    var honors = [];
    if(maxSuiteLength > 0) {
        if(this.spades.length <= maxSuiteLength) addHonorCard(this.spades, honors, game.honorRank);
        if(this.hearts.length <= maxSuiteLength) addHonorCard(this.hearts, honors, game.honorRank);
        if(this.diamonds.length <= maxSuiteLength) addHonorCard(this.diamonds, honors, game.honorRank);
        if(this.clubs.length <= maxSuiteLength) addHonorCard(this.clubs, honors, game.honorRank);
    } else {
        addHonorCard(this.spades, honors, game.honorRank);
        addHonorCard(this.hearts, honors, game.honorRank);
        addHonorCard(this.diamonds, honors, game.honorRank);
        addHonorCard(this.clubs, honors, game.honorRank);
    }
    if(honors.length < 1) return false;

    if(honors.length > 1) Func.shuffleArray(honors);

    for(var x = 0, xCard, cardList; xCard = honors[x]; x++) {
        cardList = this.getCardsBySuite(xCard.suite);
        if(cardList.length > 1 && cardList[cardList.length-2].rank === game.honorRank) {
            cards.push(xCard);
            cards.push(xCard);
            this.tryAddViceHonor(cardList, cards, 2, game);
            return true;
        }

        if(!this.possibleOpponentRuff(game, xCard.suite) && game.cardsPlayed[xCard.suite] <= Config.MAX_SAFE_CARDS_PLAYED) {
            cards.push(xCard);
            this.tryAddViceHonor(cardList, cards, 1, game);
            return true;
        }
    }

    return false;
};

Player.prototype.playHonorOrPoint = function(cards, cardList, game) {
    if(cardList.length === 1) {
        cards.push(cardList[0]);
        return;
    }
    var xCard = cardList[cardList.length - 1];
    if(xCard.trumpRank(game.trump, game.rank) === 13) {
        for(var i=cardList.length - 1,c; i>=0 && (c=cardList[i]); i--){
            if(!xCard.equals(c)) break;
            cards.push(c);
        }
        this.tryAddViceHonor(cardList, cards, cards.length, game);
        return;
    }
    Card.selectCardsByPoint(cards, cardList, !(this === game.contractor || this === game.parnter), game.trump, game.rank, 1);
};

Player.prototype.findPairAndPlay = function (cards, game, findInOrder) {
    var stat,rnks,card;
    if(findInOrder) {
        // choose suite by cards played
        var arr = [];
        var stats = {};
        if(this.spades.length > 1) {
            stat = new HandStat(this.spades, game.trump, game.rank);
            if(stat.totalPairs > 0) {
                arr.push(Card.SUITE.SPADE);
                stats[Card.SUITE.SPADE] = stat;
            }
        }
        if(this.hearts.length > 1) {
            stat = new HandStat(this.hearts, game.trump, game.rank);
            if(stat.totalPairs > 0) {
                arr.push(Card.SUITE.HEART);
                stats[Card.SUITE.HEART] = stat;
            }
        }
        if(this.clubs.length > 1) {
            stat = new HandStat(this.clubs, game.trump, game.rank);
            if(stat.totalPairs > 0) {
                arr.push(Card.SUITE.CLUB);
                stats[Card.SUITE.CLUB] = stat;
            }
        }
        if(this.diamonds.length > 1) {
            stat = new HandStat(this.diamonds, game.trump, game.rank);
            if(stat.totalPairs > 0) {
                arr.push(Card.SUITE.DIAMOND);
                stats[Card.SUITE.DIAMOND] = stat;
            }
        }

        if(arr.length < 1) return false;

        arr.sort(function (a, b) {
            var aPlayedNum = game.cardsPlayed[a];
            var bPlayedNum = game.cardsPlayed[b];
            if(bPlayedNum !== aPlayedNum) bPlayedNum - aPlayedNum;
            return stats[b].totalPairs - stats[a].totalPairs;
        });

        stat = stats[arr[0]];
        rnks = stat.sortedRanks(2);
        card = stat.findCardByDupNum(rnks[rnks.length - 1], 2);
        cards.push(card);
        cards.push(card);
        return true;
    }
    var allCards = [];
    allCards = allCards.concat(this.spades);
    allCards = allCards.concat(this.hearts);
    allCards = allCards.concat(this.diamonds);
    allCards = allCards.concat(this.clubs);
    allCards = allCards.concat(this.trumps);

    stat = new HandStat(allCards, game.trump, game.rank);
    if(stat.totalPairs < 1) return false;
    rnks = stat.sortedRanks(2);
    card = stat.findCardByDupNum(rnks[rnks.length - 1], 2);
    cards.push(card);
    cards.push(card);
    return true;
};

Player.prototype.opponentHasTrump = function(game) {
    var players = this.currentTable.players;
    if(this === game.contractor || this === game.partner) {
        for(var x=0,p; p=players[x]; x++) {
            if(p === game.contractor || p === game.partner) continue;
            if(p.hasTrump()) return true;
        }
    } else {
        if(game.contractor.hasTrump()) return true;
        if(game.partner != null && game.partner.hasTrump()) return true;
    }

    return false;
};

Player.prototype.partnerHasTrump = function(game) {
    var players = this.currentTable.players;
    if(this === game.contractor) return game.partner == null || game.partner === game.contractor ? false : game.partner.hasTrump();
    if(this === game.partner) return game.contractor.hasTrump();

    for(var x=0,p; p=players[x]; x++) {
        if(p === this || p === game.contractor || p === game.partner) continue;
        if(p.hasTrump()) return true;
    }
    return false;
};

Player.prototype.playPairOrTop = function (cards, cardList, game, isTrump) {
    var stat = new HandStat(cardList, game.trump, game.rank);
    if(stat.totalPairs < 1) {
        cards.push(cardList[cardList.length - 1]);
        return;
    }

    var rnks = stat.sortedRanks(2);
    var sHand = new SimpleHand(Hand.SIMPLE_TYPE.PAIR, rnks[rnks.length - 1], isTrump);
    cc = Hand.makeCards(sHand, cardList, game.trump, game.rank);
    cc.forEach(function (c) {
        cards.push(c);
    });
};

Player.prototype.endPlayTrump = function (cards, game) {
    var stat = new HandStat(this.trumps, game.trump, game.rank);
    if(stat.totalPairs < 1) {
        if(this.partnerHasTrump(game)) {
            cards.push(this.trumps[0]);
        } else {
            cards.push(this.trumps[this.trumps.length - 1]);
        }
        return;
    }

    var rnks = stat.sortedRanks(2);
    var sHand = new SimpleHand(Hand.SIMPLE_TYPE.PAIR, rnks[rnks.length - 1], true);
    cc = Hand.makeCards(sHand, this.trumps, game.trump, game.rank);
    cc.forEach(function (c) {
        cards.push(c);
    });
};

Player.prototype.endPlay = function (cards, game) {
    if(this.playTopTrump(cards, game)) return;

    var allCards = [];
    allCards = allCards.concat(this.spades);
    allCards = allCards.concat(this.hearts);
    allCards = allCards.concat(this.diamonds);
    allCards = allCards.concat(this.clubs);

    if(allCards.length < 1) {
        // all trumps left
        this.endPlayTrump(cards, game);
        return;
    }

    if(this.opponentHasTrump(game)) {
        if(game.contractor !== game.partner && this.partnerHasTrump(game)) {
            var suite = null;
            if(this === game.contractor) {
                suite = this.choosePartnerVoidSuite(game, game.partner, null);
            } else if(this === game.partner) {
                suite = this.choosePartnerVoidSuite(game, game.contractor, null);
            }
            if(suite != null) {
                var cardList = this.getCardsBySuite(suite);
                Card.selectCardsByPoint(cards, cardList, !this.possibleOpponentRuff(game, suite), game.trump, game.rank, 1);
                return;
            }
        }

        var total = this.totalCardLeft();
        if(this.trumps.length >= total / 2) {
            this.endPlayTrump(cards, game);
        } else {
            if(this.findPairAndPlay(cards, game)) return;
            allCards.sort(Card.compareRank);
            var x = allCards.length - 1;
            var xCard = allCards[x];
            var tCard = xCard;
            var checkedSuites = [];
            do {
                if(!this.possibleOpponentRuff(game, tCard.suite)) {
                    cards.push(tCard);
                    return;
                }
                if(x < 1) break;
                checkedSuites.push(tCard.suite);
                x--;
                tCard = allCards[x];
                while(checkedSuites.includes(tCard.suite)) {
                    x--;
                    if(x < 0) break;
                    tCard = allCards[x];
                }
            } while(x>=0);

            x = allCards.length - 1;
            while(xCard.getPoint() > 0) {
                if(x < 1) break;
                x--;
                xCard = allCards[x];
            }
            cards.push(xCard);
        }
    } else {
        allCards.sort(Card.compareRank);
        var xCard = allCards[allCards.length - 1];
        if(xCard.trumpRank(game.trump, game.rank) === 13) {
            cards.push(xCard);
            if(allCards.length > 1) {
                if(allCards[allCards.length - 2].equals(xCard)) {
                    cards.push(xCard);
                }
            }
        } else {
            if(game.contractor !== game.partner && this.partnerHasTrump(game)) {
                var suite = null;
                if(this === game.contractor) {
                    suite = this.choosePartnerVoidSuite(game, game.partner, null);
                } else if(this === game.partner) {
                    suite = this.choosePartnerVoidSuite(game, game.contractor, null);
                }
                if(suite != null) {
                    var cardList = this.getCardsBySuite(suite);
                    Card.selectCardsByPoint(cards, cardList, !this.possibleOpponentRuff(game, suite), game.trump, game.rank, 1);
                    return;
                }
            }

            if(this.trumps.length > 1) {
                this.endPlayTrump(cards, game);
                return;
            }

            if(this.findPairAndPlay(cards, game)) return;
            cards.push(xCard);
        }
    }
};

Player.prototype.randomPlay = function (cards) {
    // not totally random
    var game = this.currentTable.game;
    if(this.aiLevel >= 2 && this.totalCardLeft() <= Config.CARD_NUMBER_ENDPLAY) {
        this.endPlay(cards, game);
        return;
    }

    if(this.aiLevel >= 3 && this !== game.contractor) {
        if(this.playTopTrump(cards, game)) return;
    }

    var exSuite = game.partnerDef.suite;
    var arr = [];
    var arrSuite = [];
    for (var i = 0, suit, lst; suit = Card.SUITES[i]; i++) {
        if (suit === exSuite) continue;
        lst = this.getCardsBySuite(suit);
        if (lst.length < 1) continue;
        arr.push(lst);
        arrSuite.push(suit);
    }

    if(arr.length >= 1 && this.aiLevel >= 2) {
        var suite = null;
        if(this === game.contractor) {
            if(game.partner != null) {
                suite = this.choosePartnerVoidSuite(game, game.partner, null);
                if(suite != null) {
                    var cardList = this.getCardsBySuite(suite);
                    Card.selectCardsByPoint(cards, cardList, !this.possibleOpponentRuff(game, suite), game.trump, game.rank, 1);
                    return;
                }
            }

            if(this.aiLevel >= 3) {
                if(this.findPairAndPlay(cards, game, true)) return;
            }
        } else {
            var arr1 = [];  // first choice: partner ruff possible, opponent not
            var arr2 = [];  // second choice: opponent unable ruff
            var arr3 = [];  // third choice: both partner and opponent possible ruff
            for(var x=0, s; s=arrSuite[x]; x++) {
                if(this.possibleOpponentRuff(game, s)) {
                    if(this.possiblePartnerRuff(game, s)) {
                        arr3.push(s);
                    }
                } else {
                    if(this.possiblePartnerRuff(game, s)) {
                        arr1.push(s);
                    } else {
                        arr2.push(s);
                    }
                }
            }

            var j = 0;
            if(arr1.length > 0) {
                if(arr1.length > 1) j = Math.floor(Math.random() * (arr1.length));
                this.playHonorOrPoint(cards, this.getCardsBySuite(arr1[j]), game);
                return;
            }
            if(arr2.length > 0) {
                if(arr2.length > 1) j = Math.floor(Math.random() * (arr2.length));
                this.playHonorOrPoint(cards, this.getCardsBySuite(arr2[j]), game);
                return;
            }

            if(arr3.length > 0) {
                if(arr3.length > 1) j = Math.floor(Math.random() * (arr3.length));
                Card.selectCardsByPoint(cards, this.getCardsBySuite(arr3[j]), false, game.trump, game.rank, 1);
                return;
            }

            var lst = this.getCardsBySuite(exSuite);
            if(lst.length>0) {
                if(this.possiblePartnerRuff(game, exSuite) || !this.possibleOpponentRuff(game, exSuite)) {
                    Card.selectCardsByPoint(cards, lst, false, game.trump, game.rank, 1);
                    return;
                }
            }

            if(this.findPairAndPlay(cards, game)) {
                return;
            }
        }
    }

    var x = 0;
    if (arr.length < 1) {
        if (this.trumps.length > 0) {
            arr.push(this.trumps);
        } else {
            arr.push(this.getCardsBySuite(exSuite));
        }
    } else if(this.aiLevel >= 2) {
        if(arr.length > 1) x = Math.floor(Math.random() * (arr.length));
        var s = arrSuite[x];
        if(this.possibleOpponentRuff(game, s)) {
            Card.selectCardsByPoint(cards, this.getCardsBySuite(s), false, game.trump, game.rank, 1);
        } else {
            this.playHonorOrPoint(cards, this.getCardsBySuite(s), game);
        }

        return;
    }

    if(arr.length > 1) x = Math.floor(Math.random() * (arr.length));
    var y = Math.floor(Math.random() * (arr[x].length));

    var card = arr[x][y];
    for(var i=0,c;c=arr[x][i];i++){
        if(card.equals(c)) cards.push(c);
    }
};

Player.prototype.shouldKeepTopTrump = function(game){
    if(this.orgLength[Card.SUITE.JOKER] < Config.AVERAGE_TRUMP_LENGTH - 1) return false;
    var xCard = this.trumps[this.trumps.length - 1];
    return xCard.trumpRank(game.trump, game.rank) > 13;  // true if game rank cards and jokers
};

Player.prototype.followPlay = function (cards, cardList, pointFirst) {
    var game = this.currentTable.game;
    var firstHand = game.currentRound.getFirstHand();
    var keepTop = false;
    if(!pointFirst && this.aiLevel >= 2 && firstHand.isTrump && cardList[0].isTrump(game.trump, game.rank)) {
        keepTop = this.shouldKeepTopTrump(game);
    }

    var tmpCards = cardList.slice();
    switch(firstHand.type.cat) {
        case Hand.COMBINATION.SINGLE:
            if(this.aiLevel >= 2) {
                Card.selectCardsSmart(cards, tmpCards, pointFirst, game.trump, game.rank, firstHand.cardNumber, keepTop);
            } else {
                Card.selectCardsByPoint(cards, tmpCards, pointFirst, game.trump, game.rank, firstHand.cardNumber, keepTop);
            }
            break;
        case Hand.COMBINATION.PAIR:
        case Hand.COMBINATION.TRIPS:
        case Hand.COMBINATION.QUADS:
            for (var x = 0, n = firstHand.cardNumber / firstHand.type.len; x < n; x++) {
                tmpCards = Card.selectSimpleHandByPoint(firstHand.type, cards, tmpCards, pointFirst, game.trump, game.rank, keepTop);
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
                Mylog.log(new Date().toLocaleString() + ', ERROR: MIXED_HAND subHands=null, ' + Card.showCards(firstHand.cards));
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
            Mylog.log(new Date().toLocaleString() + ', UNKNOWN HAND COMBINATION:' + firstHand.type.cat);
            Card.selectCardsByPoint(cards, cardList, pointFirst, game.trump, game.rank, firstHand.cardNumber);
            break;
    }
};

Player.prototype.tryBeatLeading = function (cards, cardList, sameSide) {
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
                var minPlayed = this.aiLevel >= 2 ? 6 : 10;
                if(cardList.length>1 && game.partner == null) {
                    var partnerDef = game.partnerDef;
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

                                Card.selectCardsByPoint(cards, cardList, false, game.trump, game.rank, 1);
                                return false;
                            }

                            if(this.isDeadPartner()) {
                                if(viceCard.indexOf(cardList) >= 0) {
                                    cards.push(viceCard);
                                } else {
                                    cards.push(card);
                                }
                                return true;
                            }

                            if(game.cardNumberPlayed >= minPlayed && this.shouldPlayPartner()) {
                                cards.push(card);
                                return true;
                            }

                            if (viceRank > leadingHand.maxRank && viceCard.indexOf(cardList) >= 0) {
                                cards.push(viceCard);
                                return true;
                            }
                            Card.selectCardsByPoint(cards, cardList, false, game.trump, game.rank, 1);
                            return false;
                        }
                    }
                }

                if(this.aiLevel >= 2) {
                    if(game.currentRound.allFriendsLeft(game, this) || this.noOpponentCanBeat(game, firstHand.suite)) {
                        var tmpCards = [];
                        for(var x=cardList.length-1, c; c=cardList[x]; x--) {
                            if(c.trumpRank(game.trump, game.rank) <= leadingHand.maxRank) break;
                            tmpCards.push(c);
                        }
                        Card.selectCardsByPoint(cards, tmpCards, true, game.trump, game.rank, 1);
                        return true;
                    }

                    if(!leadingHand.isTrump && this.possibleOpponentRuff(game, firstHand.suite)) {
                        var x = cardList.length - 1;
                        while(card.getPoint() > 0) {
                            if(x < 1) break;
                            x--;
                            card = cardList[x];
                        }
                        cards.push(card);
                        return card.trumpRank(game.trump, game.rank) > leadingHand.maxRank;
                    }
                }
                cards.push(card);
                return true;
            } else {
                var keepTop = false;
                if(this.aiLevel >= 2 && firstHand.isTrump ) {
                    keepTop = this.shouldKeepTopTrump(game);
                }
                if(this.aiLevel >= 2) {
                    Card.selectCardsSmart(cards, cardList, false, game.trump, game.rank, 1, keepTop);
                } else {
                    Card.selectCardsByPoint(cards, cardList, false, game.trump, game.rank, 1, keepTop);
                }
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

    if(sameSide && firstHand.cardNumber > 1 && this.aiLevel >= 2 && this.totalCardLeft() <= Config.CARD_NUMBER_ENDPLAY) {
        this.followPlay(cards, cardList, true);
        return false;
    }
    this.followPlay(cards, cardList, false);
    var tHand = new Hand(this, cards, game.trump, game.rank);
    return tHand.compareTo(leadingHand, firstHand) > 0;
};

Player.prototype.trumpExclusive = function (cards) {
    if (this.ntLength() > 0) return false;
    for (var x = 0, p; p = this.currentTable.players[x]; x++) {
        if (p === this) continue;
        if (p.trumps.length > 0) return false;
    }
    this.trumps.forEach(function (c) {
        cards.push(c);
    });

    return true;
};

Player.prototype.suggestedCards = function () {
    var game = this.currentTable.game;
    if (this === game.leadingPlayer) return null;
    var round = game.currentRound;

    var firstHand = round.getFirstHand();
    if (firstHand.cardNumber < 2) return null;

    var cardList;
    var suite = firstHand.suite;
    if (firstHand.isTrump) {
        cardList = this.trumps;
        suite = Card.SUITE.JOKER;
    } else {
        cardList = this.getCardsBySuite(suite);
    }

    if (cardList.length <= firstHand.cardNumber) {
        return null;
    }

    var cards = this.autoPlayCards(false);
    if (cards.length < firstHand.cardNumber) return null;
    return Card.cardsToString(cards);
};

Player.prototype.noOpponentCanBeat = function (game, suite) {
    var players = this.currentTable.players;
    var startIdx = this.currentTable.getSeat(this);
    if(startIdx >= players.length) startIdx = 0;
    var firstPlayer = game.leadingPlayer;
    var isTrump = suite === Card.SUITE.JOKER;

    if(game.partner != null) {
        for(var x = startIdx, p; ; x++) {
            if(x === players.length) x = 0;
            p = players[x];
            if(p === firstPlayer) break;
            if(this === game.contractor || this === game.partner) {
                if(p === game.contractor || p === game.partner) continue;
                if(isTrump) {
                    if(p.hasTrump()) return false;
                } else {
                    if(p.voids[suite]) {
                        if(p.hasTrump()) return false;
                    } else {
                        return false;
                    }
                }
            } else {
                if(p === game.contractor || p === game.partner) {
                    if(isTrump) {
                        if(p.hasTrump()) return false;
                    } else {
                        if(p.voids[suite]) {
                            if(p.hasTrump()) return false;
                        } else {
                            return false;
                        }
                    }
                }
            }
        }
    } else {
        for(var x = startIdx, p; ; x++) {
            if(x === players.length) x = 0;
            p = players[x];
            if(p === firstPlayer) break;
            if(isTrump) {
                if(p.hasTrump()) return false;
            } else {
                if(p.voids[suite]) {
                    if(p.hasTrump()) return false;
                } else {
                    return false;
                }
            }
        }
    }
    return true;
};

Player.prototype.possibleOpponentRuff = function (game, suite, exPlayer) {  // exPlayer - exclude specific player
    var players = this.currentTable.players;
    var startIdx = this.currentTable.getSeat(this);
    if(startIdx >= players.length) startIdx = 0;
    var firstPlayer = game.leadingPlayer;

    if(game.partner != null) {
        for(var x = startIdx, p; ; x++) {
            if(x === players.length) x = 0;
            p = players[x];
            if(p === firstPlayer) break;
            if(p === exPlayer) continue;
            if(this === game.contractor || this === game.partner) {
                if(p === game.contractor || p === game.partner) continue;
                if(p.voids[suite] && p.hasTrump()) return true;
            } else {
                if(p === game.contractor || p === game.partner) {
                    if(p.voids[suite] && p.hasTrump()) return true;
                }
            }
        }

        var partnerDef = this.currentTable.game.partnerDef;
        if(this !== firstPlayer && !partnerDef.noPartner && firstPlayer === game.partner && suite === partnerDef.suite && this !== game.contractor) {
            if(game.currentRound.allFriendsLeft(game, this)) return false;
            return game.contractor.hasTrump();
        }
    } else {
        //debugger;
        for(var x = startIdx, p; ; x++) {
            if(x === players.length) x = 0;
            p = players[x];
            if(p === firstPlayer) break;
            if(p === exPlayer) continue;
            if(p.voids[suite] && p.hasTrump()) return true;
        }
    }
    return false;
};

Player.prototype.possiblePartnerRuff = function (game, suite) {
    var players = this.currentTable.players;
    var startIdx = this.currentTable.getSeat(this);
    if(startIdx >= players.length) startIdx = 0;
    var firstPlayer = game.leadingPlayer;


    for(var x = startIdx, p; ; x++) {
        if(x === players.length) x = 0;
        p = players[x];
        if(p === firstPlayer) break;
        if(this === game.contractor || this === game.partner) {
            if(p === game.contractor || p === game.partner) {
                if(p.voids[suite] && p.hasTrump()) return true;
            }
        } else {
            if(p === game.contractor || p === game.partner) continue;
            if(p.voids[suite] && p.hasTrump()) return true;
        }
    }
    return false;
};

Player.prototype.recalStrong = function (cards) {
    var game = this.currentTable.game;
    var honorRank = game.honorRank;
    var viceRank = game.viceHonorRank;
    var xRank = cards[cards.length-1].rank;
    var cardList = this.getCardsBySuite(cards[0].suite);
    if(xRank === honorRank) {
        if(cards.length != 4) return cards;
        var nCards = [];
        for(var x=cardList.length-1,c; c=cardList[x]; x--) {
            if(c.rank < viceRank) break;
            nCards.push(c);
        }
        return nCards;
    }

    if(game.partner != null) {
        if(this !== game.partner && this !== game.contractor) {
            if(game.partnerDef.suite === cards[0].suite) return cards;
        }
        if(this.possibleOpponentRuff(game, cards[0].suite)) return cards;
    } else {
        if(this.possibleOpponentRuff(game, cards[0].suite, game.partnerDef.suite === cards[0].suite ? game.contractor : null)) return cards;
    }

    var nCards = [];
    for(var x=cardList.length-1,c; c=cardList[x]; x--) {
        if(c.rank < honorRank) break;
        nCards.push(c);
    }
    return nCards.length > 0 ? nCards : cards;
};

Player.prototype.playTopTrump = function (cards, game) {
    if(this.trumps.length < 1 || game.trump === Card.SUITE.JOKER) return false;
    if(!this.opponentHasTrump(game)) return false;

    var card = this.trumps[this.trumps.length - 1];
    if(card.rank < Card.RANK.SmallJoker) return false;
    var xRank = card.trumpRank(game.trump, game.rank);
    var players = this.currentTable.players;
    for(var x=0,p; p=players[x]; x++) {
        if(p === this || p.trumps.length < 1) continue;
        if(p.trumps[p.trumps.length-1].trumpRank(game.trump, game.rank) > xRank) return false;
    }

    cards.push(card);
    if(this.trumps.length > 1 && this !== game.partner) {
        if(this.trumps[this.trumps.length - 2].equals(card)) cards.push(card);
    }
    return true;
};

Player.prototype.autoPlayCards = function (isLeading) {
    this.aiLevel = this.currentTable.getAiLevel();
    if(this.id) {
        if(this.property.aiLevel > this.aiLevel) this.aiLevel = this.property.aiLevel;
    }

    var cards = [];
    var game = this.currentTable.game;
    var round = game.currentRound;
    if (isLeading) {
        var nLeft = this.totalCardLeft();
        if (nLeft < 2) {
            this.playAllCards(cards);
            return cards;
        }

        if (this.trumpExclusive(cards)) {
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
            if(this.aiLevel >= 2 && !cards[0].isTrump(game.trump, game.rank)) {
                cards = this.recalStrong(strongHand);
            }
        } else {
            if (game.partner == null) {
                if (this === game.contractor) {
                    if(this.aiLevel >= 3) {
                        if(this.playHonor(cards, game, Config.MAX_SAFE_CARDS_PLAYED + 1)) return cards;
                    }
                    this.passToPartner(cards);
                } else if (this.shouldPlayPartner()) {
                    if(!this.playPartnerCards(cards)) this.randomPlay(cards);
                } else {
                    this.randomPlay(cards);
                }
            } else {
                if (this === game.partner) {
                    if(this.aiLevel >= 2) {
                        if(this.playTopTrump(cards, game)) return cards;
                        if(this.playHonor(cards, game)) return cards;
                    }
                    this.passToPartner(cards);
                } else if (this === game.contractor) {
                    if(this.aiLevel >= 2) {
                        if(this.playHonor(cards, game)) return cards;
                    }
                    this.drawTrump(cards);
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
                    var pointFirst = true;
                    if(!firstHand.isTrump && this.aiLevel >= 2) {
                        if(firstHand.cardNumber < 2) {
                            pointFirst = round.getLeadingHand().isTrump || !this.possibleOpponentRuff(game, suite);
                        }
                    }
                    this.followPlay(cards, cardList, pointFirst);
                } else {
                    this.tryBeatLeading(cards, cardList, true);
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
                if(this.aiLevel >= 2 && firstHand.cardNumber > 1 && this.totalCardLeft() <= Config.CARD_NUMBER_ENDPLAY
                        && game.isSameSide(this, leadingPlayer)) {
                    this.duckCards(cards, suite, true, firstHand.cardNumber);
                    return cards;
                }
                if (game.isSameSide(this, leadingPlayer) && round.isWinning(game, this)) {
                    if(firstHand.cardNumber < 3 && this.aiLevel >= 2) {
                        if(!round.getLeadingHand().isTrump && this.possibleOpponentRuff(game, suite)) {
                            this.ruff(cards);
                            return cards;
                        }
                    }
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
                var pointFirst = game.isSameSide(this, leadingPlayer);
                if(pointFirst) {
                    if(this.aiLevel >= 2 && this.totalCardLeft() <= Config.CARD_NUMBER_ENDPLAY) {
                        this.duckCards(cards, suite, true, firstHand.cardNumber - cards.length);
                    } else {
                        this.duckCards(cards, suite, round.isWinning(game, this), firstHand.cardNumber - cards.length);
                    }
                } else {
                    this.duckCards(cards, suite, false, firstHand.cardNumber - cards.length);
                }
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
        var stat = new HandStat(cardList, game.trump, game.rank);

        var handStat, tractors, playedTractors;
        var totalTractorLen;
        switch (firstHand.type.cat) {
            case Hand.COMBINATION.SINGLE:
                return true;
            case Hand.COMBINATION.PAIR:
                return hand.type.cat === firstHand.type.cat || stat.totalPairs === hand.totalPairs;
            case Hand.COMBINATION.TRIPS:
                if (hand.type.cat === firstHand.type.cat || stat.totalPairs < 1) return true;
                return stat.totalTrips < 1 ? hand.totalPairs > 0 : false;
            case Hand.COMBINATION.QUADS:
                if (hand.type.cat === firstHand.type.cat || stat.totalPairs < 1) return true;
                if (stat.totalQuads > 0) return false;
                if (stat.totalTrips > 0) {
                    return hand.totalTrips > 0;
                }
                if (hand.type.cat === Hand.COMBINATION.TRACTOR2) return true;
                if (stat.getTractors(2, firstHand.isTrump).length > 0) return false;
                return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
            case Hand.COMBINATION.TRACTOR2:
                if (hand.type.cat === firstHand.type.cat || stat.totalPairs < 1) return true;

                tractors = stat.getTractors(2, firstHand.isTrump);
                if (tractors.length < 1) {
                    return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
                }
                handStat = new HandStat(hand.cards, game.trump, game.rank);
                playedTractors = handStat.getTractors(2, firstHand.isTrump);
                if (playedTractors.length < 1) return false;
                if (tractors[tractors.length - 1].type.len > playedTractors[playedTractors.length - 1].type.len) return false;

                totalTractorLen = HandStat.totalTractorLength(tractors);
                if (totalTractorLen <= firstHand.type.len) {
                    if (HandStat.totalTractorLength(playedTractors) < totalTractorLen) return false;
                }

                return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
            case Hand.COMBINATION.TRACTOR3:
                if (hand.type.cat === firstHand.type.cat || stat.totalPairs < 1) return true;

                tractors = stat.getTractors(3, firstHand.isTrump);
                if (tractors.length < 1) {
                    if (stat.totalTrips < 1) {
                        var tractors2 = stat.getTractors(2, firstHand.isTrump);
                        if (tractors2.length < 1) {
                            return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
                        }
                        handStat = new HandStat(hand.cards, game.trump, game.rank);
                        playedTractors = handStat.getTractors(2, firstHand.isTrump);
                        if (playedTractors.length < 1) return false;
                        return true;
                    }
                    if (hand.totalTrips === firstHand.totalTrips) return true;
                    return hand.totalTrips === stat.totalTrips &&
                            (hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs);
                }

                handStat = new HandStat(hand.cards, game.trump, game.rank);
                playedTractors = handStat.getTractors(3, firstHand.isTrump);
                if (playedTractors.length < 1) return false;
                if (tractors[tractors.length - 1].type.len > playedTractors[playedTractors.length - 1].type.len) return false;

                totalTractorLen = HandStat.totalTractorLength(tractors);
                if (totalTractorLen <= firstHand.type.len) {
                    if (HandStat.totalTractorLength(playedTractors) < totalTractorLen) return false;
                }

                return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
            case Hand.COMBINATION.TRACTOR4:
                if (hand.type.cat !== firstHand.type.cat) {
                    if (hand.totalQuads === firstHand.totalQuads) return true;
                    if (stat.totalQuads >= firstHand.totalQuads) return false;
                    if (hand.totalQuads < stat.totalQuads) return false;

                    if (hand.totalTrips >= firstHand.totalTrips) return true;
                    if (stat.totalTrips >= firstHand.totalTrips) return false;
                    if (hand.totalTrips < stat.totalTrips) return false;

                    var pairNeeded = (firstHand.totalQuads - hand.totalTrips) * 2 + hand.totalTrips;
                    return hand.totalPairs >= pairNeeded || hand.totalPairs === stat.totalPairs;
                }
                break;
            case Hand.COMBINATION.MIXED:
                if (firstHand.subHands != null) {
                    var lastIdx = firstHand.subHands.length - 1;
                    var subLast = firstHand.subHands[lastIdx];
                    switch (subLast.type.cat) {
                        case Hand.COMBINATION.SINGLE:
                            return true;
                        case Hand.COMBINATION.PAIR:
                            return hand.totalPairs >= firstHand.totalPairs || stat.totalPairs === hand.totalPairs;
                        case Hand.COMBINATION.TRIPS:
                            if (hand.totalTrips > 0) return true;
                            if (stat.totalTrips > 0) return false;
                            return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
                        case Hand.COMBINATION.QUADS:
                            if (hand.totalQuads > 0) return true;
                            if (stat.totalQuads > 0) return false;
                            if (stat.totalTrips > 0) {
                                return hand.totalTrips > 0;
                            }
                            if (stat.getTractors(2, firstHand.isTrump).length < 1) {
                                return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
                            }

                            handStat = new HandStat(hand.cards, game.trump, game.rank);
                            playedTractors = handStat.getTractors(2, firstHand.isTrump);
                            return playedTractors.length > 0;
                        case Hand.COMBINATION.TRACTOR2:
                            tractors = stat.getTractors(2, firstHand.isTrump);
                            if (tractors.length < 1) {
                                return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
                            }
                            handStat = new HandStat(hand.cards, game.trump, game.rank);
                            playedTractors = handStat.getTractors(2, firstHand.isTrump);
                            if (playedTractors.length < 1) return false;
                            var xp = playedTractors.length - 1;
                            if (playedTractors[xp].type.len < subLast.type.len) {
                                var xa = tractors.length - 1;
                                if (tractors[xa].type.len > playedTractors[xp].type.len) return false;
                            }

                            totalTractorLen = HandStat.totalTractorLength(tractors);
                            if (totalTractorLen <= subLast.type.len) {
                                if (HandStat.totalTractorLength(playedTractors) < totalTractorLen) return false;
                            }
                            return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
                        case Hand.COMBINATION.TRACTOR3:
                            tractors = stat.getTractors(3, firstHand.isTrump);
                            if (tractors.length < 1) {
                                if (stat.totalTrips < 1) {
                                    var tractors2 = stat.getTractors(2, firstHand.isTrump);
                                    if (tractors2.length < 1) {
                                        return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
                                    }
                                    handStat = new HandStat(hand.cards, game.trump, game.rank);
                                    playedTractors = handStat.getTractors(2, firstHand.isTrump);
                                    if (playedTractors.length < 1) return false;
                                    return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
                                }
                                if (hand.totalTrips * 3 < subLast.type.len) {
                                    return hand.totalTrips === stat.totalTrips &&
                                            (hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs);
                                }
                                return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
                            }
                            handStat = new HandStat(hand.cards, game.trump, game.rank);
                            playedTractors = handStat.getTractors(3, firstHand.isTrump);
                            if (playedTractors.length < 1) return false;

                            totalTractorLen = HandStat.totalTractorLength(tractors);
                            if (totalTractorLen <= subLast.type.len) {
                                if (HandStat.totalTractorLength(playedTractors) < totalTractorLen) return false;
                            }
                            return hand.totalPairs >= firstHand.totalPairs || hand.totalPairs === stat.totalPairs;
                        case Hand.COMBINATION.TRACTOR4:
                            if (hand.totalQuads * 4 < subLast.type.len) {
                                if (hand.totalTrips * 4 >= subLast.type.len) return true;
                                var pairNeeded = (firstHand.totalQuads - hand.totalTrips) * 2 + hand.totalTrips;
                                return hand.totalQuads === stat.totalQuads &&
                                        (hand.totalPairs >= pairNeeded || hand.totalPairs === stat.totalPairs);
                            }
                            break;
                    }
                }
                break;
        }
    } else if (cardList.length > 0) {
        if (!Card.containsAll(hand.cards, cardList)) return false;
    }

    return true;
};

Player.prototype.playCards = function (strCards) {
    if (this.totalCardLeft() < 1) return 'error';    // no card to play
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
//            Mylog.log('hand type: ' + hand.type.cat);
//            Mylog.log('is flop: ' + hand.isFlop);
            if (hand.type.cat === Hand.COMBINATION.MIX_SUITE) {
                cards = this.autoPlayCards(isLeading);
                hand = null;
            } else {
                if (!game.isLeadingHandValid(hand)) {
                    Mylog.log('invalid leading: ' + strCards);
                    var orgLen = cards.length;
                    var orgCards = Card.showCards(cards);
                    cards = Hand.makeCards(this.mustLead, cards, game.trump, game.rank);
                    this.matchInfo.penalty = (cards.length - orgLen) * 10;
                    this.matchInfo.totalPenalty += this.matchInfo.penalty;
                    this.matchInfo.alert = {
                        'zh': this.name + ': 甩牌失败,罚' + (-this.matchInfo.penalty) + '分',
                        'en': this.name + ': Invalid Flop, penalty: ' + (-this.matchInfo.penalty) + ' points'
                    };
                    this.currentTable.broadcastMessage(this.matchInfo.alert);
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
        Mylog.log(new Date().toLocaleString() + ', Exception:  player.playCards(), isLeading: ' + isLeading
           + ', this=' + this.name + ', contractor=' + game.contractor.name + ', partner=' + (game.partner == null ? 'null': game.partner.name));
        Mylog.log('table_id: ' + this.currentTable.id + ', game: ' + this.currentTable.games.length);
        Mylog.log(this.showHand());
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
            Mylog.log('AUTO-BURY: BURY POINT!');
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
                Mylog.log('AUTO-BURY: BURY TRUMP!!!');
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
    if (Config.DEBUGGING) Mylog.log("hole cards: " + strCards);
    this.pushJson({
        action: 'bury',
        cards: strCards
    });
};

Player.prototype.promote = function (delta) {
    this.matchInfo.currentRank = this.currentTable.getNextRank(this.matchInfo.currentRank, delta);
};

Player.prototype.evaluate = function () {
    var numGames = this.currentTable.games.length;
    if (numGames > 1) {
      //debugger;
        var lastGame = this.currentTable.games[numGames - 2];
        if (lastGame.contractor === this) {
            if (lastGame.result < -1) {
                this.canBid = false;
                this.matchInfo.alert = {
                    'zh': this.name + ': 禁叫，上局垮庄:' + (lastGame.result),
                    'en': this.name + ': Bid forbidden, last contract down ' + (-lastGame.result)
                };
                return;
            }

            if (lastGame.result < 0 && numGames > 2) {
                var preGame = this.currentTable.games[numGames - 3];
                if (preGame.contractor === this && preGame.result < 0) {
                    this.canBid = false;
                    this.matchInfo.alert = {
                        'zh': this.name + ': 禁叫，连续垮庄',
                        'en': this.name + ': Bid forbidden, consecutive contract down'
                    };
                    return;
                }
            }
        }
    }
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
//        Mylog.log(Card.showCards(iTrumps));

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
//        Mylog.log(point);
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
    if (Config.DEBUGGING) Mylog.log('minBid: ' + this.minBid + "\n");
};

Player.prototype.sendMessage = function (msg) {
    if (this.sock == null)
        return;

    if (this.messageTimer) {
        clearTimeout(this.messageTimer);
    }

    var json = {
        action: 'info',
        info: msg
    };

    this.pushJson(json);
    this.messageTimer = setTimeout(function (p) {
        p.pushJson({
            action: 'info',
            info: '.'
        });
        p.messageTimer = null;
    }, 10000, this);
};

// langMsg: {en: "", zh: "", ...}
Player.prototype.sendNotification = function (langMsg) {
    if (this.sock == null)
        return;

    if (this.messageTimer) {
        clearTimeout(this.messageTimer);
    }

    var msg = langMsg[this.lang];
    if(msg == null) msg = langMsg['en'];
    if(msg == null) return;

    var json = {
        action: 'info',
        info: msg
    };

    this.pushJson(json);
};
