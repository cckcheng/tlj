const fs = require('fs');

var curLogFile = "";
var writerStream;

function getCurrentLogName() {
    var dt = new Date();
    dt.setDate(dt.getDate() - dt.getDay());
    var m = dt.getMonth() + 1;
    var d = dt.getDate();
    return 'log' + dt.getFullYear() + (m<10 ? '0' : '') + m + (d<10 ? '0' : '') + d + '.txt';
}

module.exports = {
    log: function(str) {
        var newLogFile = getCurrentLogName();
        if(writerStream) {
            if(newLogFile !== curLogFile) {
                writerStream.end();
                
                writerStream = fs.createWriteStream(newLogFile, {
                    flags: 'a'
                });
                curLogFile = newLogFile;
            }
        } else {
            writerStream = fs.createWriteStream(newLogFile, {
                flags: 'a'
            });
            curLogFile = newLogFile;
        }
        
        writerStream.write(str);
    },
    
    close: function() {
        if(writerStream) {
            writerStream.end();
            writerStream = null;
        }
    }
};