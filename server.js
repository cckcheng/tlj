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

if (args.length > 0) {
    var arg = args.shift();
    if (arg.substr(0, 1) === '-') {
        if (/[Dd]/.test(arg)) Table.Debugging = true;
        if (/[Ff]/.test(arg)) Table.FastMode = true;
        arg = args.shift();
    }

    if (arg != null) {
        HOST = arg;
        arg = args.shift();
        if (arg != null) PORT = arg;
    }
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
        table.dismiss(activePlayers, player.id);
//        runningTables.splice(runningTables.indexOf(table), 1);
//        if (player.id != null) {
//            delete activePlayers[player.id];
//        }
    }
}

function handleData(sock, data) {
    data = data.toString();
    if (data.length < 2)
        return;

    if (data.charAt(0) !== '{') {
        data = Buffer.from(Player.confusedData(data), 'base64').toString();
    }

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
//        console.log('exist user');
        player = onlinePlayers[sockId];
    }
    player.timeoutTimes = 0;

    var currentTable = player.currentTable;
    switch (dt.action) {
        case 'join_table':
            if (currentTable != null) {
                console.log('exist table.');
                player.pushData();
                currentTable.resume(player);
            } else {
                var robot = null;
                while (robots.length > 0) {
                    robot = robots.shift();
                    if (!(robot.currentTable == null)) break;
                }

                if (robot == null || robot.currentTable == null) {
                    createNewTable(player);
                } else {
                    console.log('replace robot.');
                    robot.replaceRobot(player.id, player.sock);
                    onlinePlayers[sockId] = activePlayers[player.id] = player = robot;
                    player.pushData();
                    player.currentTable.resume();
                }
            }
            break;

        default:
            if (currentTable == null) return;
            currentTable.processPlayerAction(player, dt);
            break;
    }

    function createNewTable(player) {
        runningTables.forEach((t, idx, obj) => {
            if (t.dismissed)
                obj.splice(idx, 1);
        });

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
