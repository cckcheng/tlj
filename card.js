module.exports = Card;

function Card(suite, rank) {
	this.suite = suite;
    this.rank = rank;
}

Card.prototype.getPoint = function () {
    if(this.rank === 5 || this.rank === 10) return this.rank;
    if(this.rank === 13) return 10;
    return 0;
};

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
            s += '\u2657';
            break;
        case Card.RANK.BigJoker:
            s = '\u265b';
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
    JOKER: 'V'
};

Card.RANK = {
    SmallJoker: 97,
    BigJoker: 98
};

Card.StringToRank = function (s) {
    switch(s) {
        case 'A':
            return 14;
        case 'K':
            return 13;
        case 'Q':
            return 12;
        case 'J':
            return 11;
    }
    
    return parseInt(s);
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
        return trump_suite === Card.SUITE.JOKER ? 16 : 17;
    }
    if (this.rank === Card.RANK.SmallJoker) {
        return trump_suite === Card.SUITE.JOKER ? 15 : 16;
    }

    return this.rank < game_rank ? this.rank : this.rank - 1;
};

Card.prototype.equals = function (c) {
    if (c == null) return false;
    return this.suite === c.suite && this.rank === c.rank;
};

Card.prototype.indexOf = function (cards) {
    for (var x = 0, c; c = cards[x]; x++) {
        if (this.equals(c)) {
            return x;
        }
    }

    return -1;
};

Card.compare = function (a, b) {
	if(a.suite === b.suite) {
		return a.rank - b.rank;
	}

	return a.suite > b.suite ? 1 : -1;
};

Card.compareNumber = function (a, b) {
    return a - b;
};

Card.getRanks = function (cards) {
    if (cards == null || cards.length < 1) return [];
    var s = [];
    for (var x = 0, c; c = cards[x]; x++) {
        s.push(c.rank);
    }

    return s;
};

Card.cardsToString = function (cards) {
    if (cards == null || cards.length < 1)
        return "";
    var arr = [];
    cards.forEach(function (c) {
        arr.push(c.suite + c.rank);
    });
    return arr.join();
};

Card.fromString = function(s){
    if(s == null || s.length<2) return null;
    return new Card(s.charAt(0), parseInt(s.substr(1)));
};

Card.stringToArray = function (strCards, trump_suite, game_rank) {
    if (strCards == null || strCards.length < 2)
        return [];

    var cards = [];
    var ss = strCards.split(',');
    ss.forEach(function (s) {
        if (s.length < 2)
            return;
        cards.push(new Card(s.charAt(0), parseInt(s.substr(1))));
    });

    cards.sort(function (a, b) {
        var aTrump = a.isTrump(trump_suite, game_rank);
        var bTrump = b.isTrump(trump_suite, game_rank);
        if (!aTrump && !bTrump) return Card.compare(a, b);

        var aRank = a.trumpRank(trump_suite, game_rank);
        var bRank = b.trumpRank(trump_suite, game_rank);
        if (aTrump && bTrump) {
            return aRank != bRank ? aRank - bRank : a.suite - b.suite;
        }
        return aTrump ? 1 : -1;
    });
    return cards;
};

Card.cardsToJson = function (cards) {
    if(cards == null || cards.length<1) return {};
    var S = [];
    var H = [];
    var D = [];
    var C = [];
    var T = [];
    
    cards.forEach(function(c){
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
    });
    
    return {
        S: S,
        H: H,
        D: D,
        C: C,
        T: T        
    };
};

Card.showCards = function (cards) {
    if (cards == null || cards.length < 1) return '';
    var s = '';
    for (var x = 0, c; c = cards[x]; x++) {
        s += c.display();
    }
    return s;
};

Card.sortCards = function (cards, trump_suite, game_rank) {
    if (cards == null || !Array.isArray(cards) || cards.length <= 1) return;
    cards.sort(function (a, b) {
        var aRank = a.trumpRank(trump_suite, game_rank);
        var bRank = b.trumpRank(trump_suite, game_rank);
        if (aRank === bRank) return a.suite === b.suite ? 0 : (a.suite > b.suite ? 1 : -1);
        return aRank > bRank ? 1 : -1;
    });
};

Card.allConnected = function (card_keys) {
    // test if all ranks are connected
    if (!Array.isArray(card_keys) || card_keys.length < 1) return false;

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
    if (!Array.isArray(card_keys) || card_keys.length < 2) return false;

    var ranks = [];
    for (var x = 0, ck; ck = card_keys[x]; x++) {
        ranks.push(Number.parseInt(ck.substring(1)));
    }
    ranks.sort(Card.compareNumber);

    var r0 = ranks[0];
    for (var x = 1, r1; r1 = ranks[x]; x++) {
        if (r1 - r0 === 1) return false;
        r0 = r1;
    }

    return true;
};


Card.getTotalPoints = function (cards) {
    if (cards == null || cards.length < 1) return 0;
    var points = 0;
    cards.forEach(function (c) {
        points += c.getPoint();
    });

    return points;
};

// total number of specific card in an array
// k: e.g. 'S10', 'H6', 'V97' ...
Card.getTotalCardNumber = function (cards, k) {
    if (cards == null || cards.length < 1) return 0;
    var num = 0;
    for (var x = 0, c; c = cards[x]; x++) {
        if (c.suite + c.rank === k) num++;
    }

    return num;
};