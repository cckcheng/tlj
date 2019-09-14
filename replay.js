var sqlite3 = require('sqlite3').verbose();

var Config = require('./conf');
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

console.log('table_id: ' + tableId);
console.log('game#: ' + gameNum);

//var myDB = new sqlite3.Database(Config.MAIN_DB);
var myDB = new sqlite3.Database('../tljdb/tlj.db');

var q1 = "select * from game_player where table_id=? and game=? order by seat";
var q2 = "select * from rounds where table_id=? and game=? order by rowid";

var table,game;

myDB.serialize(() => {
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
    console.log('game_player rows: ' + rows.length);
    table = new Table({});
    table.id = tableId;
    
    game = new Game(null, 4);
    var contractor;
    for(var x=0,row,player; row = rows[x]; x++) {
        player = new Player({name: 'seat' + row['seat']});
        table.players[x] = player;
        table.setPlayerMatchInfo(player);
        player.matchInfo.currentRank = row['rank'];
        if(row['is_declarer']) contractor = player;
    }
    
    game.players = table.players;
    table.game = game;
    table.games.push(game);
    game.contractor = contractor;
}

function readRounds(rows) {
    console.log('rounds: ' + rows.length);
    console.log('table id: ' + table.id);
    console.log('players: ' + table.playerNames()); 
    console.log('contractor: ' + game.contractor.name); 
}