// This file contains various utils for testing crawler
// 
// Execution context: slimerjs

// ====================================================================================================================
var fs = require('fs');

// ====================================================================================================================
module.exports.testCrawlerLogSystem = function testCrawlerLogSystem (){
    logger.debug('You must see 3 special logging messages below, if not => there is problems with logging system');
    logger.debug('1) message from slimerjs context');
    var page = webpage.create();
    page.open('http://slimerjs.org', function (status) {
        logger.debug('2) message from slimerjs context inside handler of processing webpage');
        page.onConsoleMessage = function (msg, line, file, level, functionName, timestamp) {
            logger.debug('3) handling console message from browser webpage context "' + msg + '"');
        };
        page.evaluate(function () {
            console.log('message from inside');
        });
        page.close();
    });
};

// ====================================================================================================================
module.exports.openTestPage = function openTestPage(page) {
    return new Promise(function(resolve, reject) {
        page.open('file://' + fs.workingDirectory + '/test/test_resources/test_dom.html', function(status) {
            if (status === 'success') {
                resolve(status);
            } else {
                reject(status);
            }
        });
    });
};

// ====================================================================================================================
