/*
var s = '{"a":1,"b":2}';

var obj = JSON.parse(s);

console.log('a: ' + obj.a);

var myObj = {};
myObj.m1 = 'v1';
myObj.m2 = 123;

var arr = [myObj, myObj];
console.log('JSON String: ' + JSON.stringify(myObj));
console.log('JSON String: arr' + JSON.stringify(arr));
*/

function MyServer() {
    this.Core = require('./core');
    this.players = [];
}
var myServer = new MyServer();

console.log(myServer.Core.test(myServer));