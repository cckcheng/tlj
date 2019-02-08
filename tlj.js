var Deck = require('./deck.js');
var Card = require('./card');
var Player = require('./player');
var Table = require('./table');
const {Game, Hand} = require('./game');

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

table.startGame(true);

//var game = new Game(players, 4);
table.players.forEach(function (p) {
    console.log(p.showHand());
    console.log('minBid: ' + p.minBid);
});

var n = 1;
//var trump_suite = Card.SUITE.HEART;
var trump_suite = Card.SUITE.CLUB;
var game_rank = 7;

var game = table.game;
var p = players[0];

game.contractor = p;
game.enterPlayStage();
game.setTrump(trump_suite);
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

//cards.push(new Card(Card.SUITE.CLUB, 6));
//cards.push(new Card(Card.SUITE.CLUB, 8));
//cards.push(new Card(Card.SUITE.CLUB, 7));
//cards.push(new Card(Card.SUITE.CLUB, 4));
//cards.push(new Card(Card.SUITE.CLUB, 2));
//cards.push(new Card(Card.SUITE.HEART, 7));
//cards.push(new Card(Card.SUITE.HEART, 8));
//cards.push(new Card(Card.SUITE.CLUB, 15));

//cards.push(new Card(Card.SUITE.HEART, 2));
//cards.push(new Card(Card.SUITE.HEART, 9));
//cards.push(new Card(Card.SUITE.HEART, 9));
//cards.push(new Card(Card.SUITE.HEART, 11));
//cards.push(new Card(Card.SUITE.HEART, 13));
//cards.push(new Card(Card.SUITE.HEART, 12));
cards.push(new Card(Card.SUITE.JOKER, Card.RANK.SmallJoker));
cards.push(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));
cards.push(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));

//cards.push(new Card(Card.SUITE.HEART, 13));
//cards.push(new Card(Card.SUITE.CLUB, 7));

//debugger;

Card.sortCards(cards, trump_suite, game_rank);

console.log("\n----------------");
console.log(p.showHand());
//console.log('valid cards: ' + p.allValid(cards));

var pcards = p.trumps.slice(p.trumps.length - 2, p.trumps.length);
//var pcards = p.spades.slice(p.spades.length - 3, p.spades.length);
var strCards = Card.cardsToString(pcards);
console.log('try play: ' + strCards);
p.playCards(strCards);
console.log('played: ' + p.matchInfo.playedCards);

//console.log('Can Lead: ' + game.isLeadingValid(players[0], cards));
//if (players[0].mustLead != null) console.log('Must Lead: ' + players[0].mustLead.display());
//console.log('Hand type: ' + game.getHandType(players[0], new Card(Card.SUITE.SPADE, 5)));
