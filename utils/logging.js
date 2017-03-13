'use strict';

// ====================================================================================================================
// Includes & Setup

const fs = require('fs');
const bunyan = require('bunyan');

// logging directory
if (!fs.existsSync('./log')){
    fs.mkdirSync('./log');
}

// ====================================================================================================================
// setting bunyan logger
// fatal, error, warn, info, debug, trace

module.exports = {
    ctrlLogger: function (logLevel) {
        return bunyan.createLogger({
            name: 'ctrlLogger',
            streams: [
                {
                    level: logLevel,
                    stream: process.stdout
                },
                {
                    level: logLevel,
                    path: './log/ctrl.log'
                },
            ],
            serializers: bunyan.stdSerializers
        });
    },
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
                    path: './log/crawlers.log'
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
                    path: './log/proxies.log'
                },
            ],
            serializers: bunyan.stdSerializers
        });
    }
};

// ====================================================================================================================
// Alternative logger - winston
// { emerg: 0, alert: 1, crit: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7 }