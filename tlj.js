var Deck = require('./deck.js');
var Card = require('./card');
var Player = require('./player');
var Table = require('./table');
var HandStat = require('./stat');
const {Game, Hand, SimpleHand} = require('./game');

console.log(new Date().toLocaleString());

var table = new Table({
    matchType: Table.MATCH_TYPE.FULL
//    matchType: Table.MATCH_TYPE.HALF
//    matchType: Table.MATCH_TYPE.POINTS
//    matchType: Table.MATCH_TYPE.FREE
//    matchType: Table.MATCH_TYPE.EXPRESS
});


var players = [];
var player;
while (players.length < 6) {
    player = new Player({id: 'p' + players.length});
    players.push(player);
    table.addPlayer(player);
}

table.startGame(true);

for(var x=0, p; p=table.players[x]; x++) {
    console.log(p.id);
    p.aiLevel = 3;
}

//if (true) process.exit(0);

//var game = new Game(players, 4);
//table.players.forEach(function (p) {
//    console.log(p.showHand());
//    console.log('minBid: ' + p.minBid);
//});

var n = 1;
//var trump_suite = Card.SUITE.HEART;
var trump_suite = Card.SUITE.CLUB;
var game_rank = 8;

var game = table.game;
var p = table.players[0];

game.contractor = p;
game.partner = table.players[1];
game.enterPlayStage();
game.setTrump(trump_suite);
game.setPartnerDef('DA0');
var curRound = game.currentRound;

//testPartnerPlay();
//testPassPartner();
//testDuckPlay(table.players);
//testEagerPartner();
//testIsFriend();
//testDuckCards(p);
//testFollowPlay();
testRecallStrong();
if(true) {
    process.exit(0);
}

function testRecallStrong() {
    p.newHand();
    addSuit(p, 'S', 14,14,14,13, 11,11,10,10,5,3,3,3);
    addSuit(p, 'C', 8,8,9,10,10, 13);
    addSuit(p, 'D', 11,10,10,10,11);
    p.sortHand();
    p.resortCards(trump_suite, game.rank);
    var cards = [];
        debugger;
    //var strongHand = p.getStrongHand();
    //cards = p.recalStrong(strongHand);

    p.playHonor(cards, game);
    console.log(Card.showCards(cards));
}

function testPartnerPlay() {
    var pn = game.partner;
    pn.newHand();
    addSuit(pn, 'D', 5,5,6,6,11,13);
    addSuit(pn, 'C', 8,9,10,10, 13);
    pn.sortHand();
    pn.resortCards(trump_suite, 2);
    debugger;
    var cards = pn.autoPlayCards(true);
    console.log(Card.showCards(cards));
}

function testPassPartner() {
    p.newHand();
    addSuit(p, 'S', 13,14,12,12,11,11, 10,10,5,2,2,2);
    addSuit(p, 'C', 8,8,9,10,10, 13);
    addSuit(p, 'D', 11,10,10,10,11);
    p.sortHand();
    p.resortCards(trump_suite, 8);
    var cards = [];
    debugger;
    p.passToPartner(cards);
    console.log(Card.showCards(cards));
}

function testDuckPlay(pp) {
    p.newHand();
//SAKQQJJ10105222
    addSuit(p, 'S', 13,14,12,12,11,11, 10,10,5,2,2,2);
//    addSuit(p, 'S', 13,14,5,2,2,2);
    addSuit(p, 'C', 8,8,9,10,10, 13);
//    addSuit(p, 'H', 8,8,9,9,10,10, 13);
//    addSuit(p, 'D', 11,11,10,10, 3, 7, 8);
    p.sortHand();
    p.resortCards(trump_suite, 8);

    curRound.addHand(pp[1], makeCards('H', 3,3,4,4));
    curRound.addHand(pp[3], makeCards('C', 5,5,6,6));
    debugger;
    var cards = p.autoPlayCards(false);
    
    console.log(Card.showCards(cards));
}

function makeCards(suite, ...ranks) {
    var cards = [];
    ranks.forEach((rnk) => {
        cards.push(new Card(suite, rnk));
    });
    return cards;
}

function testEagerPartner(){
    p = players[1];
    p.newHand();
    addSuit(p, 'S', 2,13,13,14,14,5,5,5,13);
    addSuit(p, 'H', 10,10,11,12,12, 4, 4,4, 5,5,6);
    p.sortHand();
    p.resortCards(trump_suite, 2);
    
    console.log(p.showHand());
    debugger;
    console.log(p.eagerPlayPartner('S'));
}

function testIsFriend(){
    game.partner = players[1];
    console.log("contractor: " + game.contractor.id);
    console.log("partner: " + game.partner.id);
    debugger;
    console.log(players[0].id +': '+game.isFriendNext(players[0]));
    console.log(players[1].id +': '+game.isFriendNext(players[1]));
    console.log(players[2].id +': '+game.isFriendNext(players[2]));
    console.log(players[3].id +': '+game.isFriendNext(players[3]));
    console.log(players[4].id +': '+game.isFriendNext(players[4]));
    console.log(players[5].id +': '+game.isFriendNext(players[5]));
}

function testDuckCards(p) {
    p.newHand();
    
    p.addCard(new Card(Card.SUITE.SPADE, 5));
    p.addCard(new Card(Card.SUITE.SPADE, 5));
    p.addCard(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));
    p.addCard(new Card(Card.SUITE.SPADE, 14));
    p.addCard(new Card(Card.SUITE.SPADE, 14));
    p.addCard(new Card(Card.SUITE.SPADE, 13));
    p.addCard(new Card(Card.SUITE.SPADE, 13));
    //p.addCard(new Card(Card.SUITE.SPADE, 13));
    //p.addCard(new Card(Card.SUITE.SPADE, 12));
    //p.addCard(new Card(Card.SUITE.SPADE, 12));
    p.addCard(new Card(Card.SUITE.SPADE, 11));
    p.addCard(new Card(Card.SUITE.SPADE, 11));
    p.addCard(new Card(Card.SUITE.SPADE, 10));
    p.addCard(new Card(Card.SUITE.SPADE, 9));
    
    //p.addCard(new Card(Card.SUITE.SPADE, 10));
    p.addCard(new Card(Card.SUITE.SPADE, 9));
    
    ////////////////////////////////////////////////
    p.addCard(new Card(Card.SUITE.HEART, 3));
    //p.addCard(new Card(Card.SUITE.HEART, 3));
    //p.addCard(new Card(Card.SUITE.HEART, 5));
    p.addCard(new Card(Card.SUITE.HEART, 4));
    p.addCard(new Card(Card.SUITE.HEART, 4));
    p.addCard(new Card(Card.SUITE.HEART, 5));
    p.addCard(new Card(Card.SUITE.HEART, 6));
    p.addCard(new Card(Card.SUITE.HEART, 6));
    p.addCard(new Card(Card.SUITE.HEART, 6));
    
    p.sortHand();
    
    console.log(p.getStrongHandOneSuit([], p.spades));
    
    p.resortCards(Card.SUITE.SPADE, 2);
    
    var cards = [];
    p.aiLevel = 3;
    debugger;
    //p.playHonor(cards, game);
    //cards = p.getStrongHand();
    p.duckCards(cards, Card.SUITE.HEART, true, 3);
    console.log(Card.showCards(cards));
}

//////////////////////////////////////////////////////

function testFollowPlay() {
    var cards = [];
    cards.push(new Card(Card.SUITE.SPADE, 9));
    cards.push(new Card(Card.SUITE.SPADE, 9));
    cards.push(new Card(Card.SUITE.SPADE, 7));
    cards.push(new Card(Card.SUITE.SPADE, 7));
    cards.push(new Card(Card.SUITE.SPADE, 8));
    cards.push(new Card(Card.SUITE.SPADE, 8));
    curRound.addHand(players[0], cards);
    console.log(curRound.getNextLeadingPlayer().id);
    /*
    cards = [];
    cards.push(new Card(Card.SUITE.SPADE, 8));
    cards.push(new Card(Card.SUITE.SPADE, 8));
    cards.push(new Card(Card.SUITE.SPADE, 7));
    cards.push(new Card(Card.SUITE.SPADE, 7));
    curRound.addHand(players[1], cards);
    console.log(curRound.getNextLeadingPlayer().id);
    
    cards = [];
    cards.push(new Card(trump_suite, 5));
    cards.push(new Card(trump_suite, 5));
    cards.push(new Card(trump_suite, 4));
    cards.push(new Card(trump_suite, 4));
    curRound.addHand(players[2], cards);
    console.log(curRound.getNextLeadingPlayer().id);
    
    cards = [];
    cards.push(new Card(trump_suite, 5));
    cards.push(new Card(trump_suite, 5));
    cards.push(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));
    cards.push(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));
    curRound.addHand(players[5], cards);
    console.log(curRound.getNextLeadingPlayer().id);
    */
    
    players[1].spades = [];
    //players[1].addCard(new Card(Card.SUITE.SPADE, 3));
    players[1].addCard(new Card(Card.SUITE.SPADE, 3));
    players[1].addCard(new Card(Card.SUITE.SPADE, 4));
    //players[1].addCard(new Card(Card.SUITE.SPADE, 4));
    players[1].addCard(new Card(Card.SUITE.SPADE, 5));
    players[1].addCard(new Card(Card.SUITE.SPADE, 5));
    
    //players[1].addCard(new Card(Card.SUITE.SPADE, 6));
    players[1].addCard(new Card(Card.SUITE.SPADE, 6));
    players[1].addCard(new Card(Card.SUITE.SPADE, 7));
    players[1].addCard(new Card(Card.SUITE.SPADE, 7));
    //players[1].addCard(new Card(Card.SUITE.SPADE, 8));
    players[1].addCard(new Card(Card.SUITE.SPADE, 8));
    players[1].addCard(new Card(Card.SUITE.SPADE, 9));
    players[1].addCard(new Card(Card.SUITE.SPADE, 9));
    players[1].addCard(new Card(Card.SUITE.SPADE, 10));
    players[1].addCard(new Card(Card.SUITE.SPADE, 10));
    
    players[1].sortHand();
    
    var selCards = [];
    players[1].aiLevel = 3;
    
    debugger;
    players[1].followPlay(selCards, players[1].spades, false);
    console.log(Card.showCards(selCards));

}


function addSuit(p, suite, ...ranks) {
    ranks.forEach((rnk) => {
        p.addCard(new Card(suite, rnk));
    });
}

p.spades = [];
p.spades.push(new Card(Card.SUITE.SPADE, 6));
p.spades.push(new Card(Card.SUITE.SPADE, 6));
p.spades.push(new Card(Card.SUITE.SPADE, 7));
p.spades.push(new Card(Card.SUITE.SPADE, 7));
p.spades.push(new Card(Card.SUITE.SPADE, 10));
p.spades.push(new Card(Card.SUITE.SPADE, 10));
p.spades.push(new Card(Card.SUITE.SPADE, 10));
p.spades.push(new Card(Card.SUITE.SPADE, 11));
p.spades.push(new Card(Card.SUITE.SPADE, 11));
p.spades.push(new Card(Card.SUITE.SPADE, 12));
p.spades.push(new Card(Card.SUITE.SPADE, 12));
p.spades.push(new Card(Card.SUITE.SPADE, 12));
p.spades.push(new Card(Card.SUITE.SPADE, 12));
p.spades.push(new Card(Card.SUITE.SPADE, 14));

cards.push(new Card(Card.SUITE.SPADE, 14));
cards.push(new Card(Card.SUITE.SPADE, 13));
cards.push(new Card(Card.SUITE.SPADE, 13));
cards.push(new Card(Card.SUITE.SPADE, 13));
cards.push(new Card(Card.SUITE.SPADE, 13));

game.currentRound.addHand(players[5], cards);

var pCards = [];
pCards.push(new Card(Card.SUITE.SPADE, 14));
pCards.push(new Card(Card.SUITE.SPADE, 12));
pCards.push(new Card(Card.SUITE.SPADE, 12));
pCards.push(new Card(Card.SUITE.SPADE, 12));
pCards.push(new Card(Card.SUITE.SPADE, 7));

var hand = new Hand(p, pCards, trump_suite, game_rank);
debugger;
console.log(p.isValidPlay(hand));
if (true) process.exit(0);
//game.setTrump(new Card(Card.SUITE.JOKER, Card.RANK.SmallJoker));
n = 1;


cards.push(new Card(Card.SUITE.HEART, 3));
cards.push(new Card(Card.SUITE.HEART, 6));
cards.push(new Card(Card.SUITE.HEART, 5));
cards.push(new Card(Card.SUITE.HEART, 4));
cards.push(new Card(Card.SUITE.HEART, 9));

cards.push(new Card(Card.SUITE.HEART, 10));
cards.push(new Card(Card.SUITE.SPADE, 10));
cards.push(new Card(Card.SUITE.DIAMOND, 10));
cards.push(new Card(Card.SUITE.DIAMOND, 10));
cards.push(new Card(Card.SUITE.CLUB, 10));
//cards.push(new Card(Card.SUITE.HEART, 11));
//cards.push(new Card(Card.SUITE.HEART, 11));
cards.push(new Card(Card.SUITE.JOKER, Card.RANK.SmallJoker));
cards.push(new Card(Card.SUITE.JOKER, Card.RANK.SmallJoker));
cards.push(new Card(Card.SUITE.JOKER, Card.RANK.SmallJoker));
cards.push(new Card(Card.SUITE.JOKER, Card.RANK.SmallJoker));
cards.push(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));
cards.push(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));
cards.push(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));
cards.push(new Card(Card.SUITE.JOKER, Card.RANK.BigJoker));

//cards.push(new Card(Card.SUITE.HEART, 13));
//cards.push(new Card(Card.SUITE.CLUB, 7));

trump_suite = 'H';
game_rank = 10;
Card.sortCards(cards, trump_suite, game_rank);

console.log("\n----------------");
console.log(p.showHand());

console.log("\n----------------" + cards.length);
console.log(Card.showCards(cards));

var myCards = [];
debugger;
Card.selectTractor4(12, myCards, cards, false, trump_suite, game_rank);
console.log(Card.showCards(myCards));

if (true) process.exit(0);

//var stat = new HandStat(p.spades, game.trump, game.rank);
//console.log('tractors: ' + stat.getTractors(2, false));
//var stat = new HandStat(p.trumps, game.trump, game.rank);
var stat = new HandStat(cards, trump_suite, game_rank);
var tractors = stat.getTractors(2, true);
console.log('tractors 2: ' + tractors.length);
tractors.forEach(function (sHand) {
    console.log(sHand.minRank + "," + sHand.type.len);
});

var tractors = stat.getTractors(3, true);
console.log('tractors 3: ' + tractors.length);
tractors.forEach(function (sHand) {
    console.log(sHand.minRank + "," + sHand.type.len);
});

var tractors = stat.getTractors(4, true);
console.log('tractors 4: ' + tractors.length);
tractors.forEach(function (sHand) {
    console.log(sHand.minRank + "," + sHand.type.len);
});

stat = new HandStat(p.spades, game.trump, game.rank);
tractors = stat.getTractors(2, true);
console.log('tractors: ' + tractors.length);
tractors.forEach(function (sHand) {
    console.log(sHand.minRank + "," + sHand.type.len);
});

stat = new HandStat(p.hearts, game.trump, game.rank);
tractors = stat.getTractors(2, true);
console.log('tractors: ' + tractors.length);
tractors.forEach(function (sHand) {
    console.log(sHand.minRank + "," + sHand.type.len);
});
if (true) process.exit(0);
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
