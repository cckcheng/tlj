var http = require('http');
var fs = require('fs');

var path = '/home/ccheng/tlj/';
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  var htmlFile = null;
  switch(req.url) {
      case '/help':
          htmlFile = 'TLJHelp.html';
          break;
      case '/privacy':
          htmlFile = 'Privacypolicy.html';
          break;
  }
  
  if(htmlFile !== null) {
        fs.readFile(path + htmlFile, function(err, data) {
            res.write(data);
            res.end();
        });
  } else {
      res.write("Invalid URL");
      res.end();
  }
}).listen(8088);
