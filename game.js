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
    this.type = 0;
    this.isTrump = false;
    this.maxRank = 0;
    var stat = {};

    if (!Array.isArray(cards)) {
        this.cardNumber = 1;
        this.type = Hand.COMBINATION.SINGLE;
        this.isTrump = cards.isTrump(trump, rank);
        this.maxRank = cards.rank;
    } else if (cards.length == 1) {
        this.cardNumber = 1;
        this.type = Hand.COMBINATION.SINGLE;
        this.isTrump = cards[0].isTrump(trump, rank);
        this.maxRank = cards[0].rank;
    } else {
        this.cardNumber = cards.length;
        var c0 = cards[0];
        this.maxRank = c0.trumpRank(trump, rank);
        this.isTrump = c0.isTrump(trump, rank);
        stat[c0] = 1;

        for (var x = 0, c; c = cards[x]; x++) {
            if (this.isTrump) {
                if (!c.isTrump(trump, rank)) {
                    this.type = Hand.COMBINATION.MIX_SUITE;
                    this.isTrump = false;
                    break;
                }
            } else {
                if (c.isTrump(trump, rank) || c.suite !== c0.suite) {
                    this.type = Hand.COMBINATION.MIX_SUITE;
                    break;
                }
            }

            var cRank = c.trumpRank(trump, rank);
            if (cRank > this.maxRank) this.maxRank = cRank;
            var isNew = true;
            for (var k in stat) {
                console.log(k.toString());
                if (k.equals(c)) {
                    stat[k]++;
                    isNew = false;
                    break;
                }
            }
            if (isNew) stat[c] = 1;
        }

        this.type = Hand.COMBINATION.MIXED;
        var values = Object.values(stat);
        var isMixed = Hand.isMixed(values);
        if (!isMixed) {
            if (this.cardNumber === 2) {
                if (values.length === 1) this.type = Hand.COMBINATION.PAIR;
            } else if (this.cardNumber === 3) {
                if (values.length === 1) this.type = Hand.COMBINATION.TRIPS;
            } else if (this.cardNumber === 4) {
                if (values.length === 1) {
                    this.type = Hand.COMBINATION.QUADS;
                } else if (values.length === 2) {
                    if (Card.allConnected(Object.keys(stat), trump, rank)) this.type = Hand.COMBINATION.TRACTOR2x2;
                }
            } else {
                // cardNumber > 4
                switch (values[0]) {
                    case 2:
                        if (Card.allConnected(Object.keys(stat), trump, rank)) this.type = Hand.COMBINATION.TRACTOR2;
                        break;
                }
            }
        }
    }

    this.compareTo = function (other) {
        if (other == null) return 1;
        if (this.type === Hand.COMBINATION.MIX_SUITE) return -1;
        if (other.type === Hand.COMBINATION.MIX_SUITE) return 1;

        if (this.cardNumber === 4 && this.type === Hand.COMBINATION.QUADS && other.type === Hand.COMBINATION.TRACTOR2) {
            return 1;
        }

        if (this.type !== other.type) return -1;
        if (!this.isTrump && other.isTrump) return -1;

        if (this.type !== Hand.COMBINATION.MIXED) {
            if (this.isTrump && !other.isTrump) return 1;
            return this.maxRank > other.maxRank ? 1 : -1;
        }

        if (this.isTrump && !other.isTrump) {
            var otherValues = Object.values(other.stat);
        }

        return -1;
    };
}

Hand.isMixed = function (values) {
    var v0 = values[0];
    for (var x = 1, val; val = values[x]; x++) {
        if (val !== v0) return true;
    }
    return false;
};

Hand.COMBINATION = {
    SINGLE: 10,
    PAIR: 20,
    TRIPS: 30, // 3 of kind
    TRACTOR2x2: 40, // connected pair
    TRACTOR2x3: 41, // connected pair (3 pairs)
    TRACTOR2x4: 42, // connected pair (4 pairs)
    TRACTOR2x5: 43, // connected pair (5 pairs)
    TRACTOR2x6: 44, // connected pair (6 pairs)
    TRACTOR2x7: 45, // connected pair (7 pairs)
    TRACTOR2xx: 49, // connected pair (>7 pairs)
    TRACTOR3x2: 50, // connected 3 of a kind
    TRACTOR3x3: 51, // connected 3 of a kind (3x3)
    TRACTOR3x4: 52, // connected 3 of a kind (3x4)
    TRACTOR3xx: 59, // connected 3 of a kind (3x(>4))
    QUADS: 90, // 4 of kind
    TRACTOR4: 99, // connected 4 of a kind
    MIX_SUITE: -1,
    MIXED: 111
};

function Round(trump, rank) {
    this.playList = [];
    var leadingHand = null;
    this.addHand = function (player, cards) {
        var hand = new Hand(player, cards, trump, rank);
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

    this.trump = card.suite;
    for (var x = 0, p; p = this.players[x]; x++) {
        p.resortCards(this.trump, this.rank);
    }
};

Game.prototype.judge = function () {

};

Game.prototype.getHandType = function (player, cards) {
    var hand = new Hand(player, cards, this.trump, this.rank);
    return hand.type;
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