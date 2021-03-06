module.exports = Deck;

var Func = require('./func');
var Card = require('./card');

function Deck(decks) {
	  this.deckNumber = decks;

    this._wholeDeck = [];
    for (var i = 0; i < this.deckNumber; i++) {
        for (var r = 2; r <= 14; r++) {
            this._wholeDeck.push(new Card(Card.SUITE.SPADE, r));
            this._wholeDeck.push(new Card(Card.SUITE.DIAMOND, r));
            this._wholeDeck.push(new Card(Card.SUITE.CLUB, r));
            this._wholeDeck.push(new Card(Card.SUITE.HEART, r));
        }
        this._wholeDeck.push(new Card(Card.SUITE.JOKER, Card.RANK.SmallJoker));
        this._wholeDeck.push(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));
    }
    
    Func.shuffleArray(this._wholeDeck);
}

Deck.prototype.deal = function (players) {
    var wholeDeck = this._wholeDeck;
    var playerNumber = players.length;
    var totalCards = wholeDeck.length;
    var reserved = totalCards % playerNumber;
    if (reserved < playerNumber / 2) reserved += playerNumber;
    var cardsPerPlayer = (totalCards - reserved) / playerNumber;

    // deal cards
    for (var i = 0, p; p = players[i]; i++) {
        p.newHand();
        for (var j = 0; j < cardsPerPlayer; j++) {
            var x = Math.floor(Math.random() * (wholeDeck.length));
            p.addCard(wholeDeck[x]);
            wholeDeck.splice(x, 1);
        }
        p.sortHand();
    }

    this.remains = this._wholeDeck;
};

Deck.prototype.toString = function () {
    return this.deckNumber + '/' + this.playerNumber;
};

