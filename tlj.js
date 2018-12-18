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
//players.forEach(function (p) {
//    console.log('' + (n++));
//    console.log(p.showHand());
//    p.currentRank = 10;
//});

game.setContractor(players[4]);
//game.setTrump(new Card(Card.SUITE.HEART, 5));
game.setTrump(new Card(Card.SUITE.SMALL_JOKER, Card.RANK.SmallJoker));
n = 1;
//players.forEach(function (p) {
//    console.log('' + (n++));
//    console.log(p.showHand());
//});

var cards = [];
cards.push(new Card(Card.SUITE.SPADE, 3));
cards.push(new Card(Card.SUITE.SPADE, 3));
console.log('Hand type: ' + game.getHandType(players[0], cards));

