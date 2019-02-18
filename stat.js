module.exports = HandStat;

const {Game, Hand, SimpleHand} = require('./game');

function HandStat(cards, trump_suite, game_rank) {
    this.cards = cards;
    this.trump = trump_suite;
    this.gameRank = game_rank;
    this.totalPairs = 0;
    this.totalTrips = 0;
    this.totalQuads = 0;
    this.stat = {};
    for (var x = 0, c; c = cards[x]; x++) {
        var tRank = c.trumpRank(trump_suite, game_rank);
        var ck = c.suite + tRank;
        if (this.stat[ck]) {
            this.stat[ck]++;
        } else {
            this.stat[ck] = 1;
        }
    }

    this.values = Object.values(this.stat);
    for (var x = 0, v; v = this.values[x]; x++) {
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

    // find card by the number of same card, tRank - trump rank
    this.findCardByDupNum = function (tRank, num) {
        for (var ck in this.stat) {
            var rnk = Number.parseInt(ck.substr(1));
            if (rnk !== tRank) continue;
            if (this.stat[ck] >= num) {
                for (var x = 0, c; c = this.cards[x]; x++) {
                    if (ck === c.suite + c.trumpRank(trump_suite, game_rank)) {
                        return c;
                    }
                }
            }
        }

        console.log('Exception: findCardByDupNum, tRank=' + tRank + ", num=" + num + ";cards:" + Card.showCards(this.cards));
        return null;    // should never happen
    };
}

// return sorted ranks for pair/trips/quads, where num = 2,3,4
HandStat.prototype.sortedRanks = function (num) {
    var arr = [];
    for (var ck in this.stat) {
        if (this.stat[ck] < num) continue;
        var rnk = Number.parseInt(ck.substr(1));
        arr.push(rnk);
    }
    arr.sort(function (a, b) {
        return a - b;
    });
    return arr;
};

// return all possible tractors, sLen: 2,3,4
HandStat.prototype.getTractors = function (sLen, isTrump) {
    var rnks = this.sortedRanks(sLen);
    if (rnks.length < 2) return [];

    var cat = Hand.COMBINATION.TRACTOR2;
    if (sLen === 3) {
        cat = Hand.COMBINATION.TRACTOR3;
    } else if (sLen === 4) {
        cat = Hand.COMBINATION.TRACTOR4;
    }
    var tractors = [];
    var tmpCards = this.cards.slice();

    var preRank = -1;
    var minRank = -1;
    var count = 1;
    for (var x = 0, rnk; rnk = rnks[x]; x++) {
        if (rnk === preRank) {
            continue;
        }
        if (rnk !== preRank + 1) {
            if (count >= 2) {
                var sHand = new SimpleHand({cat: cat, len: count * sLen}, minRank, isTrump);
                tractors.push(sHand);
                if (sLen === 2) {
                    var cc = Hand.makeCards(sHand, tmpCards, this.trump, this.gameRank);
                    cc.forEach(function (c) {
                        tmpCards.splice(c.indexOf(tmpCards), 1);
                    });
                }
            }
            count = 1;
            minRank = rnk;
        } else {
            count++;
        }
        preRank = rnk;
    }

    if (count >= 2) {
        var sHand = new SimpleHand({cat: cat, len: count * sLen}, minRank, isTrump);
        tractors.push(sHand);
        if (sLen === 2) {
            var cc = Hand.makeCards(sHand, tmpCards, this.trump, this.gameRank);
            cc.forEach(function (c) {
                tmpCards.splice(c.indexOf(tmpCards), 1);
            });
        }
    }

    if (sLen === 2 && tractors.length > 0) {
        var nStat = new HandStat(tmpCards, this.trump, this.gameRank);
        tractors = tractors.concat(nStat.getTractors(2, isTrump));
    }

    tractors.sort(function (a, b) {
        if (a.type.len === b.type.len) return b.minRank - a.minRank;
        return a.type.len - b.type.len;
    });
    return tractors;
};
