module.exports = Group;

var Config = require('./conf');
var Mylog = require('./mylog');
var Player = require('./player');

function Group(o) {
    for(k in o) {
        this[k] = o[k];
    }
    
    this.brief = function(lang) {
        var s = this.group_name;
        if(this.start_time != null) s += ', ' + this.start_time;
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
    groups.forEach((g) => {
        if(g.status === status) ng.push(g);
    });
    
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
    ng.forEach((g) => {
        if(json[k].length>0) json[k] += ',';
        tk = 'PG' + g.id;
        json[k] += tk;
        json[tk] = g.brief(player.lang);
    });
}