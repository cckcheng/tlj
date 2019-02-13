module.exports = HandStat;

const {Game, Hand, SimpleHand} = require('./game');

function HandStat(cards, trump_suite, game_rank) {
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

    var preRank = -1;
    var minRank = -1;
    var count = 1;
    for (var x = 0, rnk; rnk = rnks[x]; x++) {
        if (rnk !== preRank + 1) {
            if (count >= 2) {
                tractors.push(new SimpleHand({cat: cat, len: count * sLen}, minRank, isTrump));
            }
            count = 1;
            minRank = rnk;
        } else {
            count++;
        }
        preRank = rnk;
    }

    if (count >= 2) {
        tractors.push(new SimpleHand({cat: cat, len: count * sLen}, minRank, isTrump));
    }

    if (sLen === 2) {
        var tractor4s = this.getTractors(4);
        if (tractor4s.length > 0) {
            for (var x = 0; x < tractor4s.length; x++) {
                tractors.push(new SimpleHand({cat: cat, len: tractor4s[x].type.len / 2}, tractor4s[x].minRank, isTrump));
            }
        }
    }

    return tractors;
};