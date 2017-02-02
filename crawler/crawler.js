'use strict';

// ====================================================================================================================
// argparse

const ArgumentParser = require('argparse').ArgumentParser;
const argparse = new ArgumentParser({
    addHelp: true,
    description: 'This script controls crawling of web-application in role of one user.\n' +
        'This crawler must to be ruled by controller script, and didn\'t meant to be started separately.'
});
argparse.addArgument(
    ['-s', '--settings-file'],
    {help: 'relative path to settings file', required: true}
);
argparse.addArgument(
    ['-u', '--user-name'],
    {help: 'user name', required: true}
);
argparse.addArgument(
    ['-l', '--log-level'],
    {help: 'logging level', required: true}
);
const args = argparse.parseArgs();

// ====================================================================================================================
// Includes & Setup

const childProcess = require('child_process');

const webdriverio = require('webdriverio');
const ClientProxy = require('ClientProxy');

const crawlerSettings = require('../' + args.settings_file);
const crawlerLogger = require('../utils/logging.js').crawlerLogger(args.log_level);

const GenerateDOMCopy = require('./crawler-routine/copying-DOM.js').GenerateDOMCopy;

// ====================================================================================================================
class WebAppModel {

    // ================================================================================================================
    constructor() {

        this.ctrlTemplates = [];
        this.newTemplates = [];
        this.webappStateModel = {};
        this.knownUrls = [];
    }

    // ================================================================================================================
}


// ====================================================================================================================
class Crawler {

    // ================================================================================================================
    constructor(userName) {
        this.userName = userName;
    }

    // ================================================================================================================
    setup() {
        return Promise
        .resolve('success')
        .then(result => {
            return this._webProxySetup();
        })
        .then(result => {
            return this._webDriverSetup();
        })
        .then(result => {
            process.send({
                report: 'crawlerReady'
            });
        })
        .catch(error => {
            crawlerLogger.error('Error setting up crawler', this.userName);
            return Promise.reject(error);
        });
    }

    // ================================================================================================================
    _webProxySetup() {
        crawlerLogger.trace('Crawler', this.userName, '_webProxySetup started.');
        return new Promise((resolve, reject) => {
            this._webProxyChild = childProcess.fork(__dirname + '/proxy.js', ['-l', args.log_level], {stdio: 'inherit'});

            this._webProxyChild.on('message', m => {
                if (m.report === 'proxyPort') {
                    this._webProxyPort = m.webProxyPort;
                } else if (m.report === 'listening') {
                    crawlerLogger.trace('Crawler', this.userName, '_webProxySetup success.');
                    crawlerLogger.trace('Crawler', this.userName, 'proxy port number:', this._webProxyPort);
                    resolve ('success');
                }
            });

            this._webProxyChild.send({
                command: 'getProxyPort'
            });
            this._webProxyChild.send({
                command: 'filterWhiteList',
                whiteListEnable: true,
                whiteList: crawlerSettings.urlWhiteList
            });
            this._webProxyChild.send({
                command: 'filterBlackList',
                blackListEnable: true,
                blackList: crawlerSettings.urlBlackList
            });
            this._webProxyChild.send({command: 'start'});
        });
    }

    // ================================================================================================================
    _webDriverSetup() {

        this._webProxyIP = '127.0.0.1';
        // see http://webdriver.io/guide/testrunner/configurationfile.html
        let options = {
            
            // see https://github.com/SeleniumHQ/selenium/wiki/DesiredCapabilities
            desiredCapabilities: {
        
                acceptSslCerts: true, // Whether the session should accept all SSL certs by default.
                proxy: {
                    proxyType: 'manual',
                    httpProxy: this._webProxyIP + ':' + this._webProxyPort,
                    sslProxy: this._webProxyIP + ':' + this._webProxyPort,
                    socksProxy: this._webProxyIP + ':' + this._webProxyPort
                },

                // browserName: 'chrome',
                // // see https://sites.google.com/a/chromium.org/chromedriver/capabilities
                // 'chromeOptions': {
                //     // http://peter.sh/experiments/chromium-command-line-switches/
                //     'args': [
                //         // '--disable-web-security', // disable SOP
                //         // '--enable-potentially-annoying-security-features', //Enables a number of potentially annoying security features (strict mixed content mode, powerful feature restrictions, etc.)
                //         // '--reduce-security-for-testing', // Enables more web features over insecure connections. Designed to be used for testing purposes only.
                //         // '--translate-security-origin', // Overrides security-origin with which Translate runs in an isolated world.
                //         '--window-size=1000,600',
                //         '--allow-insecure-localhost', // Enables TLS/SSL errors on localhost to be ignored (no interstitial, no blocking of requests).
                //         // '--ssl-version-min=tls1', // Specifies the minimum SSL/TLS version ("tls1", "tls1.1", "tls1.2", or "tls1.3").
                //         '--ignore-certificate-errors'
                //     ],
                //     'prefs': {
                //         'profile.managed_default_content_settings.images': 2
                //     }
                // },

                browserName: 'firefox',
                // see https://github.com/mozilla/geckodriver
                'geckoOptions': {
                    'args': [
                        '--window-size=1000,600',
                        '--load-images=no'
                    ]//,
                    // 'prefs': {
                    //     // 'browser.ssl_override_behavior': 1
                    //     // 'permissions.default.image': 2, // Doesn't work in firefox anymore
                    //     // 'permissions.default.stylesheet': 2 // Never existed in firefox
                    // },
                    // webdriver_accept_untrusted_certs: true
                },
                
                javascriptEnabled: true, // Whether the session supports executing user supplied JavaScript in the context of the current page (only on HTMLUnitDriver).
                nativeEvents: true       // Whether the session is capable of generating native events when simulating user input.
            },
            logLevel: 'verbose' // verbose | silent | command | data | result | error
        };
        this._browserClient = webdriverio.remote(options);
        
        crawlerLogger.trace('Crawler', this.userName, '_webDriverSetup success.');
    }

    // ================================================================================================================
    listenCommands() {
        process.on('message', m => {

            if (m.command === 'crawlCurrentState') {
                crawlerLogger.trace('Command for crawling web-application came.');

                // Crawl ?

                this._browserClient
                    .init()
                    .url('http://duckduckgo.com/')
                    .setValue('#search_form_input_homepage', 'WebdriverIO')
                    .click('#search_button_homepage')
                    .getTitle().then(function(title) {
                        console.log('Title is: ' + title);
                    })
                    .end();

                // setTimeout(()=>{
                //     process.send({
                //         report: 'crawlingDone',
                //         cycleNum: m.cycleNum
                //     });
                // }, 1000);

            } else {
                crawlerLogger.error({
                    crawlerUser: this.userName,
                    error: 'Unknown command from controller.'
                });
            }

        });
    }

    // ================================================================================================================
    waitFullPageLoad() {
        // TODO: this._browserClient.WaitUntil(function(){
        //     return document.readyState === 'complete';
        // });
    }

    // ================================================================================================================
    login() {
        return crawlerSettings.users[this.userName].login_function(this._browserClient, this.userName);
    }

    // ================================================================================================================
    logout() {
        return crawlerSettings.users[crawlerUser].logout_function(this._browserClient);
    }

    // ================================================================================================================
}


// ====================================================================================================================
// Main

let webCrawler = new Crawler(args.user_name);
let workflowPromise = webCrawler
.setup()
.then(result => {
    webCrawler.listenCommands();
});







// // ==================================================================================================================================================
// //                                                                                                         JaxsnoopCrawler::openNextUsersWebPageState
// // ==================================================================================================================================================
// JaxsnoopCrawler.prototype.openNextUsersWebPageState = function openNextUsersWebPageState(/*some parameter selecting action for opening new web page state*/) {
//     var self = this;
    
//     // Making user-step
//     // By default I only logging in user
//     // var promise = self.login(self.page);
//     var promise = crawler_test_utils.openTestPage (self.page);

//     // TODO: Not default behaviour (indeed making user-step)
//     // 

//     // Getting web-page model
//     promise = promise.then((message) => {

//         var jsonUsersWebPageState = self.page.evaluate(webPageModelGenerator.GenerateWebPageModel);
//         var usersWebPageState = JSON.parse(jsonUsersWebPageState);


//         debugLogger.log (JSON.stringify(usersWebPageState, null, 2));
//         var promise = this.domTreeModelConvolution(usersWebPageState);


//         return promise;

//     }, (err) => {
//         logging.error('Error in opening next users web state: ' + err);
//     });
    
//     return promise;
// };


// // ==================================================================================================================================================
// //                                                                                                           JaxsnoopCrawler::domTreeModelConvolution
// // ==================================================================================================================================================
// // 
// // function must detect similarities:
// //      1) similarities on one page (e.g. two forums on one webpage; crawler must be interested to crawl only one of them)
// //      2) similar pages (e.g. habrahabr articles of different users)
// //      3) similarities between pages (e.g. status bar (login, logout, settings, etc))
// // 
// JaxsnoopCrawler.prototype.domTreeModelConvolution = function domTreeModelConvolution(usersWebPageState){

//     var userWebAppCurrentState = {
//         nodeNumber: undefined,
//         url: usersWebPageState.url,
//         domTreeModel: usersWebPageState.domTreeModel
//     };

//     var promise = new Promise(function(res, rej){res('success');});

//     var distance = -1;
//     // For jqgram distance =
//     //      0 - equal trees
//     //      1 - different trees

//     var treeComparizonParameters = {
//         'tagsSpecifics': {
//             'unknown': [
//                 'tagName'
//             ],
//             'a': [
//                 ''
//             ]
//         }
//     };

//     var nodeHandlerFn = {
//         // For 'compare' function there is assumption, that a1 and a2 are nodes with tagNames is appropriate
//         'a': {
//             compare: function(a1, a2){
//                 return ;
//             }
//         },
//         'DEFAULT': {}
//     };

//     var compareSubTrees = function compareSubTrees(promise, roota, rootb) {
//         return promise.then(function(status){
//             return new Promise(function(res, rej){

//                 var lableFunction = function lableFunction(node){
//                     return node;
//                 };

//                 var childFunction = function childFunction(node){
//                     return node.childNodes;
//                 };

//                 var compareFn = function compareFn(a1,a2) {
//                     if (a1.length !== a2.length){ return false; }
//                     for (var i = 0; i < a2.length; i++) {
//                         if (a1[i] !== a2[i]){ return false; }
//                     }
//                     return true;
//                 };

//                 jqgram.distance({
//                     root: roota,
//                     lfn: lableFunction,
//                     cfn: childFunction
//                 }, {
//                     root: rootb,
//                     lfn: lableFunction,
//                     cfn: childFunction
//                 }, {
//                     p:2,
//                     q:3,
//                     depth:100
//                 }, function(result){
//                     distance = result.distance;
//                     res('success');

//                 }, compareFn);
//             });
//         });
//     };
//     promise = compare(promise, userWebAppCurrentState.domTreeModel.childNodes[0], userWebAppCurrentState.domTreeModel.childNodes[1]);

//     promise.then(function(status){
//         console.log(distance);
//     });

//     return promise;

// };


// // ==================================================================================================================================================
// //                                                                                                                   JaxsnoopCrawler::classifyWebpage
// // ==================================================================================================================================================
// // 
// // This function looks on the current opened webpage in the crawler and already generated map of static actions for
// // current user and breaks it into independent blocks, making tree of this blocks.
// // The main goal of classification is to identify equal and similar DOM subtrees, so webcrawler will be able to not
// // trigger the same event several times
// // 
// // Types of similarities, which must be picket out
// //  1) similarities between pages (e.g. status bar (login, logout, settings, etc))
// //  2) similarities on one page (e.g. two forums on one webpage; crawler must be intrested to crawl only one of them)
// //  3) similar pages (e.g. habrahabr articles of different users)
// // 
// // To be able to differentiate different content, but with the same structure, some identifiers of removed duplicates
// // must be saved
// // 
// // Saved parts of DOM subtrees also must contain information about those elements, which has set on them different
// // event listeners, such as onclick, ...
// // 
// // Before clustering the current webpage, search for differences must be done, between previous webpage state and new
// // webpage state, and differences must be classified, but not whole webpage
// // 
// JaxsnoopCrawler.prototype.classifyWebpage = function classifyWebpage() {

// };


// // ==================================================================================================================================================
// //                                                                                                                JaxsnoopServer::StartSlaveWebServer
// // ==================================================================================================================================================
// // 
// // starting listening for incoming commands from crawler controller.
// // 
// JaxsnoopServer.prototype.StartSlaveWebServer = function StartSlaveWebServer (jaxsnoopCrawler) {

//     var webserverSlavePort = parseInt(system.env.COMMANDS_PORT_CRAWLER);
//     var webserverSlave = webserver.create();

//     try {
//         webserverSlave.listen(webserverSlavePort, function(request, response) {
//             if (request.method == 'GET' && request.url == '/check_crawler') {
//                 response.statusCode = 200;
//                 response.write('I am alive');
//                 response.close();
//             }
//             else if (request.method == 'GET' && request.url == '/close_server') {
//                 logger.info('Closing crawler ' + crawlerUser);
//                 webserverSlave.close();
//                 slimer.exit();

//                 response.statusCode = 200;
//                 response.write('OK');
//                 response.close();
//             }
//             // else if (request.method == 'POST' && request.url == '/set_settings') {
//             //     try{
//             //         jaxsnoopCrawler.rewriteSettings(request.post);
//             //         logger.info('settings written successfully');
                    
//             //         response.statusCode = 200;
//             //         response.write('');
//             //         response.close();

//             //     } catch (err){
//             //         logger.error('Error while setting new settings ' + err);

//             //         response.statusCode = 400;
//             //         response.write('Error: ' + err);
//             //         response.close();
//             //     }
//             // }
//             else if (request.method == 'GET' && request.url == '/get_webapp_state') {


//                 response.statusCode = 200;
//                 response.write('Got it');
//                 response.close();
//             }
//             else if (request.method == 'POST' && request.url == '/make_webapp_action') {


//                 response.statusCode = 200;
//                 response.write('Got it');
//                 response.close();
//             }
//             else {
//                 logger.warn('Unrecognized request to server');

//                 response.statusCode = 400;
//                 response.write('unrecognized request');
//                 response.close();
//             }
//         });
//         logger.info('Crawler webserver started on port ' + webserverSlavePort);

//     } catch (err) {
//         logger.error('Error while opening webserver on web crawler side.\nError: ' + err);
//         throw err;
//     }
// };

// // ==================================================================================================================================================
// // ==================================================================================================================================================
// MAIN();
