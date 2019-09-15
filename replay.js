var sqlite3 = require('sqlite3').verbose();

var Config = require('./conf');
var Card = require('./card');
var Table = require('./table');
const {Game, Hand, SimpleHand} = require('./game');
var Player = require('./player');

var args = process.argv.slice(2);
if(args.length < 2) {
    console.log('Usage: table_id game#');
    process.exit(0);
}

var tableId = args.shift();
var gameNum = args.shift();
var toRound = args.shift();

console.log('table_id: ' + tableId);
console.log('game#: ' + gameNum);
console.log('to Round#: ' + toRound);

var myDB = new sqlite3.Database(Config.MAIN_DB);

var q0 = "select * from games where table_id=? and game=?";
var q1 = "select * from game_player where table_id=? and game=? order by seat";
var q2 = "select * from rounds where table_id=? and game=? order by rowid";

var table,game,holeCards0, holeCards1, partnerDef;

myDB.serialize(() => {
    myDB.get(q0, [tableId, gameNum], (err, row) => {
        if (err) {
            console.log(err.message);
        } else {
            if(row == null) {
                console.log('No game record found');
                return;
            }
            game = new Game(null, 4);
            game.contractPoint = row['contract'];
            game.rank = row['game_rank'];
            game.trump = row['trump'];
            holeCards0 = row['holecards0'];
            holeCards1 = row['holecards1'];
            partnerDef = row['partner_def'];
        }
    });
    myDB.all(q1, [tableId, gameNum], (err, rows) => {
        if (err) {
            console.log(err.message);
        } else {
            readPlayerInfo(rows);
        }
    });
    myDB.all(q2, [tableId, gameNum], (err, rows) => {
        if (err) {
            console.log(err.message);
        } else {
            readRounds(rows);
        }
    });
});

myDB.close();

function readPlayerInfo(rows) {
    if(rows == null || rows.length < 1) return;
    //console.log('game_player rows: ' + rows.length);
    table = new Table({});
    table.id = tableId;
    
    var contractor;
    var cards;
    for(var x=0,row,player; row = rows[x]; x++) {
        player = new Player({name: 'seat' + row['seat']});
        table.players[x] = player;
        table.setPlayerMatchInfo(player);
        player.matchInfo.currentRank = row['rank'];
        cards = Card.stringToArray(convertCardsRecord(row['cards']));
        cards.forEach(function(c){player.addCard(c)});
        if(row['is_declarer']) {
            contractor = player;
        }
    }
    
    game.players = table.players;
    table.game = game;
    table.games.push(game);
    game.contractor = contractor;
    
    console.log('--------------------------------------------------------------------------');
    console.log('players: ' + table.playerNames()); 
    console.log('contractor: ' + game.contractor.name);
    console.log('partner def: ' + partnerDef);
    
    cards = Card.stringToArray(convertCardsRecord(holeCards0));
    cards.forEach(function(c){contractor.addCard(c)});
    
    cards = Card.stringToArray(convertCardsRecord(holeCards1));
    cards.forEach(function(c){contractor.removeCard(c)});
    
    table.players.forEach(function(p) {
        p.resortCards(game.trump, game.rank);
        console.log(p.name + ': ' + p.showHand());
    });
    
    game.setPartnerDef(partnerDef);
}

function readRounds(rows) {
    if(rows == null || rows.length < 1) return;
    console.log('============================================================');
    console.log('rounds: ' + rows.length);
    
    game.currentRound = null;
    game.leadingPlayer = game.contractor;
    game.rounds = [];
    game.startNewRound();

    var leadingSeat, recs;
    for(var x=0,row,cardsRec,n=toRound ? toRound : rows.length; x<n && (row = rows[x]); x++) {
        cardsRec = row['play_rec'];
        //console.log(cardsRec + ' => ' + convertCardsRecord(cardsRec));
        leadingSeat = row['lead_seat'];
        console.log((x+1) + ' seat' + leadingSeat);
        recs = convertCardsRecord(cardsRec).split(';');
        for(var seat = leadingSeat,i=0,rec; i<6 && (rec=recs[i]); seat++,i++) {
            if(seat > 6) seat = 1;
            game.players[seat-1].playCards(rec);
        }
    }

    console.log('####################################################################');
    table.players.forEach(function(p) {
        console.log(p.name + ': ' + p.showHand());
    });
    
    console.log('>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>');
    pIndex = table.players.indexOf(game.leadingPlayer);
    for(var x=0; x<6; x++,pIndex++) {
        if(pIndex >= 6) pIndex = 0;
        game.players[pIndex].playCards();
    }
}

function convertCardsRecord(cardsRec) {
    return cardsRec.replace('V ','')
          .replace(/A/g,'14')
          .replace(/K/g,'13')
          .replace(/Q/g,'12')
          .replace(/J/g,'11')
          .replace(/\u2660/g,',S')
          .replace(/\u2663/g,',C')
          .replace(/\u2665/g,',H')
          .replace(/\u2666/g,',D')
          .replace(/\u2657/g,',V97')
          .replace(/\u265b/g,',V98');
}
