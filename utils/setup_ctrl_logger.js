// ====================================================================================================================
// ====================================================================================================================
// Includes
// ====================================================================================================================
const fs = require('fs');
const bunyan = require('bunyan');

// ====================================================================================================================
// ====================================================================================================================
// Setup logger
// ====================================================================================================================

// logger directory
if (!fs.existsSync('./log')){
    fs.mkdirSync('./log');
}

// ====================================================================================================================
// bunyan logger
// fatal, error, warn, info, debug, trace
module.exports.nodeLogger = function (console_log_level) {
    return bunyan.createLogger({
        name: 'nodeLogger',
        streams: [
            {
                level: console_log_level,
                stream: process.stdout
            },
            {
                level: 'error',
                path: './log/error.log'
            },
        ],
        serializers: bunyan.stdSerializers
        // src: true // not for production, it will slow down everything
    });
};

module.exports.crawlerLogger = function (console_log_level) {
    return bunyan.createLogger({
        name: 'crawlersLogger',
        streams: [
            {
                level: console_log_level,
                stream: process.stdout
            },
            {
                level: 'info',
                path: './log/crawlers.log'
            },
        ],
        serializers: bunyan.stdSerializers
    });
};

// ====================================================================================================================
// Alternative logger - winston
// { emerg: 0, alert: 1, crit: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7 }
