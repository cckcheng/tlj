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
    }
};
