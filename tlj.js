var Deck = require('./deck.js');
var Card = require('./card');
var Player = require('./player');
var Table = require('./table');
var Game = require('./game');

var table = new Table({
//    matchType: Table.MATCH_TYPE.HALF
//    matchType: Table.MATCH_TYPE.POINTS
    matchType: Table.MATCH_TYPE.FREE
//    matchType: Table.MATCH_TYPE.EXPRESS
});


var players = [];
var player;
while (players.length < 6) {
    player = new Player();
    players.push(player);
    table.addPlayer(player);
}

table.startGame();

var game = new Game(players, 4);
table.players.forEach(function (p) {
//    console.log('' + (n++));
//    console.log(p.showHand());
//    p.matchInfo.currentRank = game_rank;
    console.log(p.showHand());
    console.log('minBid: ' + p.minBid);
});

if(true) return;

var n = 1;
//var trump_suite = Card.SUITE.HEART;
var trump_suite = Card.SUITE.CLUB;
var game_rank = 7;
players.forEach(function (p) {
//    console.log('' + (n++));
//    console.log(p.showHand());
//    p.matchInfo.currentRank = game_rank;
    console.log(p.showHand());
    p.evaluate();
    console.log('minBid: ' + p.minBid);
});

if(true) return;

game.setContractor(players[4]);
game.setTrump(new Card(trump_suite, 7));
//game.setTrump(new Card(Card.SUITE.JOKER, Card.RANK.SmallJoker));
n = 1;
//players.forEach(function (p) {
//    console.log('' + (n++));
//    console.log(p.showHand());
//});

//console.log(players[4].matchInfo.currentRank);
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
//cards.push(new Card(Card.SUITE.CLUB, 14));

cards.push(new Card(Card.SUITE.CLUB, 6));
cards.push(new Card(Card.SUITE.CLUB, 6));
cards.push(new Card(Card.SUITE.CLUB, 8));
cards.push(new Card(Card.SUITE.CLUB, 8));
//cards.push(new Card(Card.SUITE.CLUB, 7));
cards.push(new Card(Card.SUITE.CLUB, 4));
cards.push(new Card(Card.SUITE.CLUB, 4));
cards.push(new Card(Card.SUITE.CLUB, 4));
cards.push(new Card(Card.SUITE.CLUB, 5));
cards.push(new Card(Card.SUITE.CLUB, 5));
cards.push(new Card(Card.SUITE.CLUB, 5));
//cards.push(new Card(Card.SUITE.HEART, 7));
//cards.push(new Card(Card.SUITE.HEART, 8));

//cards.push(new Card(Card.SUITE.HEART, 2));
//cards.push(new Card(Card.SUITE.HEART, 9));
//cards.push(new Card(Card.SUITE.HEART, 9));
//cards.push(new Card(Card.SUITE.HEART, 11));
//cards.push(new Card(Card.SUITE.HEART, 13));
//cards.push(new Card(Card.SUITE.HEART, 12));
//cards.push(new Card(Card.SUITE.JOKER, Card.RANK.SmallJoker));
//cards.push(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));

//cards.push(new Card(Card.SUITE.HEART, 13));
//cards.push(new Card(Card.SUITE.CLUB, 7));

//debugger;

Card.sortCards(cards, trump_suite, game_rank);
//console.log('Hand type: ' + game.getHandType(players[0], cards));
//players[1].addCard(new Card(Card.SUITE.JOKER, Card.RANK.SmallJoker));
//players[1].addCard(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));
//players[1].addCard(new Card(Card.SUITE.JOKER, Card.RANK.SmallJoker));
//players[1].addCard(new Card(Card.SUITE.DIAMOND, 7));
//players[1].addCard(new Card(Card.SUITE.HEART, 7));
//players[1].addCard(new Card(Card.SUITE.CLUB, 14));
//players[1].addCard(new Card(Card.SUITE.HEART, 7));
//players[1].addCard(new Card(Card.SUITE.CLUB, 14));
//players[1].addCard(new Card(Card.SUITE.HEART, 7));
//players[1].addCard(new Card(Card.SUITE.CLUB, 14));
players[1].resortCards(trump_suite, game_rank);
//console.log(players[1].showHand());
console.log('Can Lead: ' + game.isLeadingValid(players[0], cards));
if (players[0].mustLead != null) console.log('Must Lead: ' + players[0].mustLead.display());
//console.log('Hand type: ' + game.getHandType(players[0], new Card(Card.SUITE.SPADE, 5)));
