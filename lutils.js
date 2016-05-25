// lutils - local utils, used during development

var fs = require('fs');

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
var util = require('/usr/lib/node_modules/util-slimy/util.js');
module.exports.log = function (obj){
    console.log(util.inspect(obj, false, null));
};

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
module.exports.crawlerLogger = function crawlerLogger(file_name, crawlerUser, logLevel) {
    var logLevels = ['debug', 'info', 'warn', 'error'];

    // console.log(util.inspect(fs.exists(file_name)));

    // var logfile = fs.open('/tmp/uniq1', {
    //     mode: 'w',
    //     nobuffer: true
    // });
    // var logfile = fs.open('/tmp/uniq1', 'a');
    
    // var logfile = fs.open(file_name, 'a');

    this.debug = function(msg) {
        if (logLevels.indexOf(logLevel) <= 0) {
            // logfile.write('[debug][Browser "' + crawlerUser + '"] ' + msg + '\n');
            // fs.write(file_name, '[debug][Browser "' + crawlerUser + '"] ' + msg, 'w');
            console.log('[crdebug][Browser "' + crawlerUser + '"] ' + msg);
        }
    };

    this.info = function(msg) {
        if (logLevels.indexOf(logLevel) <= 1) {
            // fs.write(file_name, '[info][Browser "' + crawlerUser + '"] ' + msg, 'w');
            console.log('[crinfo][Browser "' + crawlerUser + '"] ' + msg);
        }
    };

    this.warn = function(msg) {
        if (logLevels.indexOf(logLevel) <= 2) {
            // fs.write(file_name, '[warn]' + module.exports.colors.yellow('[Browser "' + crawlerUser + '"] ' + msg), 'w');
            console.log('[crwarn]' + module.exports.colors.yellow('[Browser "' + crawlerUser + '"] ' + msg));
        }
    };

    this.error = function(msg) {
        if (logLevels.indexOf(logLevel) <= 3) {
            // fs.write(file_name, '[error]' + module.exports.colors.red('[Browser "' + crawlerUser + '"] ' + msg), 'w');
            console.log('[crerror]' + module.exports.colors.red('[Browser "' + crawlerUser + '"] ' + msg));
        }
    };
};
