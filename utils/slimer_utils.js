// lutils - local utils, used during development
// 
// Execution context: slimerjs

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
module.exports.crawlerLogger = function crawlerLogger(loggingHost, loggingPort, crawlerUser, logLevel) {
    var logLevels = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];

    var colors = {
        red : (ss) => { return "\033[0;31m" + ss + "\033[0m"; },
        black : (ss) => { return "\033[0;30m" + ss + "\033[0m"; },
        green : (ss) => { return "\033[0;32m" + ss + "\033[0m"; },
        yellow : (ss) => { return "\033[0;33m" + ss + "\033[0m"; },
        blue : (ss) => { return "\033[0;34m" + ss + "\033[0m"; },
        purple : (ss) => { return "\033[0;35m" + ss + "\033[0m"; },
        cyan : (ss) => { return "\033[0;36m" + ss + "\033[0m"; },
        white : (ss) => { return "\033[0;37m" + ss + "\033[0m"; }
    };

    this.trace = function(msg) {
        if (logLevels.indexOf(logLevel) <= logLevels.indexOf('trace')) {
            var data = '[crtrace]' + colors.white('[Browser "' + crawlerUser + '"] ' + msg);
            console.log(data);
        }
    };

    this.debug = function(msg) {
        if (logLevels.indexOf(logLevel) <= logLevels.indexOf('debug')) {
            var data = '[crdebug]' + colors.yellow('[Browser "' + crawlerUser + '"] ' + msg);
            console.log(data);

            // page.openUrl(loggingHost + ':' + loggingPort, {
            //     operation: 'POST',
            //     data: data,
            //     headers: []
            // }, null, function (status) {});
        }
    };

    this.info = function(msg) {
        if (logLevels.indexOf(logLevel) <= logLevels.indexOf('info')) {
            var data = '[crinfo]' + '[Browser "' + crawlerUser + '"] ' + msg;
            console.log(data);
            
            // page.openUrl(loggingHost + ':' + loggingPort, {
            //     operation: 'POST',
            //     data: data,
            //     headers: []
            // }, null, function () {});
        }
    };

    this.warn = function(msg) {
        if (logLevels.indexOf(logLevel) <= logLevels.indexOf('warn')) {
            var data = '[crwarn]' + colors.purple('[Browser "' + crawlerUser + '"] ' + msg);
            console.log(data);
            
            // page.openUrl(loggingHost + ':' + loggingPort, {
            //     operation: 'POST',
            //     data: data,
            //     headers: []
            // }, null, function () {});
        }
    };

    this.error = function(msg) {
        if (logLevels.indexOf(logLevel) <= logLevels.indexOf('error')) {
            var data = '[crerror]' + colors.red('[Browser "' + crawlerUser + '"] ' + msg);
            console.log(data);
            
            // page.openUrl(loggingHost + ':' + loggingPort, {
            //     operation: 'POST',
            //     data: data,
            //     headers: []
            // }, null, function () {});
        }
    };

    this.fatal = function(msg) {
        if (logLevels.indexOf(logLevel) <= logLevels.indexOf('fatal')) {
            var data = '[crfatal]' + colors.black('[Browser "' + crawlerUser + '"] ' + msg);
            console.log(data);
        }
    };
};

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
module.exports.crawlerDebugLogger = function crawlerDebugLogger(logfile) {

    this.log = function(msg) {
        fs.write(logfile, msg, "a");
    };

    var dump_counter = 0;
    this.dumpDOMmodel = function(domModel){
        fs.open(logfile + ".html." + dump_counter, "w");

        var stack = [domModel.domTreeModel];

        var node = stack[stack.length -1];
        while (true){
            var tag = "<" + node.tagName;
            for (var attr in node.attributes){
                tag += " " + attr.attrName + "=\"" + attr.attrValue + "\"";
            }
            tag += ">";
            fs.write(tag + node.nodeValue.join("\n"));
        }

        dump_counter++;
    };
};

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
// function PatchedSlimerRequire (){

//     function require2(arg){
//         var module;
//         try {
//             module = require.require_original.apply(undefined, arguments);
//             return module;
//         } catch (err) {
//             // It is expected that the error is something like:
//             // ~/node_modules/spooky/node_modules/tiny-jsonrpc/lib/tiny-jsonrpc is not a supported type file
//             try{
//                 var module_json_description = require(arg + "/package.json");
//                 module = require.require_original.apply(undefined, [arg + "/" + module_json_description.main]);
//                 return module;
//             } catch (e) {
//                 throw err;
//             }
//         }
//     }
    
//     Object.assign(require2, require);
//     require2.require_original = require;

//     return require2;
// }
// module.exports.PatchedSlimerRequire = PatchedSlimerRequire;
// var require = PatchedSlimerRequire();
// 

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
