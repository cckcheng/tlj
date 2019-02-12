var http = require('http');
var fs = require('fs');

fs.readFile('TLJHelp.html', function(err, data) {
  http.createServer(function (req, res) {
    res.writeHead(200, {'Content-Type': 'text/html'});
    res.write(data);
    res.end();
  }).listen(8088);
});



