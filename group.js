module.exports = Group;

var Config = require('./conf');
var Mylog = require('./mylog');
var Table = require('./table');

function Group(o, mainServer) {
    for(k in o) {
        this[k] = o[k];
    }
    mainServer.myDB.getPlayerNames(this);
    if(this.start_time != null) {
        var dt = new Date(this.start_time + ' UTC');
        this.startTime = dt;
    }
    
    this.brief = function(lang) {
        var s = this.group_name;
        if(this.table) {
            if(this.table.dismissed) {
                if(this.status === Group.STATUS.OPEN || this.status === Group.STATUS.RUNNING) {
                    this.status === Group.STATUS.FINISHED;
                    mainServer.myDB.updateRecord('tour_group', 'id', this.id, {table_id: this.table.id, status: Group.STATUS.FINISHED});
                }
                s += ", finished";
            } else {
                s += ", " + Table.Messages.GameNumber[lang].format(this.table.games.length);
            }
        } else if(this.status === Group.STATUS.OPEN) {
            if(this.startTime != null) {
                //s += ": " + Object.values(this.players);
                s += " " + showTimeString(this.startTime);
            }
        } else {
            s += ", finished";
        }
        return s;
    };
}

Group.STATUS = {
    NEW: 1,
    OPEN: 2,
    RUNNING: 3,
    FINISHED: 4,
    CLOSED: 5
};

Group.sort = function(groups) {
    groups.sort(function (a, b) {
        if(a.start_time != null && b.start_time != null) return a.start_time - b.start_time;
        if(a.start_time != null) return -1;
        if(b.start_time != null) return 1;
        return a.id - b.id;
    });
};

Group.filterByStatus = function(groups, status) {
    var ng = [];
    for(k in groups) {
        if(groups[k].status === status) ng.push(groups[k]);
    }

    Group.sort(ng);
    return ng;
};

Group.listGroups = function(player, json, category, groups) {
    if(groups.length < 1) return;
    listByStatus(player, json, category, groups, Group.STATUS.RUNNING);
    listByStatus(player, json, category, groups, Group.STATUS.OPEN);
    listByStatus(player, json, category, groups, Group.STATUS.FINISHED);
};

function listByStatus(player, json, k, groups, status) {
    var ng = Group.filterByStatus(groups, status);
    if(ng.length < 1) return;
    if(json[k] == null) json[k] = '';
    ng.forEach((g) => {
        if(json[k].length>0) json[k] += ',';
        tk = 'PG' + g.id;
        json[k] += tk;
        json[tk] = g.brief(player.lang);
    });
}

function showTimeString(dt) {
    return dt.toLocaleString('en-CA', {timeZoneName: "short", hour12: false});
}

function sendFinishedGroupInfo(player, group, msg) {
    var json = {action: 'msg', lang: player.lang};
    json.title = group.group_name;
    json.content = Object.values(group.players);
    json.content += '\n' + msg;
    player.pushJson(json);
}

Group.proceedGroup = function(player, gid) {
    var mServer = player.mainServer;
    if(mServer.groups == null) return;
    var group = mServer.groups[gid];
    if(group == null) return;

    switch(group.status) {
        case Group.STATUS.FINISHED:
        case Group.STATUS.CLOSED:
            sendFinishedGroupInfo(player, group, 'finished');
            return;
    }
    
    if(group.table) {
        var table = group.table;
        if(table.dismissed) {
            sendFinishedGroupInfo(player, group, table.matchSummaryLang ? table.matchSummaryLang[player.lang] : 'aborted');
            return;
        }
        if(group.players[player.property.account_id]) {
            if(table.resumeReturnPlayer(player)) return;  // possible same user switch device

            if(!player.checkBalance(table.coins)) return;
            if(!table.canJoin(player)) {
                player.sendMessage(player.alertMessage);
            }
        } else {
            Table.watchTable(player, '' + group.table.id);
        }

        return;
    }
    
    var s0 = (new Date()).getTime()/1000;
    var s1 = group.startTime.getTime()/1000;
    var delta = Math.round(s1 - s0);
    if(delta < -30 * 60) {
        sendFinishedGroupInfo(player, group, 'canceled');
        return;
    }
    if(delta < 15 * 60 && group.players[player.property.account_id]) {
        if(delta < 0) delta = 0;
        var table = Table.createTable(player, 'INTERMEDIATE', {
            tableType: 'FULL', allowJoin: false, showMinBid: false, option: 'B10'
        });
        group.table = table;
        group.status = Group.STATUS.RUNNING;
        table.group_id = group.id;
        Table.delayStart(table, delta, player);
        return;
    }

    var json = {action: 'msg', lang: player.lang};
    json.title = group.group_name;
    json.content = Object.values(group.players);
    json.content += '\n' + showTimeString(group.startTime);

    //Mylog.log(JSON.stringify(json));
    player.pushJson(json);
};
