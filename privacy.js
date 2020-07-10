var fs = require('fs');
module.exports = {
    pushPrivacy: function(player) {
        var fName = player.lang === 'zh' ? 'privacy_zh.txt' : 'privacy_en.txt';
        fs.readFile(fName, function(err, data) {
            if(err) {
                player.pushJson({action: 'ack'});
            } else {
                player.pushJson({action: 'priv', msg: data.toString()});
            }
        });
    },
    
    pushGuide: function(player, dt) {
        var fName = player.lang === 'zh' ? 'guide_zh.txt' : 'guide_en.txt';
        var title = player.lang === 'zh' ? '使用指南' : 'Guide';
        fs.readFile(fName, function(err, data) {
            if(err) {
                player.pushJson({action: 'ack'});
            } else {
                player.pushJson({action: dt.action, lang: dt.lang, type: dt.type,
                                title: title, content: data.toString()});
            }
        });
    }
};
