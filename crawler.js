// Main jaxsnoop crawler script
// 
// Execution context: slimerjs

// ====================================================================================================================
// ====================================================================================================================
// Includes
// ====================================================================================================================
// We are limited with normal node packages functionality, because slimerjs and phantomjs - are not nodejs and have
// support drawbacks


var system = require('system');
var webpage = require('webpage');
var fs = require('fs');
var webserver = require('webserver');

// var sleep = require(system.env.HOME + '/node_modules/sleep/index.js');

var slimer_utils = require('./utils/slimer_utils.js');
var crawlerSettings = require(system.env.CRAWLER_SETTINGS_PATH);
var crawler_test_utils = require('./crawler_test_utils.js');

// ====================================================================================================================
// ====================================================================================================================
// Setup
// ====================================================================================================================
var crawlerUser = system.env.USER_NAME;

var logger = new slimer_utils.crawlerLogger(system.env.LOGGING_HOST, system.env.LOGGING_PORT, crawlerUser, crawlerSettings.loglevel);
var debugLogger = new slimer_utils.crawlerDebugLogger("./log/debug_log.log");

var webPageModelGenerator = require('./crawler_routine/web_page_model_generator.js');

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

// if (crawlerSettings.loglevel === 'debug')
//     crawler_test_utils.testCrawlerLogSystem();

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

function JaxsnoopServer (){

    // ================================================================================================================
    this.StartSlaveWebServer = function StartSlaveWebServer (jaxsnoopCrawler) {

        var webserverSlavePort = parseInt(system.env.COMMANDS_PORT_CRAWLER);
        var webserverSlave = webserver.create();

        try {
            webserverSlave.listen(webserverSlavePort, function(request, response) {
                if (request.method == 'GET' && request.url == '/check_crawler') {
                    response.statusCode = 200;
                    response.write('I am alive');
                    response.close();
                }
                else if (request.method == 'GET' && request.url == '/close_server') {
                    logger.info("Closing crawler " + crawlerUser);
                    webserverSlave.close();
                    slimer.exit();

                    response.statusCode = 200;
                    response.write('OK');
                    response.close();
                }
                else if (request.method == 'POST' && request.url == '/set_settings') {
                    try{
                        jaxsnoopCrawler.rewriteSettings(request.post);
                        logger.info("setting written successfully");
                        
                        response.statusCode = 200;
                        response.write('');
                        response.close();

                    } catch (err){
                        logger.error("Error while setting new settings " + err);

                        response.statusCode = 400;
                        response.write('Error: ' + err);
                        response.close();
                    }
                }
                else if (request.method == 'GET' && request.url == '/get_webapp_state') {


                    response.statusCode = 200;
                    response.write('Got it');
                    response.close();
                }
                else if (request.method == 'POST' && request.url == '/make_webapp_action') {


                    response.statusCode = 200;
                    response.write('Got it');
                    response.close();
                }
                else {
                    logger.warn("Unrecognized request to server");

                    response.statusCode = 400;
                    response.write('unrecognized request');
                    response.close();
                }
            });
            logger.info('Crawler webserver started on port ' + webserverSlavePort);

        } catch (err) {
            logger.error('Error while opening webserver on web crawler side.\nError: ' + err);
            throw err;
        }
    };

    // ================================================================================================================
}

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

function JaxsnoopCrawler() {

    // ================================================================================================================
    this.jaxsnoopSettings = {};
    this.page = undefined;


    // ================================================================================================================
    this.rewriteSettings = function rewriteSettings (new_settings){
        this.jaxsnoopSettings = JSON.parse(new_settings);

        logger.debug("Rewrite settings in crawler.");
    };


    // ================================================================================================================
    this.createWebpage = function createWebpage() {

        this.page = webpage.create();
        
        this.page.onConsoleMessage = function (msg, line, file, level, functionName, timestamp) {
            logger.warn ('[Browser "' + crawlerUser + '" console] Script error. file: ' + file + ' line: ' + line + ' message: ' + msg);
        };
        this.page.onError = function(message, stack) {
            logger.warn ('[Browser "' + crawlerUser + '" console] Browser error. stack: ' + stack + ' message: ' + message);
        };
        this.page.viewportSize = { width: 1280, height: 600 };
    };


    // ================================================================================================================
    this.closeWebpage = function closeWebpage() {
        this.page.close();
    };


    // ================================================================================================================
    this.login = function login(page) {
        var promise = crawlerSettings.users[crawlerUser].login_function(page, crawlerUser);
        return promise;
    };


    // ================================================================================================================
    this.logout = function logout(page) {
        var promise = crawlerSettings.users[crawlerUser].logout_function(page);
        return promise;
    };


    // ================================================================================================================
    // 
    this.openNextUsersWebPageState = function openNextUsersWebPageState(/*here must be some parameter selecting action for opening new web page state*/) {
        var self = this;
        
        // Making user-step
        // By default I only logging in user
        var promise = self.login(self.page);
        // var promise = crawler_test_utils.openTestPage (self.page);
        // TODO: Not default behaviour (indeed making user-step)
        // 

        // Getting web-page model
        promise = promise.then((message) => {

            var jsonDOMtreeModel = self.page.evaluate(webPageModelGenerator.GenerateWebPageModel);
            var domTreeModelRoot = JSON.parse(jsonDOMtreeModel);

            debugLogger.log (JSON.stringify(domTreeModelRoot, null, 2));

            // TODO: pushing jsonDOMtreeModel into per-user behavioural graph
            // 
            
            return new Promise(function(res, rej) {res("success");});

        }, (err) => {
            logging.error('Error in opening next users web state: ' + err);
        });
        
        return promise;
    };


    // ================================================================================================================
    // This function looks on the current opened webpage in the crawler and already generated map of static actions for
    // current user and breaks it into independent blocks, making tree of this blocks.
    // The main goal of classification is to identify equal and similar DOM subtrees, so webcrawler will be able to not
    // trigger the same event several times
    // 
    // Types of similarities, which must be picket out
    //  1) similarities between pages (e.g. status bar (login, logout, settings, etc))
    //  2) similarities on one page (e.g. two forums on one webpage; crawler must be intrested to crawl only one of them)
    //  3) similar pages (e.g. habrahabr articles of different users)
    // 
    // To be able to differentiate different content, but with the same structure, some identifiers of removed duplicates
    // must be saved
    // 
    // Saved parts of DOM subtrees also must contain information about those elements, which has set on them different
    // event listeners, such as onclick, ...
    // 
    // Before clustering the current webpage, search for differences must be done, between previous webpage state and new
    // webpage state, and differences must be classified, but not whole webpage
    // 
    this.classifyWebpage = function classifyWebpage() {

    };
}

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
var jaxsnoopCrawler = new JaxsnoopCrawler ();

var jaxsnoopServer = new JaxsnoopServer ();
jaxsnoopServer.StartSlaveWebServer(jaxsnoopCrawler);

jaxsnoopCrawler.createWebpage();
jaxsnoopCrawler.openNextUsersWebPageState();
// jaxsnoopCrawler.closeWebpage();
