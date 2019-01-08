var net = require('net');
var Player = require('./player');
var Table = require('./table');

var args = process.argv.slice(2);

//var PORT = 8001;
var PORT = 6688;
//var HOST = '192.168.1.8';
//var HOST = '172.16.107.204';
//var HOST = '127.0.0.1';
var HOST = 'tlj.webhop.me';

if(args.length >0) {
    HOST = args[0];
}
if(args.length>1) {
    PORT = args[1];
}


var server = net.createServer();
server.listen(PORT, HOST);

var onlinePlayers = {};
var pendingTables = [];

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

    var playerId = sock.remoteAddress + ':' + sock.remotePort;
    if (dt.id) {
        playerId = dt.id;
    }

    var player;
    if (onlinePlayers[playerId] === undefined) {
        player = onlinePlayers[playerId] = new Player({id: playerId, sock: sock});
    } else {
        console.log('exist user');
        player = onlinePlayers[playerId];
    }

    switch (dt.action) {
        case 'join_table':
            if (player.currentTable != null) {
                console.log('exist table: ' + player.currentTable);
                player.pushData();
            } else {
                if (pendingTables.length < 1) {
                    createNewTable(player);
                } else {
                    var joined = false;
                    for (var x = pendingTables.length - 1; x >= 0; x--) {
                        var table = pendingTables[x];
                        if (table.seatAvailable()) {
                            table.addPlayer(player);
                            joined = true;
                            if (!table.seatAvailable()) {
                                table.startGame();
                                pendingTables.splice(x, 1);
                            }
                            break;
                        }
                    }

                    if (!joined) {
                        createNewTable(player);
                    }
                }
            }
            break;
    }

    function createNewTable(player) {
        var table = new Table();
        pendingTables.push(table);
        table.addPlayer(player);

        // for testing
        table.addPlayer(new Player());
        table.addPlayer(new Player());
        table.addPlayer(new Player());
//        table.addPlayer(new Player());
//        table.addPlayer(new Player());
        table.startGame();
    }
}
