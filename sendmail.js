module.exports = SendMail;

var nodemailer = require('nodemailer');
var Config = require('./conf');
var Mylog = require('./mylog');

function SendMail() {
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: Config.GMAIL_AUTH
    });
    
    this.sendVerifyCode = function(mailto, lang, code) {
        if(lang !== 'zh') {
            lang = 'en';
        }
        var mailOptions = {
            from: Config.GMAIL_AUTH.user,
            to: mailto,
            subject: Config.REGISTRATION_EMAIL.subject[lang],
            text: Config.REGISTRATION_EMAIL.text[lang].format(code, Config.AUTHCODE_EXPIRE_MINUTE)
        };
        
        transporter.sendMail(mailOptions, function(err, info){
            if (err) {
                Mylog.log('Email FAIL: ' + err.message);
            } else {
                Mylog.log('Email Sent: ' + mainto + '; ' + info.response);
            }
        });
    };
}
