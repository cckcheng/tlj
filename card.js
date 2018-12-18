module.exports = Card;

function Card(suite, rank) {
	this.suite = suite;
    this.rank = rank;
}

Card.prototype.display = function () {
    var s = '';
    switch (this.rank) {
        case 11:
            s += 'J';
            break;
        case 12:
            s += 'Q';
            break;
        case 13:
            s += 'K';
            break;
        case 14:
            s += 'A';
            break;
        case Card.RANK.SmallJoker:
        case Card.RANK.BigJoker:
            break;
        default:
            s += this.rank;
    }

    return this.suite.symbol + s;
};

Card.SUITE = {
	CLUB: {val: 1, symbol:'\u2663'},
	DIAMOND: {val: 2, symbol: '\u2666'},
	HEART: {val: 3, symbol: '\u2665'},
	SPADE: {val: 4, symbol: '\u2660'},
	SMALL_JOKER: {val: 5, symbol: '\u2657'},
	BIG_JOKER: {val: 6, symbol: '\u265b'}
};

Card.RANK = {
    SmallJoker: 97,
    BigJoker: 98
};

Card.RankToString = function (rank) {
    if (rank <= 10) return '' + rank;
    var s = '';
    switch (rank) {
        case 11:
            s += 'J';
            break;
        case 12:
            s += 'Q';
            break;
        case 13:
            s += 'K';
            break;
        case 14:
            s += 'A';
            break;
        case Card.RANK.SmallJoker:
        case Card.RANK.BigJoker:
            break;
        default:
            s += 'A+' + (rank - 14);
    }

    return s;
};

Card.prototype.isTrump = function (trump_suite, game_rank) {
    if (this.rank === game_rank || this.suite === trump_suite) return true;
    return this.rank === Card.RANK.BigJoker || this.rank === Card.RANK.SmallJoker;
};

Card.prototype.trumpRank = function (trump_suite, game_rank) {
    if (this.rank === game_rank) {
        return this.suite === trump_suite ? 15 : 14;
    }

    if (this.rank === Card.RANK.BigJoker) {
        return trump_suite == null ? 16 : 17;
    }
    if (this.rank === Card.RANK.SmallJoker) {
        return trump_suite == null ? 15 : 16;
    }

    return this.rank < game_rank ? this.rank : this.rank - 1;
};

Card.prototype.equals = function (c) {
    if (!c) return false;
    return this.suite === c.suite && this.rank === c.rank;
};

Card.compare = function(a,b) {
	if(a.suite === b.suite) {
		return a.rank === b.rank ? 0 : (a.rank > b.rank ? 1 : -1);
	}

	return a.suite.val > b.suite.val ? 1 : -1;
};

Card.getRanks = function (cards) {
    if (cards == null || cards.length < 1) return [];
    var s = [];
    for (var x = 0, c; c = cards[x]; x++) {
        s.push(c.rank);
    }

    return s;
};

Card.allConnected = function (cards, trump_suite, game_rank) {
    var minRank = cards[0].trumpRank(trump_suite, game_rank);
    var maxRank = minRank;
    var ranks = [minRank];
    for (var x = 1, c; c = cards[x]; x++) {
        var cRank = c.trumpRank(trump_suite, game_rank);
        if (ranks.indexOf(cRank) >= 0) return false;
        ranks.push(cRank);
        if (cRank < minRank) {
            minRank = cRank;
        } else if (cRank > maxRank) {
            maxRank = cRank;
        }
    }

    return maxRank - minRank + 1 === cards.length;
};
