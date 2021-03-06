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
                    this.status = Group.STATUS.FINISHED;
                    this.summary = this.table.matchSummary();
                    mainServer.myDB.updateRecord('tour_group', 'id', this.id, {table_id: this.table.id, status: Group.STATUS.FINISHED});
                }
                s += ": " + showTimeString(this.startTime) + ", completed";
                this.table = null;
            } else {
                s += ", " + Table.Messages.GameNumber[lang].format(this.table.games.length);
            }
        } else if(this.status === Group.STATUS.OPEN) {
            if(this.startTime != null) {
                s += ": " + showTimeString(this.startTime);
                //s += "\n" + Object.values(this.players);
            } else {
                s += ", " + Object.values(this.players);
            }
        } else {
            s += ": " + showTimeString(this.startTime) + ", ended";
            //s += "\n" + Object.values(this.players);
        }
        return s;
    };
    
    this.toString = function() {
        var s = this.group_name + '|';
        if(this.startTime) s += this.startTime.getTime();
        s += '|';
        if(group.accIds) {
            s += group.accIds;
        } else if(group.players) {
            var pids = '';
            for(pid in group.players) pids += ',' + pid;
            if(pids.length > 0) pids = pids.substr(1);
            s += pids;
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
        if(a.startTime != null && b.startTime != null) return a.startTime > b.startTime ? 1 : -1;
        if(a.startTime != null) return -1;
        if(b.startTime != null) return 1;
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
    if(dt == null) return '';
    return dt.toLocaleString('en-CA', {timeZoneName: "short", hour12: false});
}

function sendFinishedGroupInfo(player, group, msg) {
    var json = {action: 'msg', lang: player.lang};
    json.title = group.group_name;
    json.content = Object.values(group.players);
    json.content += '\n' + showTimeString(group.startTime);
    json.content += '\n' + msg;
    player.pushJson(json);
}

Group.proceedGroup = function(player, gid) {
    var mServer = player.mainServer;
    if(mServer.groups == null) return;
    var group = mServer.groups[gid];
    if(group == null) return;

    if(group.table) {
        var table = group.table;
        if(table.dismissed) {
            sendFinishedGroupInfo(player, group, table.matchSummaryLang ? table.matchSummaryLang[player.lang].summary : 'aborted');
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
    
    switch(group.status) {
        case Group.STATUS.FINISHED:
        case Group.STATUS.CLOSED:
            sendFinishedGroupInfo(player, group, group.summary);
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
        startScheduledTable(player, delta, group, true);
        return;
    }

    var json = {action: 'msg', lang: player.lang};
    json.title = group.group_name;
    json.content = Object.values(group.players);
    json.content += '\n' + showTimeString(group.startTime);

    //Mylog.log(JSON.stringify(json));
    player.pushJson(json);
};

function startScheduledTable(player, delta, group, sendAlert) {
    if(!player.checkBalance(Table.CATEGORY.INTERMEDIATE.coins)) {
        if(sendAlert) player.sendMessage(Table.Messages.InsufficientBalance[player.lang]);
        return;
    }
    if(delta < 0) delta = 0;
    var table = Table.createTable(player, 'INTERMEDIATE', {
        tableType: Config.tableType, allowJoin: false, showMinBid: false, option: 'B10'
    });
    group.table = table;
    group.status = Group.STATUS.RUNNING;
    table.group_id = group.id;
    Table.delayStart(table, delta, player);
}

// allow automatic start/join scheduled game
Group.AutoJoin = function(player) {
    if(player.property.account_id == null) return;
    var mServer = player.mainServer;
    var groups = mServer.groups;
    if(groups == null) return;
    var s0 = (new Date()).getTime()/1000;
    for(k in groups) {
        var group = groups[k];
        if(group.players[player.property.account_id] == null) continue;
        switch(group.status) {
            case Group.STATUS.RUNNING:
                var table = group.table;
                if(table == null || table.dismissed) continue;
                if(table.resumeReturnPlayer(player)) return;  // possible same user switch device
                if(!player.checkBalance(table.coins)) return;
                if(!table.canJoin(player)) continue;
                break;

            case Group.STATUS.OPEN:
                var s1 = group.startTime.getTime()/1000;
                var delta = Math.round(s1 - s0);
                if(delta < -30 * 60) continue;

                if(delta < 15 * 60) {
                    startScheduledTable(player, delta, group, false);
                    return;
                }
                break;
        }
    }
};