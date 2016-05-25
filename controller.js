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
// Includes
// ====================================================================================================================

const path = require('path');
const childProcess = require('child_process');
const net = require('net');
const http = require('http');
const fs = require('fs');
const events = require('events');

const Q = require('q');
const merge = require('merge');
const sleep = require('sleep');
const winston = require('winston');
const bunyan = require('bunyan');
const util = require('util');
const tmp = require('tmp');

const slimerjs = require('slimerjs');

const jaxsnoopSettings = require('./settings.js');
const crawlerSettings = require('./settings_crawler.js');

const globalAttemptsNumber = 3;

// Possile graph libraries
// https://www.npmjs.com/package/graph.js
// https://www.npmjs.com/package/digraphe
// https://www.npmjs.com/package/jsgraph

// ====================================================================================================================
// ====================================================================================================================
// Setup
// ====================================================================================================================

// logger directory
if (!fs.existsSync('./log')){
    fs.mkdirSync('./log');
}

// bunyan logger
// fatal, error, warn, info, debug, trace
var nodeLogger = bunyan.createLogger({
    name: 'nodeLogger',
    streams: [
        {
            level: jaxsnoopSettings.console_log_level,
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

var crawlerLogger = bunyan.createLogger({
    name: 'crawlersLogger',
    streams: [
        {
            level: jaxsnoopSettings.console_log_level,
            stream: process.stdout
        },
        {
            level: 'info',
            path: './log/crawlers.log'
        },
    ],
    serializers: bunyan.stdSerializers
});

// Alternative logger - winston
// { emerg: 0, alert: 1, crit: 2, error: 3, warning: 4, notice: 5, info: 6, debug: 7 }

Q.longStackSupport = jaxsnoopSettings.q_long_stack_support;

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

// This function makes globalAttemptsNumber of calling callback until it will succeed.
// Calls of callback are made sequentially with specified delay, until first succeeded callback
// In fact this function plays role of decorator
// 
// callback - must return Q.Promise, callback is treated as succeeded if promise will success
// delay - the delay before calling next callback after fail of the previous
// 
// return - this function also returns promise and will trigger success if any attempt of calling callback will succeed
// 
function AttemptsLauncher(callback, delay) {

    var promise = callback();

    for (var i = 0; i < globalAttemptsNumber; i++) {
        promise = promise.fail((err) => {
            return Q.Promise((res, rej) => {
                setTimeout(() => {
                    callback().then((mes) => {res(mes);}, (err) => {rej(err);});
                }, delay);
            });
        });
    }
    return promise;
}

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

function JaxSnoop() {

    // ================================================================================================================
    var GetFreePortNumber = function() {
        var srv = net.createServer((sock) => {});
        srv.listen(0, () => {});
        var free_port = srv.address().port;
        srv.close();
        return free_port;
    };

    // ================================================================================================================
    this.crawlers = {};

    // ================================================================================================================
    // Checks connection to crawler by sending request to it and waitng for answer
    // 
    // user_name - is the name of the field defined in crawler settings
    // 
    // return - Q.Promise, which will succeed in case the specified crawler will succesfully answer, or fail after several
    //          unsuccessfull attempts
    //          
    this.CheckCrawlerConnection = function CheckCrawlerConnection (user_name) { var self = this;
        return AttemptsLauncher(() => {

            return new Q.Promise((resolve, reject) => {
                var req = http.request({
                    hostname: 'localhost',
                    port: self.crawlers[user_name].crawler_port,
                    // port: 27,
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
    };

    // ================================================================================================================
    // This function ought to send SIGKILL to the child process, but as there is a chain node -> slimer -> firefox
    // I can not find out the pid of firefox process and therefore can not kill it
    // 
    // With assumption that the crawler webserver still operates correct I will send to it close_server request
    // 
    this.KillCrawler = function KillCrawler (user_name) {
        if (this.crawlers.hasOwnProperty(user_name))
        {
            // this.crawlers[user_name].crawler_proc.kill('SIGKILL');
            // crawler has changed its pid that is why it will never work
            
            var req = http.request({
                    hostname: 'localhost',
                    port: this.crawlers[user_name].crawler_port,
                    method: 'GET',
                    path: '/close_server'
                }, (res) => {});
            req.write('');req.end();

            this.crawlers[user_name].destr.emit('kill_crawler');

            delete this.crawlers[user_name];
        }
    };

    // ================================================================================================================
    // This function starts crawler with warranties that the crawler will be alive
    // If the crawler already has been started - it will be killed and new crawler instead will be started
    // 
    // user_name - the name of the field defined in crawler settings, it will be passed to crawler to tell him his role,
    //              it is also used as identifier of a crawler in code
    // 
    // return - Q.Promise, which will succeed in case the specified crawler will successfully start or will rejected if
    //          crawler will fail to start after several attempts.
    // 
    this.RestartCrawler = function RestartCrawler (user_name) { var self = this;

        return AttemptsLauncher(() => {

            self.KillCrawler(user_name);

            var crawler_destructor = new events();
            var childArgs = [path.join(__dirname, './crawler.js')].concat(jaxsnoopSettings.slimerjs_cli_settings);
            var crwlr_port = GetFreePortNumber();
            var tmp_file_name = tmp.tmpNameSync();



            // This code creates fifo-file to read output from crawler
            // But slimerjs can not do that (version < 0.10 will not work with fifo file) (version == 0.10 fs is just broken)
            // 
            // childProcess.execSync('mkfifo ' + tmp_file_name);
            // try {
            //     // If this produce an exception, then we fail to create the pipe
            //     fs.lstatSync(tmp_file_name);

            //     crawler_destructor.on('kill_crawler', () => {
            //         try {
            //             fs.unlink(tmp_file_name);
            //         } catch (err) {
            //             nodeLogger.warn('Could not clear after myself. Error deleting pipe for crawler ' + user_name + ". " + err);
            //         }
            //     });
            // } catch (err) {
            //     throw new Error("Error creating fifo for connection between crawler and controller " + kkk);
            // }
                
            // This code creates normal file to read output from crawler
            // It looks, that nodejs is not fast enough for watching the file changes, so the idea dies
            
            // fs.closeSync(fs.openSync(tmp_file_name, 'w'));
            // crawler_destructor.on('kill_crawler', () => {
            //     fs.unlink(tmp_file_name);
            // });



            // Start watching crawler log file
            // var watcher = fs.watch(tmp_file_name, (event, filename) => {
            //     if (event === 'change')
            //     {
            //         fs.readFile(tmp_file_name, (err, data) => {
            //             if (! err) {
            //                 var re = /\[(\w*)\](.*)/;
            //                 var parsed_str = re.exec(data+"");
            //                 console.log(">" + data + "<");
            //                 // if (['info', 'warn', 'error'].indexOf(parsed_str[1]) !== -1)
            //                 //     crawlerLogger[parsed_str[1]](parsed_str[2]);
            //                 // else
            //                 //     crawlerLogger.warn(">" + data+"<");
            //             }
            //         });
            //     } else {
            //         crawlerLogger.error('Error watching file "' + tmp_file_name + '" of crawler "' + user_name + '" log');
            //     }
            // });
            // crawler_destructor.on('kill_crawler', () => {
            //     watcher.close();
            // });



            var crawler_inst = childProcess.spawn(slimerjs.path, childArgs, {
                stdio: 'pipe', //['pipe', 'inherit', 'inherit'],
                // inherit is quite important for slimerjs, because in 'pipe' mode it will lose some parts of output
                env: merge(process.env, {
                    'PORT_CRAWLER': crwlr_port,
                    'USER_NAME': user_name,
                    'LOG_PIPE': tmp_file_name })
            });

            crawler_inst.stdout.on('data', (data) => {

                data = data+'';
                // console.log('>>>' + data);

                // Sometimes log messages from crawler will come in packs (meaning data will contain several messages)
                // To destinguish them I am going to use one of two principles
                // 
                //      1) Each message begins with '[crdebug]', '[crinfo]', ...
                //      But in this case we will attach strange alone messages to the previous message with '[cr...]'
                // var re_log_message = /\s*(\[cr(?:debug|info|warn|error)\](?:.|\n)*)(?:\[cr(?:debug|info|warn|error)\]|\s*$)/g;
                // 
                //      2) Each line are separate message
                var re_log_message = /\s*(.+)(?:\n|$)/g;

                var re_log_message_lastIndex = 0;
                for (var log_message = re_log_message.exec(data); log_message !== null; log_message = re_log_message.exec(data))
                {
                    re_log_message_lastIndex = re_log_message.lastIndex;
                    var re = /\[cr(debug|info|warn|error)\]((?:.|\n)*)\s*/;
                    var parsed_str = re.exec(log_message[1]);

                    if (parsed_str !== null) {
                        crawlerLogger[parsed_str[1]](parsed_str[2]);
                    } else {
                        if (! /\s*/.test(log_message[1]))
                            crawlerLogger.warn('Unrecognized crawler log output: >' + log_message[1] + '<');
                    }
                }
                if (re_log_message_lastIndex < data.length) {
                    crawlerLogger.warn('Unrecognized crawler log output: >' + data.slice(0, -1) + '<');
                }
            });
            
            crawler_inst.stderr.on('data', (data) => {
                crawlerLogger.error('Got stderr output from crawler: >' + data.slice(0, -1) + '<');
            });

            // var crawler_log = fs.createReadStream(pipe_name, 'r');
            // crawler_log.on('data', (data) => {
            //     var re = /\[(\w*)\](.*)/;
            //     var parsed_str = re.exec(data+"");
            //     console.log(data+'');
            //     // if (['info', 'warn', 'error'].indexOf(parsed_str[1]) !== -1)
            //     //     crawlerLogger[parsed_str[1]](parsed_str[2]);
            //     // else
            //     //     crawlerLogger.warn(">" + data+"<");
            // });
            
            self.crawlers[user_name] = {
                crawler_proc: crawler_inst,
                crawler_port: crwlr_port,
                destr: crawler_destructor
            };


            var promise = self.CheckCrawlerConnection(user_name)
                .fail((err) => {
                    self.KillCrawler(user_name);
                    throw err;
                });
            return promise;

        }, 0);
    };

    // ================================================================================================================
    
}

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
var jaxSnoop = new JaxSnoop();

Q.all(
    Object.keys(crawlerSettings.users).map((val, i, arr) => {
        return jaxSnoop.RestartCrawler(val);
    })

).then(() => {
    nodeLogger.info('Successfully started all web-crawlers');
}, (err) => {
    nodeLogger.fatal('Error: ' + util.inspect(err, false, null));
    nodeLogger.fatal('Error starting crawlers. Give up.');
    process.exit(1);

}).then(() => {

    nodeLogger.info("Starting crawling.");

    while(true) {

    }

    nodeLogger.info('Program finished, bye.');

}).fail((err) => {
    nodeLogger.fatal('Error. Crawling stopped.');
    throw err;

}).fin(() => {
    Object.keys(jaxSnoop.crawlers).map((val, i, arr) => {
        jaxSnoop.KillCrawler(val);
    });
})
.done();
