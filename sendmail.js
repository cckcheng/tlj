
var nodemailer = require('nodemailer');
var Config = require('./conf');
var Mylog = require('./mylog');

var invitation = {
    subject: {
        en: 'Invitation from {0}',
        zh: '来自{0}的邀请'
    },
    content: {
        en: 'Your friend {0} is playing a very interesting game: Langley Tuolaji. You can install the App via following URL:\n',
        zh: '您的朋友{0}正在玩一款好玩的游戏：兰里拖拉机，快下载安装吧：\n'
    }
};

function send(mailto, subject, content) {
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: Config.GMAIL_AUTH
    });

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

module.exports = {
    sendReferal: function(mailto, lang, referBy) {
        if(lang !== 'zh') lang = 'en';
        var content = invitation.content[lang].format(referBy);
        if(lang === 'zh') {
            content += '\n安卓: ' + Config.APP_URL.android;
            content += '\n\n苹果: ' + Config.APP_URL.ios;
        } else {
            content += '\nAndroid: ' + Config.APP_URL.android;
            content += '\n\nIOS: ' + Config.APP_URL.ios;
        }
        
        var subject = invitation.subject[lang].format(referBy);
        send(mailto, subject, content);
    },
    
    sendVerifyCode: function(mailto, lang, code, expireInMinutes) {
        if(lang !== 'zh') {
            lang = 'en';
        }
        
        var subject = Config.REGISTRATION_EMAIL.subject[lang];
        var content = Config.REGISTRATION_EMAIL.text[lang].format(code, expireInMinutes);
        if(lang === 'en') {
            subject += ' (' + Config.REGISTRATION_EMAIL.subject['zh'] + ')';   
            content += '\n\n' + Config.REGISTRATION_EMAIL.text['zh'].format(code, expireInMinutes);
        }
        
        send(mailto, subject, content);
    }
};
