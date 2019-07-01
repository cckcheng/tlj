module.exports = {Game, Hand, SimpleHand};

var Card = require('./card');
var Deck = require('./deck');
var Table = require('./table');
var HandStat = require('./stat');

function Game(players, deckNumber) {
    this.players = players;
    this.deckNumber = deckNumber;
    this.totalPoint = deckNumber * 100;
    this.initBidPoint = this.totalPoint * 0.7;
    this.stage = Game.BIDDING_STAGE;

    this.collectedPoint = 0;
    this.contractPoint = this.initBidPoint;

    this.contractor = null;
    this.partner = null;

    this.leadingPlayer = null;
    this.trump = null;

    this.deck = new Deck(deckNumber);
    this.deck.deal(this.players);

    this.holeCards = [];
    this.rounds = [];
    this.cardsPlayed = 0;
    this.currentRound = null;
    this.partnerDef = null;

    this.setPartnerDef = function (def) {
        if (this.partnerDef != null) return;
        if(def == null) {
            def = this.contractor.autoPartner();
        }

        this.partnerDef = new PartnerDef(def);
        if (this.partnerDef.noPartner) {
            this.partner = this.contractor;
        }
        return def;
    };

    this.isSameSide = function (player1, player2) {
        if (this.partner == null) return false;
        return (player1 === this.contractor || player1 === this.partner) ===
            (player2 === this.contractor || player2 === this.partner);
    };

    this.sumPoints = function (exPlayer) {
        var sum = this.collectedPoint;
        for (var x = 0, p; p = players[x]; x++) {
            if (p === exPlayer) continue;
            sum += p.matchInfo.points;
        }
        return sum;
    };
}

function PartnerDef(def) {
    this.noPartner = def === '0';
    this.suite = def.charAt(0);
    var card = this.suite;
    var seq = 0;
    if (!this.noParter) {
        var rnk = Card.StringToRank(def.charAt(1));
        this.keyCard = new Card(this.suite, rnk);
        card += Card.StringToRank(def.charAt(1));
        seq = 1 + parseInt(def.charAt(2));
    }

    this.keyCardCount = 0;
    this.partnerMatch = function(cards) {
        if(this.noParter) return false;
        var idx = -1;
        while(true) {
            idx = cards.indexOf(card, idx+1);
            if(idx<0) break;
            this.keyCardCount++;
            if(this.keyCardCount === seq) return true;
        }
        return false;
    };

    this.getDef = function() {
        return def;
    };

    this.getSeq = function() {
        return seq;
    };

    this.getDefCard = function () {
        return Card.fromString(card);
    };

    this.getViceCard = function (gameRank) {
        var defCard = this.getDefCard();
        var rnk = defCard.rank - 1;
        if (rnk === gameRank) rnk--;
        return new Card(defCard.suite, rnk);
    };
}

Game.BIDDING_STAGE = 'bid';
Game.PLAYING_STAGE = 'play';

function Hand(player, cards, trump, rank) {
    this.player = player;
    this.cards = cards;
    this.type = {cat: 0, len: 1};
    this.isTrump = false;
    this.isFlop = false;    // play mixed cards together
    this.maxRank = 0;
    this.minRank = 0;
    this.totalPairs = 0;
    this.totalTrips = 0;
    this.totalQuads = 0;

    this.doAnalysis(cards, trump, rank);

    this.compareTo = function (other, firstHand) {
        if (other == null) return 1;
        if (this.type.cat === Hand.COMBINATION.MIX_SUITE) {
            this.player.setVoids(firstHand.suite, true);
            return -1;
        }
        if (other.type.cat === Hand.COMBINATION.MIX_SUITE) return 1;
        this.player.setVoids(firstHand.suite, this.suite !== firstHand.suite);
        if (!this.isTrump && this.suite !== other.suite) return -1;

        if (this.cardNumber === 4 && this.type.cat === Hand.COMBINATION.QUADS && other.type.cat === Hand.COMBINATION.TRACTOR2) {
            return 1;
        }

//        if (firstHand.type.cat !== Hand.COMBINATION.MIXED) {
        if (!firstHand.isFlop) {
            if (this.type.cat !== other.type.cat) return -1;
            if (!this.isTrump && other.isTrump) return -1;
            if (this.isTrump && !other.isTrump) return 1;
            return this.maxRank > other.maxRank ? 1 : -1;
        }
        // Flop play
        if (!this.isTrump || firstHand.isTrump) return -1;

        // possible ruff
        if (this.totalPairs < firstHand.totalPairs || this.totalTrips < firstHand.totalTrips || this.totalQuads < firstHand.totalQuads) return -1;
        if (firstHand.subHands == null || firstHand.subHands.length < 1) {
            if (firstHand === other) return 1;   // valid ruff
            return this.maxRank > other.maxRank ? 1 : -1; // possible overruff
        }

        // more comparation, mixed combination
        var tmpCards = this.cards.slice();
        var stat = new HandStat(tmpCards, trump, rank);
        var statOther;
        if (other.isTrump) {
            statOther = new HandStat(other.cards, trump, rank);
        }

        var x = firstHand.subHands.length - 1;
        var sHand = firstHand.subHands[x];
        var rnks, tractors, tractorsOther;
        switch (sHand.type.cat) {
            case Hand.COMBINATION.PAIR:
            case Hand.COMBINATION.TRIPS:
            case Hand.COMBINATION.QUADS:
                rnks = stat.sortedRanks(sHand.type.len);
                if (rnks < 1) return -1;
                if (other.isTrump) {
                    var rnksOther = statOther.sortedRanks(sHand.type.len);
                    if (rnksOther[rnksOther.length - 1] >= rnks[rnks.length - 1]) return -1;
                }
                break;
            case Hand.COMBINATION.TRACTOR2:
                tractors = stat.getTractors(2, true);
                if (tractors.length < 1) return -1;
                if (tractors[tractors.length - 1].type.len < sHand.type.len) return -1;
                if (other.isTrump) {
                    tractorsOther = stat.getTractors(2, true);
                    if (tractorsOther[tractorsOther.length - 1].minRank >= tractors[tractors.length - 1].minRank) return -1;
                }
                break;
            case Hand.COMBINATION.TRACTOR3:
                tractors = stat.getTractors(3, true);
                if (tractors.length < 1) return -1;
                if (tractors[tractors.length - 1].type.len < sHand.type.len) return -1;
                if (other.isTrump) {
                    tractorsOther = stat.getTractors(3, true);
                    if (tractorsOther[tractorsOther.length - 1].minRank >= tractors[tractors.length - 1].minRank) return -1;
                }
                break;
            case Hand.COMBINATION.TRACTOR4:
                tractors = stat.getTractors(4, true);
                if (tractors.length < 1) return -1;
                if (tractors[tractors.length - 1].type.len < sHand.type.len) return -1;
                if (other.isTrump) {
                    tractorsOther = stat.getTractors(4, true);
                    if (tractorsOther[tractorsOther.length - 1].minRank >= tractors[tractors.length - 1].minRank) return -1;
                }
                break;
        }

        // TODO: need verify some rarely happened case
        return 1;
    };

    this.display = function () {
        return '{' + this.type.cat + ':' + this.type.len + '}, ' + this.minRank;
    };
}

Hand.prototype.doAnalysis = function (cards, trump, rank) {
    // cards - must be an array, even only one card
    if (cards == null || cards.length < 1) return;
    var stat = {};
    var c0 = cards[0];
    this.suite = c0.suite;
    if (cards.length == 1) {
        this.cardNumber = 1;
        this.type.cat = Hand.COMBINATION.SINGLE;
        this.type.len = this.cardNumber;
        this.isTrump = c0.isTrump(trump, rank);
        this.minRank = this.maxRank = cards[0].trumpRank(trump, rank);
    } else {
        // >= 2 cards
        this.cardNumber = cards.length;
        this.type.len = this.cardNumber;
        var tRank = c0.trumpRank(trump, rank);
        this.minRank = this.maxRank = tRank;
        this.isTrump = c0.isTrump(trump, rank);
        var ck = c0.suite + tRank;
        stat[ck] = 1;

        for (var x = 1, c; c = cards[x]; x++) {
            if (this.isTrump) {
                if (!c.isTrump(trump, rank)) {
                    this.type.cat = Hand.COMBINATION.MIX_SUITE;
                    this.isTrump = false;
                    return;
                }
            } else {
                if (c.isTrump(trump, rank) || c.suite !== c0.suite) {
                    this.type.cat = Hand.COMBINATION.MIX_SUITE;
                    return;
                }
            }

            tRank = c.trumpRank(trump, rank);
            if (tRank < this.minRank) this.minRank = tRank;
            if (tRank > this.maxRank) this.maxRank = tRank;
            ck = c.suite + tRank;
            if (stat[ck]) {
                stat[ck]++;
            } else {
                stat[ck] = 1;
            }
        }

        this.type.cat = Hand.COMBINATION.MIXED;
        var values = Object.values(stat);
        var cardKeys = Object.keys(stat);
        for (var x = 0, v; v = values[x]; x++) {
            if (v < 2) continue;
            if (v === 4) {
                this.totalQuads++;
                this.totalTrips++;
                this.totalPairs += 2;
            } else if (v === 3) {
                this.totalTrips++;
                this.totalPairs++;
            } else if (v === 2) {
                this.totalPairs++;
            }
        }

        if (Hand.isMixed(values)) {
            this.isFlop = true;
            this.generateSubHands(stat);
            return;
        }

        if (values[0] === 1) {
            this.type.cat = Hand.COMBINATION.SINGLE;
            this.type.len = 1;
            this.isFlop = true;
            return;
        }

        if (values.length === 1 || Card.allSplit(cardKeys)) {
            this.isFlop = values.length > 1;
            switch (values[0]) {
                case 2:
                    this.type.cat = Hand.COMBINATION.PAIR;
                    this.type.len = 2;
                    break;
                case 3:
                    this.type.cat = Hand.COMBINATION.TRIPS;
                    this.type.len = 3;
                    break;
                case 4:
                    this.type.cat = Hand.COMBINATION.QUADS;
                    this.type.len = 4;
                    break;
            }
            return;
        }

        if (Card.allConnected(cardKeys)) {
            switch (values[0]) {
                case 2:
                    this.type.cat = Hand.COMBINATION.TRACTOR2;
                    break;
                case 3:
                    this.type.cat = Hand.COMBINATION.TRACTOR3;
                    break;
                case 4:
                    this.type.cat = Hand.COMBINATION.TRACTOR4;
                    break;
            }
            return;
        }

        this.isFlop = true;
        this.generateSubHands(stat);
    }
};

Hand.prototype.generateSubHands = function (stat) {
    var singles = [];
    var pairs = [];
    var trips = [];
    var quads = [];
    for (var ck in stat) {
        var rnk = Number.parseInt(ck.substr(1));
        switch (stat[ck]) {
            case 1:
                singles.push(rnk);
                break;
            case 2:
                pairs.push(rnk);
                break;
            case 3:
                trips.push(rnk);
                break;
            case 4:
                quads.push(rnk);
                break;
        }
    }

    this.subHands = [];
    if (singles.length > 0) {
        singles.sort(Card.compareNumber);
        this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.SINGLE, len: 1}, singles[0], this.isTrump));
    }

    if (pairs.length > 0) {
        pairs.sort(Card.compareNumber);
        var rnk0 = pairs[0];
        if (pairs.length === 1) {
            this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.PAIR, len: 2}, rnk0, this.isTrump));
        } else {
            var count = 1;
            var minRank = rnk0;
            var preRank = rnk0;
            var addOnce = false;
            for (var x = 1, rnk; rnk = pairs[x]; x++) {
                if (rnk !== preRank + 1) {
                    if (count >= 2) {
                        this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.TRACTOR2, len: count * 2}, minRank, this.isTrump));
                    } else if (!addOnce) {
                        this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.PAIR, len: 2}, minRank, this.isTrump));
//                        addOnce = true;   // add all
                    }
                    count = 1;
                    minRank = rnk;
                } else {
                    count++;
                }
                preRank = rnk;
            }

            if (count >= 2) {
                this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.TRACTOR2, len: count * 2}, minRank, this.isTrump));
            } else if (!addOnce) {
                this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.PAIR, len: 2}, minRank, this.isTrump));
            }
        }
    }

    if (trips.length > 0) {
        trips.sort(Card.compareNumber);
        var rnk0 = trips[0];
        if (trips.length === 1) {
            this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.TRIPS, len: 3}, rnk0, this.isTrump));
        } else {
            var count = 1;
            var minRank = rnk0;
            var preRank = rnk0;
            var addOnce = false;
            for (var x = 1, rnk; rnk = trips[x]; x++) {
                if (rnk !== preRank + 1) {
                    if (count >= 2) {
                        this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.TRACTOR3, len: count * 3}, minRank, this.isTrump));
                    } else if (!addOnce) {
                        this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.TRIPS, len: 3}, minRank, this.isTrump));
//                        addOnce = true;
                    }
                    count = 1;
                    minRank = rnk;
                } else {
                    count++;
                }
                preRank = rnk;
            }

            if (count >= 2) {
                this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.TRACTOR3, len: count * 3}, minRank, this.isTrump));
            } else if (!addOnce) {
                this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.TRIPS, len: 3}, minRank, this.isTrump));
            }
        }
    }

    if (quads.length > 0) {
        quads.sort(Card.compareNumber);
        var rnk0 = quads[0];
        if (quads.length === 1) {
            this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.QUADS, len: 4}, rnk0, this.isTrump));
        } else {
            var count = 1;
            var minRank = rnk0;
            var preRank = rnk0;
            var addOnce = false;
            for (var x = 1, rnk; rnk = quads[x]; x++) {
                if (rnk !== preRank + 1) {
                    if (count >= 2) {
                        this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.TRACTOR4, len: count * 4}, minRank, this.isTrump));
                    } else if (!addOnce) {
                        this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.QUADS, len: 4}, minRank, this.isTrump));
//                        addOnce = true;
                    }
                    count = 1;
                    minRank = rnk;
                } else {
                    count++;
                }
                preRank = rnk;
            }

            if (count >= 2) {
                this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.TRACTOR4, len: count * 4}, minRank, this.isTrump));
            } else if (!addOnce) {
                this.subHands.push(new SimpleHand({cat: Hand.COMBINATION.QUADS, len: 4}, minRank, this.isTrump));
            }
        }
    }

    if (this.subHands.length > 1) {
        this.subHands.sort(SimpleHand.compare);
    }
};

Hand.isMixed = function (values) {
    if (values.length < 2) return false;
    var v0 = values[0];
    for (var x = 1, val; val = values[x]; x++) {
        if (val !== v0) return true;
    }
    return false;
};

Hand.COMBINATION = {
    SINGLE: 1,
    PAIR: 20,
    TRIPS: 30, // 3 of kind
    QUADS: 40, // 4 of kind

    TRACTOR2: 28, // connected pair
    TRACTOR3: 38, // connected 3 of a kind
    TRACTOR4: 48, // connected 4 of a kind (4x2)
    MIX_SUITE: -1,
    MIXED: 111
};

Hand.SIMPLE_TYPE = {
    SINGLE: {cat: Hand.COMBINATION.SINGLE, len: 1},
    PAIR: {cat: Hand.COMBINATION.PAIR, len: 2},
    TRIPS: {cat: Hand.COMBINATION.TRIPS, len: 3},
    QUADS: {cat: Hand.COMBINATION.QUADS, len: 4}
};

Hand.makeCards = function (simHand, orgCards, trump_suite, game_rank) {
    var stat = new HandStat(orgCards, trump_suite, game_rank);
    var cards = [];
    var card;
    var sRank = simHand.minRank;
    switch (simHand.type.cat) {
        case Hand.COMBINATION.QUADS:
        case Hand.COMBINATION.TRIPS:
        case Hand.COMBINATION.PAIR:
        case Hand.COMBINATION.SINGLE:
            card = stat.findCardByDupNum(sRank, simHand.type.len);
            for (var x = 0; x < simHand.type.len; x++) {
                cards.push(card);
            }
            break;
        case Hand.COMBINATION.TRACTOR2:
            for (var x = 0; x < simHand.type.len; x += 2) {
                card = stat.findCardByDupNum(sRank, 2);
                for (var y = 0; y < 2; y++) {
                    cards.push(card);
                }
                sRank++;
            }
            break;
        case Hand.COMBINATION.TRACTOR3:
            for (var x = 0; x < simHand.type.len; x += 3) {
                card = stat.findCardByDupNum(sRank, 3);
                for (var y = 0; y < 3; y++) {
                    cards.push(card);
                }
                sRank++;
            }
            break;
        case Hand.COMBINATION.TRACTOR4:
            for (var x = 0; x < simHand.type.len; x += 4) {
                card = stat.findCardByDupNum(sRank, 4);
                for (var y = 0; y < 4; y++) {
                    cards.push(card);
                }
                sRank++;
            }
            break;
        default:
            break;
    }

    return cards;
};

function SimpleHand(handType, minRank, isTrump) {
    // for comparation purpose
    this.type = handType;   // object {cat:, len:}
    this.minRank = minRank; // number
    this.isTrump = isTrump; // boolean

    this.display = function () {
        return '{' + this.type.cat + ':' + this.type.len + '}, ' + this.minRank;
    };
}

SimpleHand.compare = function (a, b) {
    if (a.type.len === b.type.len) {
        if (a.type.cat === b.type.cat) return a.minRank - b.minRank;
        return a.type.cat - b.type.cat;
    }

    return a.type.len - b.type.len;
};

function Round(players, trump, gameRank) {
    this.playList = [];
    var leadingHand = null;
    var firstHand = null;
    var points = 0;
    this.cardNumber = 0;

    this.displayAll = function () {
        var str = '';
        this.playList.forEach(function (hnd) {
            if (hnd === leadingHand) str += 'V ';
            str += Card.showCards(hnd.cards) + '; ';
        });
        return str + '\n';
    };

    function findHighers(cards, hand_type, minRank) {
//        console.log(Card.showCards(cards));
        if (cards == null || cards.length < 1)
            return false;
        if (hand_type.cat === Hand.COMBINATION.SINGLE) {
            var c = cards[cards.length - 1];
            return c.trumpRank(trump, gameRank) > minRank;
        }

        var nRequired = hand_type.len;
        if (cards.length < nRequired) return false;

        switch (hand_type.cat) {
            case Hand.COMBINATION.QUADS:
            case Hand.COMBINATION.TRIPS:
            case Hand.COMBINATION.PAIR:
                var c0 = null, count = 1;
                for (var x = cards.length - 1, c; x >= 0 && (c = cards[x]); x--) {
                    var rnk = c.trumpRank(trump, gameRank);
                    if (rnk <= minRank) return false;
                    if (!c.equals(c0)) {
                        c0 = c;
                        count = 1;
                        continue;
                    }
                    count++;
                    if (count >= nRequired) {
                        return rnk > minRank;
                    }
                }
                return false;
        }

        var hand_stat = new HandStat(cards, trump, gameRank);
        var sortedRanks = null;
        var unit = 1;

        switch (hand_type.cat) {
            case Hand.COMBINATION.TRACTOR4:
                sortedRanks = hand_stat.sortedRanks(4);
                unit = 4;
                break;
            case Hand.COMBINATION.TRACTOR3:
                sortedRanks = hand_stat.sortedRanks(3);
                unit = 3;
                break;
            case Hand.COMBINATION.TRACTOR2:
                if (hand_type.len === 4) {
                    if (hand_stat.sortedRanks(4).length > 0) return true;    // quads can beat two pair tractor
                }
                sortedRanks = hand_stat.sortedRanks(2);
                unit = 2;
                break;
            default:
                // should never run into here
                console.log('ERROR: invalid hand type: ' + hand_type.cat);
                return false;
        }

//        console.log(sortedRanks);
        if (sortedRanks.length * unit < hand_type.len) return false;
        var preRnk = 0;
        var count = unit;
        for (var x = sortedRanks.length - 1, rnk; rnk = sortedRanks[x]; x--) {
            if (rnk <= minRank) return false;
            if (preRnk === 0) {
                preRnk = rnk;
                continue;
            }
            if (rnk !== preRnk - 1) {
                count = unit;
            } else {
                count += unit;
                if (count === hand_type.len) return true;
            }
            preRnk = rnk;
        }

        return false;
    }

    function hasHigherCards(player, hand, suite) {
        var hand_type = hand.type;
        var minRank = hand.minRank;
        if (hand.isTrump) {
            return findHighers(player.trumps, hand_type, minRank);
        }

        return findHighers(player.getCardsBySuite(suite), hand_type, minRank);
    }

    function hasHigherHand(player, simple_hand, suite) {
        var ret = false;
        for (var x = 0, p; p = players[x]; x++) {
            if (p === player) continue;
            if (hasHigherCards(p, simple_hand, suite)) {
                ret = true;
                break;
            }
        }

        if (ret) {
            player.mustLead = simple_hand;

        }
        return ret;
    }

    this.isValidLeadingHand = function (player, cards) {
        if (player == null || cards == null) return false;
        if (!Array.isArray(cards)) return true;
        if (cards.length < 1) return false;
        if (cards.length === 1) return true;
        var hand = new Hand(player, cards, trump, gameRank);
        if (hand.type.cat === Hand.COMBINATION.MIX_SUITE) return false;
        if (!hand.isFlop) return true;

//        debugger;
        if (hand.subHands == null) {
            return !hasHigherHand(player, hand, hand.suite);
        }

        for (var x = 0, sHand; sHand = hand.subHands[x]; x++) {
            if (hasHigherHand(player, sHand, hand.suite)) return false;
        }

        return true;
    };

    this.isValidLeading = function (hand) {
        if (hand == null) return false;
        if (hand.type.cat === Hand.COMBINATION.MIX_SUITE) return false;
        if (!hand.isFlop) return true;

//        debugger;
        if (hand.subHands == null) {
            return !hasHigherHand(hand.player, hand, hand.suite);
        }

        for (var x = 0, sHand; sHand = hand.subHands[x]; x++) {
            if (hasHigherHand(hand.player, sHand, hand.suite)) return false;
        }

        return true;
    };

    this.addHand = function (player, cards, hand) {
        if (hand == null) {
            if (cards == null || cards.length < 1) return false;
            hand = new Hand(player, cards, trump, gameRank);
        }
        if (firstHand == null) {
            firstHand = hand;
            leadingHand = hand;
            this.cardNumber = cards.length;
        } else if (hand.compareTo(leadingHand, firstHand) > 0) {
            leadingHand = hand;
        }
        this.playList.push(hand);
        points += Card.getTotalPoints(hand.cards);
        var isLastHand = this.playList.length === players.length;
        if (isLastHand) {
            leadingHand.player.addPoints(points);
//            if (Table.Debugging) {
                console.log(this.displayAll());
//            }
        }

        return isLastHand;
    };

    this.getNextLeadingPlayer = function () {
        return leadingHand.player;
    };

    this.getFirstHand = function () {
        return firstHand;
    };

    this.getLeadingHand = function () {
        return leadingHand;
    };

    function countHigherCards(cards, maxRank) {
        if (cards == null || cards.length < 1) return 0;
        var n = 0;
        cards.forEach(function (c) {
            if (c.trumpRank(trump, gameRank) > maxRank) n++;
        });
        return n;
    }

    function hasPossibleHighers(hand, exPlayer) {
        switch (hand.type.cat) {
            case Hand.COMBINATION.TRACTOR4:
            case Hand.COMBINATION.TRACTOR3:
            case Hand.COMBINATION.TRACTOR2:
            case Hand.COMBINATION.QUADS:
            case Hand.COMBINATION.TRIPS:
                return false;
            case Hand.COMBINATION.SINGLE:
            case Hand.COMBINATION.PAIR:
                break;
            default:
                return true;

        }

        var count = 0;
        for (var x = 0, p; p = players[x]; x++) {
            if (p === exPlayer) continue;
            if (hand.isTrump) {
                count += countHigherCards(p.trumps, hand.maxRank);
            } else {
                count += countHigherCards(p.getCardsBySuite(hand.suite), hand.maxRank);
            }
            if (count >= hand.type.len) return true;
        }

        return false;
    }

    this.allFriendsLeft = function (game, player) {
        if (this.playList.length === players.length - 1) return true;    // is last play
        if (player === game.contractor || player === game.partner) {
            if (game.partnerDef.noPartner) return false;
            for (var x = 0, hand; hand = this.playList[x]; x++) {
                if (hand.player === game.contractor || hand.player === game.partner) return false;
            }
            return players.length - this.playList.length <= 2;
        }

        var count = 0;
        for (var x = 0, hand; hand = this.playList[x]; x++) {
            if (hand.player === game.contractor || hand.player === game.partner) count++;
        }
        return game.partnerDef.noPartner ? count >= 1 : count >= 2;
    };

    this.isWinning = function (game, exPlayer) {
        if (firstHand.isFlop) return true;
        if (this.allFriendsLeft(game, exPlayer)) return true;
        // TODO, check if following players are all same side
        return !hasPossibleHighers(leadingHand, exPlayer);
    };

    this.getFirstHandTypes = function () {
        var types = [];
        if (firstHand.subHands == null) {
            types.push(firstHand.type);
        } else {
            for (var x = 0, sHand; sHand = firstHand.subHands[x]; x++) {
                types.push(sHand.type);
            }
        }

        if (types.length > 1) {
            types.sort(function (a, b) {
                // decending
                if (a.cat === b.cat) return b.len - a.len;
                return b.cat - a.cat;
            });
        }
        return types;
    };

    this.maxSubHandLength = function () {
        if (firstHand.subHands == null) {
            return firstHand.type.len;
        }

        var mLen = 1;
        for (var x = 0, sHand; sHand = firstHand.subHands[x]; x++) {
            if (sHand.type.len > mLen) {
                mLen = sHand.type.len;
            }
        }
        return mLen;
    };
}

Game.prototype.enterPlayStage = function () {
    this.stage = Game.PLAYING_STAGE;
    this.rank = this.contractor.matchInfo.currentRank;
    this.leadingPlayer = this.contractor;
};

Game.prototype.setPartner = function (player) {
    this.partner = player;
};

Game.prototype.setTrump = function (suite) {
    for (var x = 0, c; c = this.deck.remains[x]; x++) {
        this.contractor.addCard(c);
    }
    this.contractor.sortHand();
    this.contractor.matchInfo.contracts++;

    this.trump = suite;
    for (var x = 0, p; p = this.players[x]; x++) {
        p.resortCards(this.trump, this.rank);
        if (Table.Debugging) {
            console.log('*** seat #' + (x + 1) + ':');
            console.log(p.showHand());
        }
    }

    this.currentRound = null;
    this.leadingPlayer = this.contractor;
    this.rounds = [];
    this.startNewRound();
};

Game.prototype.judge = function () {

};

Game.prototype.getHandType = function (player, cards) {
    var hand = new Hand(player, cards, this.trump, this.rank);
    return hand.type.cat + ':' + hand.type.len + ", max rank-" + hand.maxRank;
};

Game.prototype.startNewRound = function () {
    if(this.currentRound != null) {
        this.leadingPlayer = this.currentRound.getNextLeadingPlayer();
        this.cardsPlayed += this.currentRound.getFirstHand().cardNumber;
    }
    this.currentRound = new Round(this.players, this.trump, this.rank);
    this.rounds.push(this.currentRound);
};

Game.prototype.isLeadingCardsValid = function (player, cards) {
    return this.currentRound.isValidLeadingHand(player, cards);
};

Game.prototype.isLeadingHandValid = function (hand) {
    return this.currentRound.isValidLeading(hand);
};

Game.prototype.promote = function () {
//    var summary = '定约分(Contract Point):' + this.contractPoint + "\n";
//    summary += '闲家得分(Defender Collected):' + this.collectedPoint + "\n";
    this.enSummary = '';
    this.zhSummary = '';
    var delta = 1;
    if (this.collectedPoint >= this.contractPoint) {
        var extroPoint = this.collectedPoint - this.contractPoint;
        var p0 = this.deckNumber * 20;
        if (extroPoint >= p0) {
            delta += Math.floor(extroPoint / p0);
        }

        for (var x = 0, p; p = this.players[x]; x++) {
            if (p === this.contractor || p === this.partner) continue;
            p.promote(delta);
        }

        this.enSummary += 'Contract down, defenders promoted ' + delta + ' rank' + (delta > 1 ? 's' : '') + '\n';
        this.zhSummary += '庄垮,闲家升' + delta + '级\n';

        this.result = -delta;
    } else {
        if (this.collectedPoint <= 0) {
            delta = 3;
        } else if (this.collectedPoint < Math.floor(this.contractPoint / 2)) {
            delta = 2;
        }

        this.enSummary += 'Contract made, ';
        this.zhSummary += '庄成,';
        if (delta === 2) {
            this.enSummary += 'XiaoGuang, ';
            this.zhSummary += '小光,';
        } else if (delta === 3) {
            this.enSummary += 'DaGuang, ';
            this.zhSummary += '大光,';
        }

        if (this.partnerDef.noPartner) {
            delta *= 2;
        }

        this.contractor.promote(delta);
        if (this.contractor !== this.partner) this.partner.promote(delta);

        if (this.partnerDef.noPartner) {
            this.enSummary += '\nDeclarer (1vs5) promoted ' + delta + ' rank' + (delta > 1 ? 's' : '') + '\n';
            this.zhSummary += '庄家一打五升' + delta + '级\n';
        } else {
            this.enSummary += '\nDeclarer and partner promoted ' + delta + ' rank' + (delta > 1 ? 's' : '') + '\n';
            this.zhSummary += '庄家及帮手升' + delta + '级\n';
        }

        this.result = delta;
    }

    this.playerStatusEn = '{' + this.contractor.name
            + ':' + Card.RankToString(this.contractor.matchInfo.currentRank);
    this.playerStatusZh = '{' + this.contractor.name
            + ':' + Card.RankToString(this.contractor.matchInfo.currentRank);
//    if (this.contractor.id != null && this.contractor.sock == null) {
//        this.playerStatusEn += ',away';
//        this.playerStatusZh += ',离开';
//    }
    if (this.contractor !== this.partner) {
        this.playerStatusEn += ', ' + this.partner.name + ':' + Card.RankToString(this.partner.matchInfo.currentRank);
        this.playerStatusZh += ', ' + this.partner.name + ':' + Card.RankToString(this.partner.matchInfo.currentRank);
//        if (this.partner.id != null && this.partner.sock == null) {
//            this.playerStatusEn += ',away';
//            this.playerStatusZh += ',离开';
//        }
    }
    this.playerStatusEn += '} ' + (this.result > 0 ? '+' : '-') + delta + '\n';
    this.playerStatusZh += '} ' + (this.result > 0 ? '+' : '-') + delta + '\n';

    var sEn = '';
    var sZh = '';
    for (var x = 0, p; p = this.players[x]; x++) {
        if (p === this.contractor || p === this.partner) continue;
        sEn += ', ' + p.name + ':' + Card.RankToString(p.matchInfo.currentRank);
        sZh += ', ' + p.name + ':' + Card.RankToString(p.matchInfo.currentRank);
//        if (p.id != null && p.sock == null) {
//            sEn += ',away';
//            sZh += ',离开';
//        }
    }
    this.playerStatusEn += sEn.substr(2);
    this.playerStatusZh += sZh.substr(2);
};
