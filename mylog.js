const fs = require('fs');
const Config = require('./conf');

var curLogFile = "";
var writerStream;

function getCurrentLogName() {
    var dt = new Date();
    dt.setDate(dt.getDate() - dt.getDay());
    var m = dt.getMonth() + 1;
    var d = dt.getDate();
    return 'log' + dt.getFullYear() + (m<10 ? '0' : '') + m + (d<10 ? '0' : '') + d + '.txt';
}

function createWriter(fileName) {
    if(!fs.existsSync(Config.LOG_PATH)) {
        fs.mkdirSync(Config.LOG_PATH);
    }
    writerStream = fs.createWriteStream(Config.LOG_PATH + fileName, {
        flags: 'a'
    });
    curLogFile = fileName;
}

module.exports = {
    log: function(str) {
        var newLogFile = getCurrentLogName();
        if(writerStream) {
            if(newLogFile !== curLogFile) {
                writerStream.end();
                createWriter(newLogFile);
            }
        } else {
            createWriter(newLogFile);
        }
        
        writerStream.write(str + '\n');
    },
    
    close: function() {
        if(writerStream) {
            writerStream.end();
            writerStream = null;
        }
    }
};