
var nodemailer = require('nodemailer');
var Config = require('./conf');
var Mylog = require('./mylog');

module.exports = {
    sendVerifyCode: function(mailto, lang, code, expireInMinutes) {
        var transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: Config.GMAIL_AUTH
        });
        if(lang !== 'zh') {
            lang = 'en';
        }
        
        var subject = Config.REGISTRATION_EMAIL.subject[lang];
        var content = Config.REGISTRATION_EMAIL.text[lang].format(code, expireInMinutes);
        if(lang === 'en') {
            subject += ' (' + Config.REGISTRATION_EMAIL.subject['zh'] + ')';   
            content += '\n\n' + Config.REGISTRATION_EMAIL.text['zh'].format(code, expireInMinutes);
        }
        var mailOptions = {
            from: Config.GMAIL_AUTH.user,
            to: mailto,
            subject: subject,
            text: content
        };
        
        transporter.sendMail(mailOptions, function(err, info){
            if (err) {
                Mylog.log('Email FAIL: ' + err.message);
            } else {
                Mylog.log('Email Sent: ' + mainto + '; ' + info.response);
            }
        });
    }
};
