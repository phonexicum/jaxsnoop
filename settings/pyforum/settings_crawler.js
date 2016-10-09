// Settings for crawler instances
// 
// Execution context: nodejs and slimerjs

var globalNavigationRedirections = 0;

function userLoginAction(login, passwd) {
    return function(page, crawler_user) {
        return new Promise(function(res, rej) {
            try {
                page.open('http://127.0.0.1:8000/pyforum/default/login', function(status) {
                    if (status === 'success') {
                        page.evaluate(function(login, passwd) {

                            console.log('login prompt');

                            document.getElementById('auth_alias').value = login;
                            document.getElementById('passwd').value = passwd;
                            document.getElementById('login_b').click();
                        }, login, passwd);

                        console.log('fuck');

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
    url_start: 'http://127.0.0.1:8000/pyforum/default/index',
    url_whitelist: [/^http:\/\/127.0.0.1:8000\/pyforum\/.*/],
    url_blacklist: [],
    maxWaitForFullPageLoadTime: 5000,

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
            login_function: userLoginAction('bot1@bot.ru', 'bot1'),
            logout_function: userLogoutAction
        }
    },

    loglevel: 'trace'
};
