'use strict';

function userLoginAction(login, passwd) {
    return function(page, crawler_user) {
        return new Promise(function(res, rej) {
            try {
                page.open('http://127.0.0.1:8000/pyforum/default/login', function(status) {
                    if (status === 'success') {
                        page.evaluate(function(login, passwd) {
                            document.getElementById('auth_alias').value = login;
                            document.getElementById('passwd').value = passwd;
                            document.getElementById('login_b').click();
                        }, login, passwd);
                        res(status);
                    } else {
                        rej(status);
                    }
                });

            } catch (err) {

                page.evaluate(function() {
                    console.log('Error logging in: ' + err);
                });
                rej('Error logging in: ' + err);
            }
        });
    };
}


function userLogoutAction(page) {
    return new Promise(function(resolve, reject) {
        page.open('http://127.0.0.1:8000/pyforum/default/index', function(status) {
            if (status === 'success') {
                page.evaluate(function() {
                    document.querySelectorAll('[title=Logout]')[0].click();
                });
                resolve(status);
            } else {
                reject(status);
            }
        });
    });
}


module.exports = {
    urlStartingPoint: 'http://127.0.0.1:8000/pyforum/default/index',
    urlWhiteList: [ // Array of regexp parameters
        {
            source: '^http:\/\/127.0.0.1:8000\/pyforum\/.*$',
            flags: 'i'
        }, {
            source: '^file:\/\/.*$',
            flags: 'i'
        }, {
            source: '^.*$', // Allow all
            flags: 'i'
        }
    ],
    urlBlackList: [ // Array of regexp parameters
    ],

    users: {
        // public: {
        //     login_function: function (page) {
        //         return new Promise(function(resolve, reject) {resolve('success');});
        //     },
        //     logout_function: function (page) {
        //         return new Promise(function(resolve, reject) {resolve('success');});
        //     }
        // },
        member_1: {
            login: userLoginAction('bot1@bot.ru', 'bot1'),
            logout: userLogoutAction
        }
    }
};
