'use strict';

const webdriver = require('selenium-webdriver');
const wdBy = webdriver.By;


function userLoginAction(login, passwd) {
    return function(driver, crawler_user) {
        driver.get('http://localhost:8000/pyforum/default/login');
        driver.findElement(wdBy.id('auth_alias')).sendKeys(login);
        driver.findElement(wdBy.id('passwd')).sendKeys(passwd);
        driver.findElement(wdBy.id('login_b')).click();
    };
}


function userLogoutAction(driver) {
    driver.get('http://localhost:8000/pyforum/default/logout');
}


module.exports = {
    homePageUrl: 'http://localhost:8000/pyforum/default/index',
    urlWhiteList: [ // Array of regexp parameters
        {
            source: '^http:\/\/localhost:8000\/pyforum.*$',
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
