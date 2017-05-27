'use strict';

module.exports = {
    webAppName: 'pyforum',
    logLevel: 'fatal', // One of 'trace', 'debug', 'info', 'warn', 'error', 'fatal'


    homePageUrl: 'none.com',
    urlWhiteList: [{
            source: '^.*$', // Allow all
            flags: 'i'
        }
    ],
    urlBlackList: [ // Array of regexp parameters
    ],

    users: {
        public: {
            login: () => {},
            logout: () => {}
        }
    }
};
