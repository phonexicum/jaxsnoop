// Main jaxsnoop script
// 
// Execution context: nodejs

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
const util = require('util');
const tmp = require('tmp');
const argparse = require('argparse').ArgumentParser;

const slimerjs = require('slimerjs');

// ====================================================================================================================
// ====================================================================================================================
// Setup
// ====================================================================================================================
var parser = new argparse({
    addHelp: true,
    description: 'Example \t nodejs --harmony controller.js --settings-dir=./settings/pyforum | bunyan -o short'
});
parser.addArgument(
  [ '--settings-dir', '--foo' ],
  { help: 'relative path to settings directory'}
);
var args = parser.parseArgs();

const jaxsnoopSettings = require('./' + path.join (args.settings_dir, './settings.js'));
const crawlerSettings = require('./' + path.join ('./', args.settings_dir, './settings_crawler.js'));

const my_loggers = require('./utils/setup_ctrl_logger.js');
const crawlerLogger = my_loggers.crawlerLogger (jaxsnoopSettings.console_log_level);
const nodeLogger = my_loggers.nodeLogger (jaxsnoopSettings.console_log_level);

const ctrl_utils = require('./utils/ctrl_utils.js');

Q.longStackSupport = jaxsnoopSettings.q_long_stack_support;

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

function JaxSnoop() {

    // ================================================================================================================
    this.crawlers = {};

    // ================================================================================================================
    // Checks connection to crawler by sending request to it and waiting for answer
    // 
    // user_name - is the name of the field defined in crawler settings
    // 
    // return - Q.Promise, which will succeed in case the specified crawler will succesfully answer, or fail after several
    //          unsuccessfull attempts
    //          
    this.CheckCrawlerConnection = function CheckCrawlerConnection (user_name) { var self = this;
        return ctrl_utils.AttemptsLauncher(() => {

            return new Q.Promise((resolve, reject) => {
                var req = http.request({
                    hostname: 'localhost',
                    port: self.crawlers[user_name].crawler_port,
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

            crawlerLogger.debug('Crawler "' + user_name + '" killed.');
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

        var parseCrawlerLog = (data) => { data = data+'';

            // Sometimes log messages from crawler will come in packs (meaning data will contain several messages)
            // To destinguish them I am going to use one of two principles
            // 
            //      1) Each message begins with '[crdebug]', '[crinfo]', ...
            //      But in this case we will attach strange alone messages to the previous message with '[cr...]'
            // var re_log_message = /\s*(\[cr(?:debug|info|warn|error)\](?:.|\n)*)(?:\[cr(?:debug|info|warn|error)\]|\s*$)/g;
            // 
            //      2) Each line is a separate message
            var re_log_message = /\s*(.+)(?:\n|$)/g;

            var re_log_message_lastIndex = 0;
            for (var log_message = re_log_message.exec(data); log_message !== null; log_message = re_log_message.exec(data))
            {
                re_log_message_lastIndex = re_log_message.lastIndex;
                var re = /(.*)\[cr(trace|debug|info|warn|error|fatal)\]((?:.|\n)*)\s*/;
                var parsed_str = re.exec(log_message[1]);

                if (parsed_str !== null) {
                    crawlerLogger[parsed_str[2]](parsed_str[1] + ' ' + parsed_str[3]);
                } else {
                    if (! /^\s*$/.test(log_message[1]))
                        crawlerLogger.warn('Unrecognized crawler log output: >' + log_message[1] + '<');
                }
            }
            if (re_log_message_lastIndex < data.length && ! /^\s*$/.test(data.slice(re_log_message_lastIndex))) {
                crawlerLogger.warn('Unrecognized crawler log output remainders: >' +
                    data.slice(re_log_message_lastIndex, -1) + '<');
            }
        };


        return ctrl_utils.AttemptsLauncher(() => {

            self.KillCrawler(user_name);

            var crawler_destructor = new events();
            var childArgs = [path.join(__dirname, './crawler.js')].concat(jaxsnoopSettings.slimerjs_cli_settings);
            var crwlr_port = ctrl_utils.GetFreePortNumber();

            // // Setting HTTP server to listen for crawler logs
            // const server = http.createServer((req, res) => {
            //     if (req.method === 'POST') {
            //         var data = '';
            //         req.on('data', (data_chunk) => {
            //             data = data + data_chunk;
            //         });
            //         req.on('end', () => {
            //             parseCrawlerLog(data);
            //         });
            //         req.on('error', (err) => {
            //             parseCrawlerLog(data);
            //             nodeLogger.error('Error from crawler "' +  + '" logs incoming connection');
            //         });
            //     }
            //     res.writeHead(200, "OK", {'Content-Type': 'text/plain'});
            //     res.end();
            // }).listen(0, 100);
            
            // crawler_destructor.on('kill_crawler', () => {
            //     server.close();
            // });

            var crawler_inst = childProcess.spawn(slimerjs.path, childArgs, {
                stdio: 'pipe',
                env: merge(process.env, {
                    'USER_NAME': user_name,
                    // 'COMMANDS_HOST_CRAWLER': 'localhost',
                    'COMMANDS_PORT_CRAWLER': crwlr_port,
                    'CRAWLER_SETTINGS_PATH': './' + path.join ('./', args.settings_dir, './settings_crawler.js'),
                    'LOGGING_HOST': 'localhost',
                    'LOGGING_PORT': 0
                    // 'LOGGING_PORT': server.address().port
                })
            });
            crawler_inst.stderr.on('data', (data) => {
                crawlerLogger.error('Got stderr output from crawler: >' + data.slice(0, -1) + '<');
            });

            crawler_inst.stdout.on('data', parseCrawlerLog);
            crawler_inst.stdout.on('error', (err) => {
                crawlerLogger.error('crawler stdout error: ' + err);
            });

            
            self.crawlers[user_name] = {
                crawler_proc: crawler_inst,
                crawler_port: crwlr_port,
                destr: crawler_destructor
            };

            var promise = self.CheckCrawlerConnection(user_name)
                .fail((err) => {
                    nodeLogger.error('failed to start crawler "' + user_name + '"');
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
// Main
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

    // while(true) {
    // }

    setInterval(function(){}, 100);

    nodeLogger.info('Program finished, bye.');

}).fail((err) => {
    nodeLogger.fatal('Error. Crawling stopped.');
    throw err;

})/*.fin(() => {
    Object.keys(jaxSnoop.crawlers).map((val, i, arr) => {
        jaxSnoop.KillCrawler(val);
    });
})*/.done();
