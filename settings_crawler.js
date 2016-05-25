// Settings for each crawler instance

function userLoginAction(login, passwd) {
    return function(page) {
        return new Promise(function(res, rej) {
            try {
                page.open('http://127.0.0.1:8000/pyforum/default/login', function(status) {

                    page.onConsoleMessage = function (msg, line, file, level, functionName, timestamp) {
                        console.log ('--> [Browser "' + '" console] Script error. file: ' + file + ' line: ' + line + ' message: ' + msg);
                    };
                    page.onError = function(message, stack) {
                        console.log ('--> [Browser "' + '" console] Browser error. stack: ' + stack + ' message: ' + message);
                    };

                    console.log('FUCK');

                    if (status === 'success') {
                        
                        console.log('FUCK2');

                        page.evaluate(function(login, passwd) {
                            
                            // asdfasdf;

                            console.error('test\n');
                            alert('fucking shit');
                            
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
                console.log(status);
                // console.log(page.content);
                var ret = page.evaluate(function() {
                    console.log('inside');
                    // var content = document.getElementsByTagName("body")[0].innerHTML;
                    // console.log('content ' + content);
                    // document.querySelectorAll('[title=Logout]')[0].click();
                    return 'hifi';
                });
                console.log(ret);
                resolve(status);
            } else {
                reject(status);
            }
        });
    });
}


module.exports = {
    url_start: 'http://127.0.0.1:8000/pyforum/default/index',
    url_whitelist: ['http://127.0.0.1:8000/pyforum/.*'],
    url_blacklist: [],

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

    logLevel: 'info'
};
