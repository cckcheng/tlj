var net = require('net');
var Player = require('./player');
var Table = require('./table');

const MAX_TABLES = 10;
var args = process.argv.slice(2);

//var PORT = 8001;
var PORT = 6688;
//var HOST = '192.168.1.8';
var HOST = '172.16.107.204';
//var HOST = '127.0.0.1';   // this does not work
//var HOST = 'tlj.webhop.me';   // this does not work

if(args.length >0) {
    HOST = args[0];
}
if(args.length>1) {
    PORT = args[1];
}

var server = net.createServer();
server.listen(PORT, HOST);

var onlinePlayers = {}; // sockID <-> player
var activePlayers = {}; // playerId <-> player
var runningTables = [];
var robots = [];

server.on('connection', function (sock) {
    console.log('Connected: ' + sock.remoteAddress + ':' + sock.remotePort);
    sock.on('data', function (data) {
        handleData(sock, data);
    });
    sock.on('close', function (hadError) {
        handleClose(sock, hadError);
    });
    sock.on('error', function (err) {
        console.log('Error: ' + sock.remoteAddress + ':' + sock.remotePort + '; ' + err);
    });
});

function handleClose(sock, hadError) {
    console.log('Closed, ' + sock.remoteAddress + ':' + sock.remotePort + '; hadError->' + hadError);
    var sockId = sock.remoteAddress + ':' + sock.remotePort;
    var player = onlinePlayers[sockId];
    if (player == null) return;
    delete onlinePlayers[sockId];

    var table = player.currentTable;
    if (table == null) {
        if (player.id != null) {
            delete activePlayers[player.id];
        }
        return;
    }

    player.toRobot();
    if (table.allRobots()) {
        for (var x = 0, p, idx; x < table.players.length; x++) {
            p = table.players[x];
            if (p == null) continue;
            p.currentTable = null;
            if (p.id != null) {
                delete activePlayers[p.id];
            } else {
                idx = robots.indexOf(p);
                if (idx >= 0) robots.splice(idx, 1);
            }
        }
        runningTables.splice(runningTables.indexOf(table), 1);
    }
}

function handleData(sock, data) {

    console.log(sock.remoteAddress + ':' + data);
//    sock.write('reveived\n');
    try {
        var dt = JSON.parse(data);
    } catch (err) {
        console.log('Invalid data: ' + err);
        return;
    }

    var sockId = sock.remoteAddress + ':' + sock.remotePort;

    var player = null;
    if (onlinePlayers[sockId] == null) {
        if (dt.id == null) {
            console.log('missing player id!');
            return;
        }

        player = activePlayers[dt.id];
        if (player == null) {
            player = new Player({id: dt.id, sock: sock});
            activePlayers[dt.id] = player;
        } else {
            player.sock = sock;
        }
        onlinePlayers[sockId] = player;
    } else {
        console.log('exist user');
        player = onlinePlayers[sockId];
    }

    switch (dt.action) {
        case 'join_table':
            if (player.currentTable != null) {
                console.log('exist table.');
                player.pushData();
            } else {
                if (robots.length < 1) {
                    createNewTable(player);
                } else {
                    console.log('replace robot.');
                    var robot = robots.shift();
                    robot.replaceRobot(player.id, sock);
                    onlinePlayers[sockId] = activePlayers[player.id] = player = robot;
                    player.pushData();
                }
            }
            break;
    }

    function createNewTable(player) {
        if (runningTables.length >= MAX_TABLES) {
            player.sendMessage("No table available. Please wait...");
            return;
        }
        var table = new Table({});
        runningTables.push(table);
        table.addPlayer(player);

        var robot;
        for (var x = 0; x < 5; x++) {
            robot = new Player();
            robots.push(robot);
            table.addPlayer(robot);
        }
        table.startGame();

        console.log('table created, total tables: ' + runningTables.length);
    }
}
