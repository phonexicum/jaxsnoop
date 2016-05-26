// lutils - local utils, used during development

// ====================================================================================================================
// ====================================================================================================================
// Includes
// ====================================================================================================================
var system = require('system');
var webpage = require('webpage');
var fs = require('fs');

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
function PatchedSlimerRequire (){

    function require2(arg){
        var module;
        try {
            module = require.require_original.apply(undefined, arguments);
            return module;
        } catch (err) {
            // It is expected that the error is something like:
            // ~/node_modules/spooky/node_modules/tiny-jsonrpc/lib/tiny-jsonrpc is not a supported type file
            try{
                var module_json_description = require(arg + "/package.json");
                module = require.require_original.apply(undefined, [arg + "/" + module_json_description.main]);
                return module;
            } catch (e) {
                throw err;
            }
        }
    }
    
    Object.assign(require2, require);
    require2.require_original = require;

    return require2;
}
module.exports.PatchedSlimerRequire = PatchedSlimerRequire;
// var require = PatchedSlimerRequire();

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
module.exports.colors = {
    red : (ss) => { return "\033[0;31m" + ss + "\033[0m"; },
    black : (ss) => { return "\033[0;30m" + ss + "\033[0m"; },
    green : (ss) => { return "\033[0;32m" + ss + "\033[0m"; },
    yellow : (ss) => { return "\033[0;33m" + ss + "\033[0m"; },
    blue : (ss) => { return "\033[0;34m" + ss + "\033[0m"; },
    purple : (ss) => { return "\033[0;35m" + ss + "\033[0m"; },
    cyan : (ss) => { return "\033[0;36m" + ss + "\033[0m"; },
    white : (ss) => { return "\033[0;37m" + ss + "\033[0m"; }
};

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
module.exports.crawlerLogger = function crawlerLogger(loggingHost, loggingPort, crawlerUser, logLevel) {
    var page = webpage.create();
    page.viewportSize = { width: 50, height: 25 };
    var logLevels = ['debug', 'info', 'warn', 'error'];

    this.debug = function(msg) {
        if (logLevels.indexOf(logLevel) <= 0) {
            var data = '[crdebug][Browser "' + crawlerUser + '"] ' + msg;
            console.log(data);

            // page.openUrl(loggingHost + ':' + loggingPort, {
            //     operation: 'POST',
            //     data: data,
            //     headers: []
            // }, null, function (status) {});
        }
    };

    this.info = function(msg) {
        if (logLevels.indexOf(logLevel) <= 1) {
            var data = '[crinfo][Browser "' + crawlerUser + '"] ' + msg;
            console.log(data);
            
            // page.openUrl(loggingHost + ':' + loggingPort, {
            //     operation: 'POST',
            //     data: data,
            //     headers: []
            // }, null, function () {});
        }
    };

    this.warn = function(msg) {
        if (logLevels.indexOf(logLevel) <= 2) {
            var data = '[crwarn]' + module.exports.colors.yellow('[Browser "' + crawlerUser + '"] ' + msg);
            console.log(data);
            
            // page.openUrl(loggingHost + ':' + loggingPort, {
            //     operation: 'POST',
            //     data: data,
            //     headers: []
            // }, null, function () {});
        }
    };

    this.error = function(msg) {
        if (logLevels.indexOf(logLevel) <= 3) {
            var data = '[crerror]' + module.exports.colors.red('[Browser "' + crawlerUser + '"] ' + msg);
            console.log(data);
            
            // page.openUrl(loggingHost + ':' + loggingPort, {
            //     operation: 'POST',
            //     data: data,
            //     headers: []
            // }, null, function () {});
        }
    };
};

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
