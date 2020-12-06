module.exports = Card;

var HandStat = require('./stat');
const {Game, Hand, SimpleHand} = require('./game');

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

Card.SUITES = ['C', 'D', 'H', 'S'];

Card.RANK = {
    Ace: 14,
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

Card.prototype.isHonor = function (trump_suite, game_rank) {
    if (this.isTrump(trump_suite, game_rank)) return this.rank === Card.RANK.BigJoker;
    return game_rank === 14 ? this.rank === 13 : this.rank === 14;
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

// rank by value
Card.prototype.valueRank = function (trump_suite, game_rank) {
    if (this.rank === game_rank) {
        return this.suite === trump_suite ? 15 : 14;
    }

    var point = this.getPoint();
    if (point === 0) return this.trumpRank(trump_suite, game_rank);
    return point < 10 ? 13 : 14; // 5 ==> A, 10 or K ==> A+1
};

Card.prototype.key = function (trump_suite, game_rank) {
    return this.suite + this.trumpRank(trump_suite, game_rank);
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
    if (a.equals(b)) return 0;
	if(a.suite === b.suite) {
		return a.rank - b.rank;
	}

	return a.suite > b.suite ? 1 : -1;
};

Card.compareRank = function (a, b) {
		return a.rank !== b.rank ? a.rank - b.rank : (a.suite > b.suite ? 1 : -1);
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
    if (s == null || s.length < 2) return null;
    if(!/[CDHSV][0-9]{1,2}/.test(s)) return null;
    var ch0 = s.charAt(0);
    var rnk = parseInt(s.substr(1));
    switch(ch0) {
        case 'C':
        case 'D':
        case 'H':
        case 'S':
            if(rnk < 2 || rnk > 14) return null;
            break;
        case 'V':
            if(rnk !== Card.RANK.SmallJoker && rnk !== Card.RANK.BigJoker) return null;
            break;

    }
    return new Card(ch0, rnk);
};

Card.stringToArray = function (strCards, trump_suite, game_rank) {
    if (strCards == null || strCards.length < 2)
        return [];

    var cards = [];
    var ss = strCards.split(',');
    ss.forEach(function (s) {
        var c = Card.fromString(s.trim());
        if(c == null) return;
        cards.push(c);
    });

    cards.sort(function (a, b) {
        if (a.equals(b)) return 0;
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
    if (cards == null || cards.length < 1) return {};
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

Card.getPointCards = function(cards) {
    var pCards = [];
    cards.forEach(function (c) {
        if (c.getPoint() > 0) pCards.push(c);
    });

    return pCards;
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

Card.removeStrongHands = function (cardList, trump, gameRank, numKeep) {
    if(cardList.length - numKeep <= 3) return cardList;

    var tmpCards = cardList.slice();
    var isTrump = cardList[0].isTrump(trump, gameRank);
    var stat, rnks, sHand, tractors, card;

    stat = new HandStat(tmpCards, trump, gameRank);
    if(stat.totalQuads > 0) {
        rnks = stat.sortedRanks(4);
		    card = stat.findCardByDupNum(rnks[rnks.length-1], 4);
      	tmpCards.splice(card.indexOf(tmpCards), 4);
      	return Card.removeStrongHands(tmpCards, trump, gameRank, numKeep);
    }

    var m = 3;
    tractors = stat.getTractors(3);
    if(tractors.length < 1) {
        m = 2;
        tractors = stat.getTractors(2);
    }
    if(tractors.length > 0) {
    		var simHand = tractors[0];
    		if(simHand.type.len === tmpCards.length) return tmpCards;

    		var sRank = simHand.minRank;
    		for (var x = 0; x < simHand.type.len; x += m) {
      			card = stat.findCardByDupNum(sRank, m);
      			tmpCards.splice(card.indexOf(tmpCards), m);
      			sRank++;
    		}
    		return Card.removeStrongHands(tmpCards, trump, gameRank, numKeep);
    }

    return tmpCards;
};

Card.selectCardsSmart = function (cards, cardList, pointFirst, trump, gameRank, num, keepTop, useMaxRank) {
    if(cardList.length <= num) {
        cardList.forEach(function (c) {
            cards.push(c);
        });
        return [];
    }

    var tmpCards = cardList.slice();
    var lst = cardList.slice();
    var maxCard = lst[lst.length-1];
    if((keepTop || useMaxRank) && lst.length > num) lst.splice(lst.length-1, 1);
    lst = Card.removeStrongHands(lst, trump, gameRank, num);
    if(lst.length < num) lst = cardList.slice();  // unable to keep strong hand any more
    var stat = new HandStat(lst, trump, gameRank);

    if (pointFirst) {
        lst.sort(function (a, b) {
            if (a.equals(b)) return 0;
            if (a.isHonor(trump, gameRank)) return 1;
            if (b.isHonor(trump, gameRank)) return -1;
            var aPoint = a.getPoint();
            var bPoint = b.getPoint();
            if (aPoint !== bPoint) return pointFirst ? bPoint - aPoint : aPoint - bPoint;
            var aDup = stat.stat[a.key(trump, gameRank)];
            var bDup = stat.stat[b.key(trump, gameRank)];
            if (aDup !== bDup) {
                return aDup - bDup;
            }
            return a.trumpRank(trump, gameRank) - b.trumpRank(trump, gameRank);
        });
    } else {
        lst.sort(function (a, b) {
            if (a.equals(b)) return 0;
            var aPoint = a.getPoint();
            var bPoint = b.getPoint();
            if (aPoint !== bPoint) {
                // sort by value
                var aValue = a.valueRank();
                var bValue = b.valueRank();
                return aValue === bValue ? a.rank - b.rank : aValue - bValue;
            }
            if (a.isHonor(trump, gameRank)) return 1;
            if (b.isHonor(trump, gameRank)) return -1;
            var aDup = stat.stat[a.key(trump, gameRank)];
            var bDup = stat.stat[b.key(trump, gameRank)];
            if (aDup !== bDup) {
                return aDup - bDup;
            }
            return a.trumpRank(trump, gameRank) - b.trumpRank(trump, gameRank);
        });
    }

    var total = num;
    if(useMaxRank) {
        cards.push(maxCard);
        tmpCards.splice(tmpCards.length-1, 1);
        total--;
    }
    for (var x = 0, c; x < total; x++) {
        c = lst[x];
        cards.push(c);
        tmpCards.splice(c.indexOf(tmpCards), 1);
    }

    return tmpCards;
};

Card.selectPointCardsFirst = function (cards, cardList) {
    var lst = cardList.slice();
    lst.sort(function (a, b) {
        var aPoint = a.getPoint();
        var bPoint = b.getPoint();
        if (aPoint === bPoint) return a.rank - b.rank;
        return bPoint - aPoint;
    });
    
    var c0 = lst[0];
    c0.extractAll(cards, lst);
};

Card.selectCardsByPoint = function (cards, cardList, pointFirst, trump, gameRank, num, keepTop) {
    var tmpCards = cardList.slice();
    var stat = new HandStat(tmpCards, trump, gameRank);
    var lst = cardList.slice();
    if(keepTop && lst.length > num) lst.splice(lst.length-1, 1);

    lst.sort(function (a, b) {
        if (a.equals(b)) return 0;
        if (a.isHonor(trump, gameRank)) return 1;
        if (b.isHonor(trump, gameRank)) return -1;
        var aDup = stat.stat[a.key(trump, gameRank)];
        var bDup = stat.stat[b.key(trump, gameRank)];
        if (aDup !== bDup) {
            return aDup - bDup;
        }
        var aPoint = a.getPoint();
        var bPoint = b.getPoint();
        if (aPoint === bPoint) return a.trumpRank(trump, gameRank) - b.trumpRank(trump, gameRank);
        return pointFirst ? bPoint - aPoint : aPoint - bPoint;
    });
    for (var x = 0, c; x < num; x++) {
        c = lst[x];
        cards.push(c);
        tmpCards.splice(c.indexOf(tmpCards), 1);
    }

    return tmpCards;
};

// select pair, trips, quads
Card.selectSimpleHandByPoint = function (handType, cards, cardList, pointFirst, trump, gameRank, keepTop, useMaxRank) {
    var wholeLength = handType.len + cards.length;
    var tmpCards = cardList.slice();
    var stat = new HandStat(tmpCards, trump, gameRank);
    if (stat.totalPairs < 1) {
        return Card.selectCardsByPoint(cards, tmpCards, pointFirst, trump, gameRank, handType.len, keepTop);
    }

    var isTrump = tmpCards[0].isTrump(trump, gameRank);
    var rnks = stat.sortedRanks(handType.len);
    var rnk0;
    if (rnks.length > 0) {
        if(useMaxRank) {
            rnk0 = rnks[rnks.length - 1];
        } else {
            rnks.sort(sortByPoint(pointFirst, trump, gameRank));
            rnk0 = rnks[0];
        }
        var sHand = new SimpleHand(handType, rnk0, isTrump);
        var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
        cc.forEach(function (c) {
            cards.push(c);
            tmpCards.splice(c.indexOf(tmpCards), 1);
        });
    } else {
        if (handType.cat === Hand.COMBINATION.TRIPS) {
            rnks = stat.sortedRanks(2);
            rnks.sort(sortByPoint(pointFirst, trump, gameRank));
            var sHand = new SimpleHand({cat: Hand.COMBINATION.PAIR, len: 2}, rnks[0], isTrump);
            var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
            cc.forEach(function (c) {
                cards.push(c);
                tmpCards.splice(c.indexOf(tmpCards), 1);
            });
            tmpCards = Card.selectCardsByPoint(cards, tmpCards, pointFirst, trump, gameRank, 1, keepTop);
        } else if (handType.cat === Hand.COMBINATION.QUADS) {
            rnks = stat.sortedRanks(3);
            if (rnks.length > 0) {
                rnks.sort(sortByPoint(pointFirst, trump, gameRank));
                var sHand = new SimpleHand({cat: Hand.COMBINATION.TRIPS, len: 3}, rnks[0], isTrump);
                var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
                cc.forEach(function (c) {
                    cards.push(c);
                    tmpCards.splice(c.indexOf(tmpCards), 1);
                });
                tmpCards = Card.selectCardsByPoint(cards, tmpCards, pointFirst, trump, gameRank, 1, keepTop);
            } else {
                var tractors = stat.getTractors(2, isTrump);
                if (tractors.length > 0) {
                    var tIdx = tractors.length - 1;
                    tractors[tIdx].type.len = 4;
                    var cc = Hand.makeCards(tractors[tIdx], tmpCards, trump, gameRank);
                    cc.forEach(function (c) {
                        cards.push(c);
                        tmpCards.splice(c.indexOf(tmpCards), 1);
                    });
                    return tmpCards;
                }

                rnks = stat.sortedRanks(2);
                rnks.sort(sortByPoint(pointFirst, trump, gameRank));
                for (var x = 0, count = 0; x < rnks.length && count < 2; x++, count++) {
                    var sHand = new SimpleHand({cat: Hand.COMBINATION.PAIR, len: 2}, rnks[x], isTrump);
                    var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
                    cc.forEach(function (c) {
                        cards.push(c);
                        tmpCards.splice(c.indexOf(tmpCards), 1);
                    });
                }
                if (cards.length < wholeLength) {
                    tmpCards = Card.selectCardsByPoint(cards, tmpCards, pointFirst, trump, gameRank, wholeLength - cards.length, keepTop);
                }
            }
        }
    }

    return tmpCards;
};

function sortByPoint(pointFirst, trump, gameRank) {
    return function (a, b) {
        var aPoint = Card.getPointByTrumpRank(a, trump, gameRank);
        var bPoint = Card.getPointByTrumpRank(b, trump, gameRank);
        if (aPoint === bPoint) return a - b;
        return pointFirst ? bPoint - aPoint : aPoint - bPoint;
    };
}

// select tractor2 (connected pairs), len: total card number
Card.selectTractor2 = function (len, cards, cardList, pointFirst, trump, gameRank, leadingHand) {
    var wholeLength = len + cards.length;

    var tmpCards = cardList.slice();
    var stat = new HandStat(cardList, trump, gameRank);
    if (stat.totalPairs < 1) {
        return Card.selectCardsByPoint(cards, tmpCards, pointFirst, trump, gameRank, len);
    }

    var isTrump = tmpCards[0].isTrump(trump, gameRank);
    if (len === 4 && stat.totalQuads > 0) {
        // play quads to beat tractor
        var sHand = new SimpleHand({cat: Hand.COMBINATION.QUADS, len: 4},
                stat.sortedRanks(4)[0], isTrump);
        var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
        cc.forEach(function (c) {
            cards.push(c);
            tmpCards.splice(c.indexOf(tmpCards), 1);
        });
        return tmpCards;
    }

    var pairType = {cat: Hand.COMBINATION.PAIR, len: 2};

    var rnks = stat.sortedRanks(2);
    if (stat.totalPairs * 2 <= len) {
        if (stat.totalPairs > rnks.length) {
            rnks = rnks.concat(stat.sortedRanks(4));
        }

        for (var x = 0; x < rnks.length; x++) {
            var sHand = new SimpleHand(pairType, rnks[x], isTrump);
            var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
            cc.forEach(function (c) {
                cards.push(c);
                tmpCards.splice(c.indexOf(tmpCards), 1);
            });
        }
    } else {
        var tractors = stat.getTractors(2, isTrump);
        if (tractors.length > 0) {
            var totalLen = 0;
            tractors.forEach(function (sHand) {
                totalLen += sHand.type.len;
            });
            if (totalLen <= len) {
                tractors.forEach(function (sHand) {
                    var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
                    cc.forEach(function (c) {
                        cards.push(c);
                        tmpCards.splice(c.indexOf(tmpCards), 1);
                    });
                });
            } else {
                var canBeat = false;
                for(x = 0; x < tractors.length; x++){
                    if(Hand.canBeat(tractors[x], leadingHand, 2)) {
                        var delta = (tractors[x].type.len - leadingHand.type.len) / 2;
                        tractors[x].type.len = len;
                        tractors[x].minRank += delta;
                        var cc = Hand.makeCards(tractors[x], tmpCards, trump, gameRank);
                        cc.forEach(function (c) {
                            cards.push(c);
                            tmpCards.splice(c.indexOf(tmpCards), 1);
                        });
                        canBeat = true;
                        break;
                    }
                }

                if(!canBeat) {
                    var left = len;
                    var asc = (len > 4 && tractors[0].type.len > 4);
                    for (var x = (asc ? 0 : tractors.length - 1); asc ? x < tractors.length : x >= 0 && left >= 4; asc ? x++ : x--) {
                        if (tractors[x].type.len > left) {
                            tractors[x].type.len = left;
                        }
    
                        var cc = Hand.makeCards(tractors[x], tmpCards, trump, gameRank);
                        cc.forEach(function (c) {
                            cards.push(c);
                            tmpCards.splice(c.indexOf(tmpCards), 1);
                        });
                        left -= tractors[x].type.len;
                    }
                }
            }

            if (cards.length === wholeLength) return tmpCards;

            stat = new HandStat(tmpCards, trump, gameRank);
            rnks = stat.sortedRanks(2);
            if (stat.totalPairs > rnks.length) {
                rnks = rnks.concat(stat.sortedRanks(4));
            }
        }

        rnks.sort(sortByPoint(pointFirst, trump, gameRank));
        for (var x = 0, count = wholeLength - cards.length; x < rnks.length && count > 0; x++, count -= 2) {
            var sHand = new SimpleHand(pairType, rnks[x], isTrump);
            var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
            cc.forEach(function (c) {
                cards.push(c);
                tmpCards.splice(c.indexOf(tmpCards), 1);
            });
        }
    }

    if (cards.length < wholeLength) {
        return Card.selectCardsByPoint(cards, tmpCards, pointFirst, trump, gameRank, wholeLength - cards.length);
    }

    return tmpCards;
};

// select tractor3 (connected trips), len: total card number
Card.selectTractor3 = function (len, cards, cardList, pointFirst, trump, gameRank) {
    var wholeLength = len + cards.length;
    var tmpCards = cardList.slice();
    var stat = new HandStat(cardList, trump, gameRank);
    if (stat.totalPairs < 1) {
        return Card.selectCardsByPoint(cards, cardList, pointFirst, trump, gameRank, len);
    }

    var isTrump = cardList[0].isTrump(trump, gameRank);
    var tripsType = Hand.SIMPLE_TYPE.TRIPS;
    var pairType = Hand.SIMPLE_TYPE.PAIR;

    var rnks = stat.sortedRanks(3);
    if (stat.totalPairs * 3 <= len) {
        for (var x = 0; x < rnks.length; x++) {
            var sHand = new SimpleHand(tripsType, rnks[x], isTrump);
            var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
            cc.forEach(function (c) {
                cards.push(c);
                tmpCards.splice(c.indexOf(tmpCards), 1);
            });
        }

        if (cards.length === wholeLength) return tmpCards;
        if (cards.length > 0) stat = new HandStat(tmpCards, trump, gameRank);
        rnks = stat.sortedRanks(2);

        for (var x = 0; x < rnks.length; x++) {
            var sHand = new SimpleHand(pairType, rnks[x], isTrump);
            var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
            cc.forEach(function (c) {
                cards.push(c);
                tmpCards.splice(c.indexOf(tmpCards), 1);
            });
        }

        if (cards.length < wholeLength) {
            tmpCards = Card.selectCardsByPoint(cards, tmpCards, pointFirst, trump, gameRank, wholeLength - cards.length);
        }
        return tmpCards;
    }

    var tractors = stat.getTractors(3, isTrump);
    if (tractors.length > 0) {
        var totalLen = 0;
        tractors.forEach(function (sHand) {
            totalLen += sHand.type.len;
        });

        if (totalLen <= len) {
            tractors.forEach(function (sHand) {
                var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
                cc.forEach(function (c) {
                    cards.push(c);
                    tmpCards.splice(c.indexOf(tmpCards), 1);
                });
            });
        } else {
            var left = len;
            for (var x = tractors.length - 1; x >= 0 && left >= 6; x--) {
                if (tractors[x].type.len > left) {
                    tractors[x].type.len = left;
                }

                var cc = Hand.makeCards(tractors[x], tmpCards, trump, gameRank);
                cc.forEach(function (c) {
                    cards.push(c);
                    tmpCards.splice(c.indexOf(tmpCards), 1);
                });
                left -= tractors[x].type.len;
            }
        }

        if (cards.length === wholeLength) return tmpCards;

        stat = new HandStat(tmpCards, trump, gameRank);
        rnks = stat.sortedRanks(3);
    }

    var count = wholeLength - cards.length;
    if (rnks.length * 3 > count) rnks.sort(sortByPoint(pointFirst, trump, gameRank));
    for (var x = 0; x < rnks.length && count > 0; x++, count -= 3) {
        var sHand = new SimpleHand(tripsType, rnks[x], isTrump);
        var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
        cc.forEach(function (c) {
            cards.push(c);
            tmpCards.splice(c.indexOf(tmpCards), 1);
        });
    }

    if (cards.length === wholeLength) return tmpCards;

    count = wholeLength - cards.length;
    if (count === 3) {
        return Card.selectSimpleHandByPoint(tripsType, cards, tmpCards, pointFirst, trump, gameRank);
    }

    var pairLen = Math.round(count / 3 * 2);
    tmpCards = Card.selectTractor2(pairLen, cards, tmpCards, pointFirst, trump, gameRank);
    return Card.selectCardsByPoint(cards, tmpCards, pointFirst, trump, gameRank, wholeLength - cards.length);
};

// select tractor4 (connected quads), len = total card number
Card.selectTractor4 = function (len, cards, cardList, pointFirst, trump, gameRank) {
    var wholeLength = len + cards.length;

    var tmpCards = cardList.slice();
    var stat = new HandStat(cardList, trump, gameRank);
    if (stat.totalPairs < 1) {
        return Card.selectCardsByPoint(cards, cardList, pointFirst, trump, gameRank, len);
    }

    var isTrump = cardList[0].isTrump(trump, gameRank);
    var quadsType = Hand.SIMPLE_TYPE.QUADS;
    var tripsType = Hand.SIMPLE_TYPE.TRIPS;
    var pairType = Hand.SIMPLE_TYPE.PAIR;

    var rnks = stat.sortedRanks(4);
    if (stat.totalPairs * 4 <= len) {
        if (rnks.length > 0) {
            for (var x = 0; x < rnks.length; x++) {
                var sHand = new SimpleHand(quadsType, rnks[x], isTrump);
                var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
                cc.forEach(function (c) {
                    cards.push(c);
                    tmpCards.splice(c.indexOf(tmpCards), 1);
                });
            }

            if (cards.length === wholeLength) return tmpCards;
            stat = new HandStat(tmpCards, trump, gameRank);
        }

        rnks = stat.sortedRanks(3);
        if (rnks.length > 0) {
            for (var x = 0; x < rnks.length; x++) {
                var sHand = new SimpleHand(tripsType, rnks[x], isTrump);
                var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
                cc.forEach(function (c) {
                    cards.push(c);
                    tmpCards.splice(c.indexOf(tmpCards), 1);
                });
            }
            stat = new HandStat(tmpCards, trump, gameRank);
        }

        rnks = stat.sortedRanks(2);
        for (var x = 0; x < rnks.length; x++) {
            var sHand = new SimpleHand(pairType, rnks[x], isTrump);
            var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
            cc.forEach(function (c) {
                cards.push(c);
                tmpCards.splice(c.indexOf(tmpCards), 1);
            });
        }

        if (cards.length < wholeLength) {
            tmpCards = Card.selectCardsByPoint(cards, tmpCards, pointFirst, trump, gameRank, wholeLength - cards.length);
        }
        return tmpCards;
    }

    var tractors = stat.getTractors(4, isTrump);
    if (tractors.length > 0) {
        var left = wholeLength - cards.length;
        for (var x = tractors.length - 1; x >= 0; x--) {
            if (tractors[x].type.len > left) {
                tractors[x].type.len = left;
            }

            var cc = Hand.makeCards(tractors[x], tmpCards, trump, gameRank);
            cc.forEach(function (c) {
                cards.push(c);
                tmpCards.splice(c.indexOf(tmpCards), 1);
            });
            left -= tractors[x].type.len;
            if (left < 8) break;    // not qualify for select a tractor4 (minimum 8 cards need)
        }

        if (cards.length === wholeLength) return tmpCards;

        stat = new HandStat(tmpCards, trump, gameRank);
        rnks = stat.sortedRanks(4);
    }

    var count = wholeLength - cards.length;
    for (var x = 0; x < rnks.length && count > 0; x++, count -= 4) {
        var sHand = new SimpleHand(quadsType, rnks[x], isTrump);
        var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
        cc.forEach(function (c) {
            cards.push(c);
            tmpCards.splice(c.indexOf(tmpCards), 1);
        });
    }

    if (cards.length === wholeLength) return tmpCards;

    count = wholeLength - cards.length;
    if (count === 4) {
        return Card.selectSimpleHandByPoint(quadsType, cards, tmpCards, pointFirst, trump, gameRank);
    }

    stat = new HandStat(tmpCards, trump, gameRank);
    var tractors = stat.getTractors(3, isTrump);
    if (tractors.length > 0) {
        var left = (wholeLength - cards.length) / 4 * 3;
        var cNum = 0;
        for (var x = tractors.length - 1; x >= 0; x--) {
            if (tractors[x].type.len > left) {
                tractors[x].type.len = left;
            }

            var cc = Hand.makeCards(tractors[x], tmpCards, trump, gameRank);
            cc.forEach(function (c) {
                cards.push(c);
                tmpCards.splice(c.indexOf(tmpCards), 1);
            });
            left -= tractors[x].type.len;
            cNum += tractors[x].type.len;
            if (left < 6) break;
        }

        tmpCards = Card.selectCardsByPoint(cards, tmpCards, pointFirst, trump, gameRank, cNum / 3);
        if (cards.length === wholeLength) return tmpCards;

        count = wholeLength - cards.length;
        if (count === 4) {
            return Card.selectSimpleHandByPoint(quadsType, cards, tmpCards, pointFirst, trump, gameRank);
        }
        stat = new HandStat(tmpCards, trump, gameRank);
    }

    rnks = stat.sortedRanks(3);
    if (rnks.length * 4 > count) rnks.sort(sortByPoint(pointFirst, trump, gameRank));
    for (var x = 0; x < rnks.length && count > 0; x++, count -= 4) {
        var sHand = new SimpleHand(tripsType, rnks[x], isTrump);
        var cc = Hand.makeCards(sHand, tmpCards, trump, gameRank);
        cc.forEach(function (c) {
            cards.push(c);
            tmpCards.splice(c.indexOf(tmpCards), 1);
        });
        tmpCards = Card.selectCardsByPoint(cards, tmpCards, pointFirst, trump, gameRank, 1);
    }

    if (cards.length === wholeLength) return tmpCards;

    return Card.selectTractor2(wholeLength - cards.length, cards, tmpCards, pointFirst, trump, gameRank);
};

Card.getPointByTrumpRank = function (trumpRank, trump, gameRank) {
    var orgRank = trumpRank < gameRank ? trumpRank : trumpRank + 1;
    if (gameRank === 5 || gameRank === 10 || gameRank === 13) {
        if (trump === Card.SUITE.JOKER) {
            if (trumpRank === 14) return Card.rankToPoint(gameRank);
        } else {
            if (trumpRank === 14 || trumpRank === 15) return Card.rankToPoint(gameRank);
        }
    }

    return Card.rankToPoint(orgRank);
};

Card.rankToPoint = function (rank) {
    if (rank === 5 || rank === 10) return rank;
    if (rank === 13) return 10;
    return 0;
};

// check if all subCards exists in srcCards
Card.containsAll = function (srcCards, subCards) {
    if (subCards.length < 1) return true;
    if (srcCards.length < 1) return false;
    var tmpCards = srcCards.slice();
    var idx = -1;
    for (var x = 0, c; c = subCards[x]; x++) {
        idx = c.indexOf(tmpCards);
        if (idx < 0) return false;
        tmpCards.splice(idx, 1);
    }

    return true;
};

Card.copyCards = function(src, dst) {
    if(src == null || dst == null) return;
    var n = src.length;
    while(n-- > 0) dst.push(src.shift());
};

Card.shortestSuit = function(pointFirst, suites) {
    var suitesNotEmpty = [];
    suites.forEach((s) => {if(s.length > 0) suitesNotEmpty.push(s);});
    if(suitesNotEmpty.length < 1) return null;
    suitesNotEmpty.sort(function (a, b) {
        if(a.length === b.length) {
            var aPoint = Card.getTotalPoints(a);
            var bPoint = Card.getTotalPoints(b);
            return pointFirst ? bPoint - aPoint : aPoint - bPoint;
        }
        return a.length - b.length;
    });
    
    return suitesNotEmpty[0];
};

function toPoint(rank) {
    if(rank === 5 || rank === 10) return rank;
    if(rank === 13) return 10;
    return 0;
}

Card.rankToPoint = function(rank, gameRank) {
    if(rank === 14 || rank === 15)  {
        return toPoint(gameRank);
    }
    if(rank >= gameRank) rank++;
    return toPoint(rank);
};

// count total number of a card in cards list
Card.countCard = function(cards, c) {
    if(cards == null || cards.length < 1) return 0;
    var n = 0;
    cards.forEach((o) => {
        if(o.equals(c)) n++;
    });
    
    return n;
};

Card.removeSingles = function(cards) {
    var singleCards = [];
    cards.forEach((c) => {
        if(Card.countCard(cards, c) <= 1) singleCards.push(c);
    });
    if(singleCards.length > 0) {
        singleCards.forEach((c) => {
            x = c.indexOf(cards);
            cards.splice(x, 1);
        });
    }
    
    return cards;
};

// extract all same card in a suite, return total number of specific card extracted
Card.prototype.extractAll = function (cards, cardList) {
    var c = this;
    var n = 0;
    cardList.forEach((o) => {
        if(o.equals(c)) {
            cards.push(o);
            n++;
        }
    });
    
    return n;
};
