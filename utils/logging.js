'use strict';

// ====================================================================================================================
// Includes & Setup

const fs = require('fs');
const bunyan = require('bunyan');

// logging directory
if (!fs.existsSync('./_log')){
    fs.mkdirSync('./_log');
}

// ====================================================================================================================
// setting bunyan logger
// fatal, error, warn, info, debug, trace

module.exports = {
    crawlerLogger: function (logLevel) {
        return bunyan.createLogger({
            name: 'crawlerLogger',
            streams: [
                {
                    level: logLevel,
                    stream: process.stdout
                },
                {
                    level: logLevel,
                    path: './_log/crawlers.log'
                },
            ],
            serializers: bunyan.stdSerializers
        });
    },
    proxyLogger: function (logLevel) {
        return bunyan.createLogger({
            name: 'proxyLogger',
            streams: [
                {
                    level: logLevel,
                    stream: process.stdout
                },
                {
                    level: logLevel,
                    path: './_log/proxies.log'
                },
            ],
            serializers: bunyan.stdSerializers
        });
    }
};

// ====================================================================================================================
// Alternative logger - winston
// { emerg: 0, alert: 1, crit: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7 }
