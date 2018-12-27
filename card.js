module.exports = Card;

function Card(suite, rank) {
	this.suite = suite;
    this.rank = rank;
}

Card.prototype.display = function () {
    var s = '';
    switch (this.suite) {
        case Card.SUITE.SPADE:
            s = '\u2660';
            break;
        case Card.SUITE.HEART:
            s = '\u2665';
            break;
        case Card.SUITE.CLUB:
            s = '\u2663';
            break;
        case Card.SUITE.DIAMOND:
            s = '\u2666';
            break;
        case Card.SUITE.SMALL_JOKER:
            s = '\u2657';
            break;
        case Card.SUITE.BIG_JOKER:
            s = '\u265b';
            break;
    }

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

    return s;
};

Card.SUITE = {
	CLUB: 'C',
    DIAMOND: 'D',
    HEART: 'H',
    SPADE: 'S',
    SMALL_JOKER: 'V',
    BIG_JOKER: 'W'
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
//    debugger;
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
    if (c == null) return false;
    return this.suite === c.suite && this.rank === c.rank;
};

Card.compare = function(a,b) {
	if(a.suite === b.suite) {
		return a.rank === b.rank ? 0 : (a.rank > b.rank ? 1 : -1);
	}

	return a.suite > b.suite ? 1 : -1;
};

Card.getRanks = function (cards) {
    if (cards == null || cards.length < 1) return [];
    var s = [];
    for (var x = 0, c; c = cards[x]; x++) {
        s.push(c.rank);
    }

    return s;
};

Card.showCards = function (cards) {
    if (cards == null || cards.length < 1) return '';
    var s = '';
    for (var x = 0, c; c = cards[x]; x++) {
        s += c.display();
    }
    return s;
};

Card.allConnected = function (card_keys) {
    // test if all ranks are connected
    if (!Array.isArray(card_keys) || card_keys.length < 1) return false;

    debugger;
    var minRank = Number.parseInt(card_keys[0].substring(1));
    var maxRank = minRank;
    var ranks = [minRank];
    var cRank;
    for (var x = 1, ck; ck = card_keys[x]; x++) {
        cRank = Number.parseInt(ck.substring(1));
        if (ranks.indexOf(cRank) >= 0) return false;
        ranks.push(cRank);
        if (cRank < minRank) {
            minRank = cRank;
        } else if (cRank > maxRank) {
            maxRank = cRank;
        }
    }

    return maxRank - minRank + 1 === card_keys.length;
};

Card.allSplit = function (card_keys) {
    // test if all ranks are split
    if (!Array.isArray(card_keys) || card_keys.length < 1) return false;

    var ranks = [];
    for (var x = 0, ck; ck = card_keys[x]; x++) {
        ranks.push(Number.parseInt(ck.substring(1)));
    }
    ranks.sort();

    debugger;
    var r0 = ranks[0];
    for (var x = 1, r1; r1 = ranks[x]; x++) {
        if (r1 - r0 === 1) return false;
        r0 = r1;
    }

    return true;
};
