'use strict';

const webdriver = require('selenium-webdriver');
const wdBy = webdriver.By;
const wdUntil = webdriver.until;


function userLoginAction(login, passwd) {
    return function(driver) {
        return driver.get('http://localhost:8001/pyforum/default/login')
        .then(() => {
            driver.findElement({id: 'auth_alias'}).sendKeys(login);
            driver.findElement({id: 'passwd'}).sendKeys(passwd);
            driver.findElement({id: 'login_b'}).click();
        });
    };
}

function userLogoutAction(driver) {
    return driver.get('http://localhost:8001/pyforum/default/logout');
}


module.exports = {
    webAppName: 'pyforum',
    logLevel: 'trace', // One of 'trace', 'debug', 'info', 'warn', 'error', 'fatal'


    homePageUrl: 'http://localhost:8001/pyforum/default/index',
    urlWhiteList: [ // Array of regexp parameters
        {
            source: '^http:\/\/localhost:8001\/pyforum.*$',
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
        //     login: () => {},
        //     logout: () => {}
        // },
        bot1: {
            login: userLoginAction('bot1@bot.ru', 'bot1'),
            logout: userLogoutAction
        }//,
        // admin1: {
        //     login: userLoginAction('admin1@bot.ru', 'admin1'),
        //     logout: userLogoutAction
        // }
    }
};
