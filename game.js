module.exports = Game;

var Player = require('./player');
var Card = require('./card');
var Deck = require('./deck');

function Game(players, deckNumber) {
    this.players = players;
    this.deckNumber = deckNumber;
    this.totalPoint = deckNumber * 100;
    this.initBidPoint = this.totalPoint * 0.7;
    this.status = 'bidding';

    this.collectePoint = 0;
    this.contractPoint = 0;

    this.contractor = null;
    this.partner = null;

    this.leadingPlayer = null;
    this.trump = null;

    this.deck = new Deck(deckNumber);
    this.deck.deal(this.players);
    console.log('remains:' + this.deck.remains.length);

    this.rounds = [];
}

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

    this.compareTo = function (other) {
        if (other == null) return 1;
        if (this.type.cat === Hand.COMBINATION.MIX_SUITE) return -1;
        if (other.type.cat === Hand.COMBINATION.MIX_SUITE) return 1;

        if (this.cardNumber === 4 && this.type.cat === Hand.COMBINATION.QUADS && other.type.cat === Hand.COMBINATION.TRACTOR2) {
            return 1;
        }

        if (this.type.cat !== other.type.cat) return -1;
        if (!this.isTrump && other.isTrump) return -1;

        if (this.type.cat !== Hand.COMBINATION.MIXED) {
            if (this.isTrump && !other.isTrump) return 1;
            return this.maxRank > other.maxRank ? 1 : -1;
        }

        if (this.isTrump && !other.isTrump) {
            // mixed
            var otherValues = Object.values(other.stat);
            // TODO
        }

        return -1;
    };
}

Hand.prototype.doAnalysis = function (cards, trump, rank) {
    if (cards == null || (Array.isArray(cards) && cards.length < 1)) return;
    var stat = {};
    if (!Array.isArray(cards)) {
        this.cardNumber = 1;
        this.type.cat = Hand.COMBINATION.SINGLE;
        this.type.len = this.cardNumber;
        this.isTrump = cards.isTrump(trump, rank);
        this.minRank = this.maxRank = cards.rank;
    } else if (cards.length == 1) {
        this.cardNumber = 1;
        this.type.cat = Hand.COMBINATION.SINGLE;
        this.type.len = this.cardNumber;
        this.isTrump = cards[0].isTrump(trump, rank);
        this.minRank = this.maxRank = cards[0].rank;
    } else {
        // >= 2 cards
        this.cardNumber = cards.length;
        this.type.len = this.cardNumber;
        var c0 = cards[0];
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
            return;
        }

        if (values[0] === 1) {
            this.type.cat = Hand.COMBINATION.SINGLE;
            this.type.len = 1;
            this.isFlop = true;
            return;
        }

        if (values.length === 1 || Card.allSplit(Object.keys(stat))) {
            this.isFlop = true;
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

        if (Card.allConnected(Object.keys(stat))) {
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
    }
};

Hand.isMixed = function (values) {
    var v0 = values[0];
    for (var x = 1, val; val = values[x]; x++) {
        if (val !== v0) return true;
    }
    return false;
};

Hand.COMBINATION = {
    SINGLE: 1,
    PAIR: 2,
    TRIPS: 3, // 3 of kind
    QUADS: 4, // 4 of kind

    TRACTOR2: 20, // connected pair
    TRACTOR3: 30, // connected 3 of a kind
    TRACTOR4: 40, // connected 4 of a kind (4x2)
    MIX_SUITE: -1,
    MIXED: 111
};

function Round(players, trump, gameRank) {
    this.playList = [];
    var leadingHand = null;
    var firstHand = null;

    function findHighers(cards, hand_type, minRank) {
        if (cards == null || cards.length < 1) return false;
        if (hand_type.cat === Hand.COMBINATION.SINGLE) {
            var c = cards[cards.length - 1];
            return c.trumpRank(trump, gameRank) > minRank;
        }

        console.log(Card.showCards(cards));
        debugger;
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
                break;
        }
        return false;
    }

    function hasHigherCards(player, hand, suite) {
        var hand_type = hand.type;
        var minRank = hand.minRank;
        if (hand.isTrump) {
            return findHighers(player.trumps, hand_type, minRank);
        }

        switch (suite) {
            case Card.SUITE.SPADE:
                if (findHighers(player.spades, hand_type, minRank)) return true;
                break;
            case Card.SUITE.HEART:
                if (findHighers(player.hearts, hand_type, minRank)) return true;
                break;
            case Card.SUITE.CLUB:
                if (findHighers(player.clubs, hand_type, minRank)) return true;
                break;
            case Card.SUITE.DIAMOND:
                if (findHighers(player.diamonds, hand_type, minRank)) return true;
                break;
        }

        return false;
    }

    this.isValidLeadingHand = function (player, cards) {
        if (player == null || cards == null) return false;
        if (!Array.isArray(cards)) return true;
        if (cards.length < 1) return false;
        if (cards.length === 1) return true;
        var hand = new Hand(player, cards, trump, gameRank);
        if (hand.type.cat === Hand.COMBINATION.MIX_SUITE) return false;
        if (!hand.isFlop) return true;

        debugger;
        switch (hand.type.cat) {
            case Hand.COMBINATION.SINGLE:
            case Hand.COMBINATION.PAIR:
            case Hand.COMBINATION.TRIPS:
            case Hand.COMBINATION.QUADS:
                for (var x = 0, p; p = players[x]; x++) {
                    if (p === player) continue;
                    if (hasHigherCards(p, hand, cards[0].suite)) return false;
                }
                return true;

            default:
                break;
        }

        return true;
    };

    this.addHand = function (player, cards) {
        var hand = new Hand(player, cards, trump, gameRank);
        if (firstHand == null) firstHand = hand;
        if (leadingHand == null || hand.compareTo(leadingHand) > 0) {
            leadingHand = hand;
        }
        this.playList.push(hand);
    };

    this.getNextLeadingPlayer = function () {
        return leadingHand.player;
    };
}

Game.prototype.setContractor = function (player) {
    this.contractor = player;
    this.rank = player.currentRank;
};

Game.prototype.setPartner = function (player) {
    this.partner = player;
};

Game.prototype.setTrump = function (card) {
    for (var x = 0, c; c = this.deck.remains[x]; x++) {
        this.contractor.addCard(c);
    }
    this.contractor.sortHand();

    if (card.suite !== Card.SUITE.SMALL_JOKER && card.suite !== Card.SUITE.BIG_JOKER) this.trump = card.suite;
    for (var x = 0, p; p = this.players[x]; x++) {
        p.resortCards(this.trump, this.rank);
    }
};

Game.prototype.judge = function () {

};

Game.prototype.getHandType = function (player, cards) {
    var hand = new Hand(player, cards, this.trump, this.rank);
    return hand.type.cat + ':' + hand.type.len + ", max rank-" + hand.maxRank;
};

Game.prototype.isLeadingValid = function (player, cards) {
    var round = new Round(this.players, this.trump, this.rank);
    return round.isValidLeadingHand(player, cards);
};

Game.prototype.promote = function () {
    var delta = 1;
    if (this.collectePoint >= this.contractPoint) {
        var extroPoint = this.collectePoint - this.contractPoint;
        var p0 = this.deckNumber * 20;
        if (extroPoint > p0) {
            delta += Math.floor(extroPoint / p0);
        }

        for (var x = 0, p; p = this.players[x]; x++) {
            if (p === this.contractor || p === this.partner) continue;
            p.promote(delta);
        }
    } else {
        if (this.collectePoint <= 0) {
            delta = 3;
        } else if (this.collectePoint < Math.floor(this.contractPoint / 2)) {
            delta = 2;
        }

        this.contractor.promote(delta);
        if (this.partner) this.partner.promote(delta);
    }
};