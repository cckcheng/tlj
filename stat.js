module.exports = HandStat;

function HandStat(cards, trump_suite, game_rank) {
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