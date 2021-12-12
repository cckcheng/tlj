var express = require('express');
var http = require('http');
var bodyParser = require('body-parser');
var fs = require('fs');
//var helmet = require('helmet');
var rateLimit = require("express-rate-limit");

//var path = '/home/ccheng/tlj/';
var str = "是中国现代作家金庸创作的一部长篇武侠小说，1967年开始创作并连载于《明报》，1969年完成。这部小说通过叙述华山派大弟子令狐冲的江湖经历，反映了武林各派争霸夺权的历程。作品没有设置时代背景，“类似的情景可以发生在任何朝代”，折射出中国人独特的政治斗争状态，同时也表露出对斗争的哀叹，具有一定的政治寓意。小说情节跌宕起伏，波谲云诡，人物形象个性鲜明，生动可感";
var mxNum = 5;

var app = express();
var server = http.createServer(app);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(bodyParser.urlencoded({extended: false}));
//app.use(express.static(path.join(__dirname,'./public')));
//app.use(helmet());
app.use(limiter);

var inForm = '<form action="/docount" method="POST" id="inputform">'
    + '<fieldset>'
    + '<h3>Chinese Character Counter</h3>'
    + '<label>Input Paragraph</label><br>'
    + '<textarea id="intxt" name="intxt" rows="20" cols="150"></textarea>'
    + '<br><br>'
    + '<button type="submit">Submit</button>'
    + '</fieldset>'
    + '</form>';

app.get('/count', function(req, res) {
//    res.send(toHtml(inForm));
    res.send(inForm);
});

app.post('/docount', function(req, res) {
    //res.send('good');
    res.send(count(req.body.intxt, mxNum));
});

server.listen(9000, function() {
    console.log('Server listening on port: ' + 9000);
});

function toHtml(str) {
    var html = '<html><head><meta content="text/html; charset=UTF-8" http-equiv="content-type"></head>';
    html += '<body>';
    html += '<p>' + str + '</p>';
    html += '</body></html>';
    return html;
}

function count(txt, maxNum) {
    var mp = {};
    var pureChars = txt.split("").filter(ch => /\p{Script=Han}/u.test(ch));
    
    pureChars.forEach(function(c) {
        var num = 1;
        if(mp[c] > 0) {
            num += mp[c];
        }
        mp[c] = num;
    });
    
    var numArr = Object.values(mp);
    numArr.sort();
    numArr.reverse();
    
    var res = '';
    var total = 0;
    i = 0;
    var prev = 0;
    while(maxNum > 0 && i < numArr.length) {
        var num = numArr[i++];
        if(num === prev) continue;
        prev = num;
        var mch = findMatch(mp, num);
console.log('===' + mch);
        res += mch + ': ' + num + '<br>';
        maxNum -= mch.length;
    }
   
    return res;
}

function findMatch(mp, num) {
    var res = '';
//console.log('---' + num);
    for(k in mp) {
        if(mp[k] === num) {
            res += k;
        }
    }
    
    return res;
}
