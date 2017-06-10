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
    // homePageUrl: 'file:///home/avasilenko/Desktop/jaxsnoop/test/_resources/crawler/mini-webapp/index1.html',
    urlWhiteList: [ // Array of regexp parameters
        {
            source: '^http:\/\/localhost:8001\/pyforum.*$',
            flags: 'i'
        }, {
            source: '^file:\/\/.*$',
            flags: 'i'
        }
        // , {
        //     source: '^.*$', // Allow all
        //     flags: 'i'
        // }
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
        },
        // admin1: {
        //     login: userLoginAction('admin1@bot.ru', 'admin1'),
        //     logout: userLogoutAction
        // }
    },

    usersWepAppStateCrawler_settings: {
        depthStep: 1,
        stepsNum: 2
    },

    webAppStateCrawler_settings: {
        followTheTrace: 2,
        maxDepth: 1 * 3
    }

};

module.exports.urlWhiteListCompiled = module.exports.urlWhiteList.map(val => new RegExp(val.source, val.flags));
module.exports.urlBlackListCompiled = module.exports.urlBlackList.map(val => new RegExp(val.source, val.flags));
