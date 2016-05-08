//  This script executes in context of nodejs
// 
//  The only two modules suited to connect slimer and node: spooky and node-phantom-simple
//  I refused from both of them, because it is ubnormal to write functions for slimer in node files, there must be interface to 'connect' them, not to include one into another - so there is no appropriate module
// 
//  Casperjs drawback - you must fully construct suite for page processing and only after that run it. I choose slimer on its own, because you can create web page and make actions on it in motion
// 
//  Probably you can use phantomjs instead of slimerjs, but I never tried

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
// Includes

const path = require('path');
const childProcess = require('child_process');
const net = require('net');
const http = require('http');
const fs = require('fs');

const Promise = require('promise');
const Q = require('q');
const merge = require('merge');
const sleep = require('sleep');
const winston = require('winston');

const slimerjs = require('slimerjs');

const lutils = require('./lutils.js');

const jaxsnoopSettings = require('./settings.js');
const crawlerSettings = require('./settings_crawler.js');

const globalAttemptsNumber = 3;

var defered = Q.defer();
defered.resolve('hifi');
defered.promise.then((val) => {
    console.log(val);
    return Q.Promise((resolve, reject) => { resolve ('hifi2');});
}).then ((val) => {
    console.log(val);
});


// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
// Setup

// { emerg: 0, alert: 1, crit: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7 }
if (!fs.existsSync('./log')){
    fs.mkdirSync('./log');
}
var nodeLogger = new(winston.Logger)({
    level: 'info',
    transports: [
        new(winston.transports.Console)({
            level: jaxsnoopSettings.console_log_level,
            timestamp: () => {
                return Date(); }
        }),
        new(winston.transports.File)({
            name: 'error-file',
            filename: './log/error.log',
            level: 'error',
            timestamp: () => { return Date(); }
        })
    ]
});
var crawlerLogger = new(winston.Logger)({
    level: 'info',
    transports: [
        new(winston.transports.Console)({
            level: jaxsnoopSettings.console_log_level,
            timestamp: () => {
                return Date(); }
        }),
        new(winston.transports.File)({
            name: 'crawlers-file',
            filename: './log/crawlers.log',
            level: 'info',
            timestamp: () => { return Date(); }
        })
    ]
});

Q.longStackSupport = jaxsnoopSettings.q_long_stack_support;

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

// This function makes globalAttemptsNumber of calling callback until it will succeed.
// Calls of callback are made independently (therefore can happen that several callback will happen simultaneously), but
//  after the first succeeded callback no new calls will be made.
// 
// callback - must return Promise, callback is treated as succeeded if promise will success
// return - this function also returns promise and will trigger success if any attempt of calling callback will succeed
function AttemptsLauncher(callback, delay) {
    return new Promise ((resolve, reject) => {
        
        var attempts_timeouts = [];
        var last_err;
        var rejected_attempts_num = 0;
        
        var promise = callback();

        for (var i = 0; i < globalAttemptsNumber; i++) {
            promise.fail((cause) => {
                setTimeout (callback, i* delay);
            });
        }

        return promise;


        for (var i = 0; i < globalAttemptsNumber; i++) {

            attempts_timeouts.push(setTimeout(() => {
                var promise = callback();
                promise.then(() => {
                    for (var j in attempts_timeouts) { clearTimeout(j); }
                    resolve();
                }, (cause) => {
                    last_err = cause;
                    rejected_attempts_num ++;
                    if (rejected_attempts_num == globalAttemptsNumber)
                        reject ('Last attempt error: ' + cause);
                });
            }, i * delay));

        }
    });



}

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

function JaxSnoop() {

    // ================================================================================================================
    var GetFreePort = function() {

        var srv = net.createServer((sock) => {});
        srv.listen(0, () => {});
        var free_port = srv.address().port;
        srv.close();
        return free_port;
    };

    // ================================================================================================================
    this.crawlers = {};

    // ================================================================================================================
    // This function is used to check connection to crawler
    // 
    // user_name - is the name of the field defined in crawler settings
    // return - promise, which will succeed in case the specified crawler will succesfully answer, or fail after several
    //          unsuccessfull attempts
    //          
    this.CheckCrawlerConnection = function (user_name) {
        // Check if crawler instance bootstrapped okey
        var promise = AttemptsLauncher(() => {
            return new Promise((resolve, reject) => {
                var req = http.request({
                    hostname: 'localhost',
                    port: crawler_port,
                    method: 'GET',
                    path: '/check_crawler'
                }, (res) => {
                    if (res.statusCode !== 200)
                        reject('Wrong status code on check_crawler request.');
                    resolve();
                });

                req.on('error', (e) => { reject('Can not connect to crawler on port ' + user_name); });
                req.write(''); req.end();
            });
        }, 1000);

        return promise;
    };

    // ================================================================================================================
    // This function starts crawler without any warranties
    // 
    // user_name - is the name of the field defined in crawler settings, it will be passed to crawler to tell him his role
    // return - promise, which will succeed in case the specified crawler will successfully start
    // 
    this.StartCrawler = function(user_name) { var self = this;
        
        if (self.crawlers.user)

        var childArgs = [path.join(__dirname, './crawler.js')].concat(jaxsnoopSettings.slimerjs_cli_settings);

        var crawler_port = GetFreePort();
        var crawler_inst = childProcess.spawn(slimerjs.path, childArgs, {
            stdio: 'pipe',
            env: merge(process.env, { 'PORT_CRAWLER': crawler_port, 'USER_NAME': user_name })
        });

        crawler_inst.stdout.on('data', (data) => {
            crawlerLogger.info('[crawler ' + user_name + '] ' + data);
        });
        // crawler_inst.stderr.on('data', (data) => {
        //     crawlerLogger.info('[crawler ' + crawler_port + '] ' + data);
        // });
        
        var promise = this.CheckCrawlerConnection (user_name);

        promise.then (() => {
            self.crawlers.user_name = {crawler_proc: crawler_inst, crawler_port: crawler_port};
        });

        return promise;
    };

    // ================================================================================================================
    
}

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
var jaxSnoop = new JaxSnoop();

// Start all crawlers
Promise.all(
    Object.keys(crawlerSettings.users).map((val, i, arr) => {
        return jaxSnoop.StartCrawler(val);
    })
).then(() => {
    nodeLogger.info('Successfully started all web-crawlers');
}, () => {
    nodeLogger.crit(lutils.colors.red('Error starting crawlers. Give up.'));
    process.exit(1);
});

// nodeLogger.info('Program finished, bye.');
// process.exit(0);
