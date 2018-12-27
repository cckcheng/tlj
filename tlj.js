var Deck = require('./deck.js');
var Card = require('./card');
var Player = require('./player');
var Table = require('./table');
var Game = require('./game');

var table = new Table({
//    matchType: Table.MATCH_TYPE.HALF
    matchType: Table.MATCH_TYPE.POINTS
//    matchType: Table.MATCH_TYPE.EXPRESS
});

var players = [];
while (players.length < 6) {
    players.push(new Player());
}

var game = new Game(players, 4);

var n = 1;
players.forEach(function (p) {
//    console.log('' + (n++));
//    console.log(p.showHand());
    p.currentRank = 7;
});

game.setContractor(players[4]);
//game.setTrump(new Card(Card.SUITE.CLUB, 7));
//game.setTrump(new Card(Card.SUITE.SPADE, 14));
//game.setTrump(new Card(Card.SUITE.SPADE, 6));
game.setTrump(new Card(Card.SUITE.HEART, 7));
//game.setTrump(new Card(Card.SUITE.SMALL_JOKER, Card.RANK.SmallJoker));
n = 1;
//players.forEach(function (p) {
//    console.log('' + (n++));
//    console.log(p.showHand());
//});

//console.log(players[4].currentRank);
//console.log(game.rank);
var cards = [];
//cards.push(new Card(Card.SUITE.SPADE, 5));
//cards.push(new Card(Card.SUITE.SPADE, 3));
//cards.push(new Card(Card.SUITE.SPADE, 4));
//cards.push(new Card(Card.SUITE.SPADE, 5));
//cards.push(new Card(Card.SUITE.SPADE, 6));
//cards.push(new Card(Card.SUITE.SPADE, 13));
//cards.push(new Card(Card.SUITE.SPADE, 14));
//cards.push(new Card(Card.SUITE.SPADE, 8));
cards.push(new Card(Card.SUITE.CLUB, 8));
cards.push(new Card(Card.SUITE.CLUB, 8));
cards.push(new Card(Card.SUITE.CLUB, 8));
cards.push(new Card(Card.SUITE.CLUB, 10));
cards.push(new Card(Card.SUITE.CLUB, 10));
cards.push(new Card(Card.SUITE.CLUB, 10));

//cards.push(new Card(Card.SUITE.HEART, 8));

//cards.push(new Card(Card.SUITE.HEART, 2));
//cards.push(new Card(Card.SUITE.HEART, 9));
//cards.push(new Card(Card.SUITE.HEART, 9));
//cards.push(new Card(Card.SUITE.HEART, 11));
//cards.push(new Card(Card.SUITE.HEART, 13));
//cards.push(new Card(Card.SUITE.HEART, 12));
//cards.push(new Card(Card.SUITE.SMALL_JOKER, Card.RANK.SmallJoker));
//cards.push(new Card(Card.SUITE.BIG_JOKER, Card.RANK.BigJoker));

//cards.push(new Card(Card.SUITE.HEART, 13));
//cards.push(new Card(Card.SUITE.CLUB, 7));
debugger;
//console.log('Hand type: ' + game.getHandType(players[0], cards));
//players[1].addCard(new Card(Card.SUITE.SMALL_JOKER, Card.RANK.SmallJoker));
//players[1].addCard(new Card(Card.SUITE.SMALL_JOKER, Card.RANK.SmallJoker));
//players[1].addCard(new Card(Card.SUITE.SMALL_JOKER, Card.RANK.SmallJoker));
//players[1].addCard(new Card(Card.SUITE.HEART, 7));
//players[1].resortCards(Card.SUITE.CLUB, 8);
//console.log(players[1].showHand());
console.log('Can Lead: ' + game.isLeadingValid(players[0], cards));
//console.log('Hand type: ' + game.getHandType(players[0], new Card(Card.SUITE.SPADE, 5)));

