// This script executes in context of slimerjs

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
var crawlerUser = system.env.USER_NAME;

var util = require('/usr/lib/node_modules/util-slimy/util.js');
var logger = new slimer_utils.crawlerLogger(system.env.LOGGING_HOST, system.env.LOGGING_PORT, crawlerUser, crawlerSettings.loglevel);

// In slimerjs open returns Promise, and I am actively using this feature, but phantomjs is not working with it.
// That is why I probably run into not supporting phantom

// Possible python BeautifulSoup analogue to manipulate and parse DOM
// https://github.com/cheeriojs/cheerio - can not use it, because it uses htmlparser2 (the fastest parser there is for
// node) and it uses nodejs events, which is not implemented in neither phantomjs neither slimerjs
// Very-very pity I can not use it!

// https://github.com/laurentj/slimerjs/issues/478

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
function printTestLogMessages (){
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
}

// if (crawlerSettings.loglevel === 'debug')
//     printTestLogMessages();

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
                        jaxsnoopCrawler.RewriteSettings(request.post);
                        
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
    this.RewriteSettings = function RewriteSettings (new_settings){
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
    // This function crawls the web-application generating the map (oriented graph with named edges) for the user, without
    // trigering state changing events (such as POST requests to server)
    // 
    this.crawlStaticActions = function crawlStaticActions() { var self = this;
        // var map;
        
        var promise = self.login(self.page);
        // while (true)
        // {
        //     promise = promise.then(function (message){

        //         // get DOM and pass to classifyWebpage
        //         var content1 = self.page.evaluate(function(){
        //             console.log("shit");
        //             // console.log(document.getElementsByTagName("body")[0]);
        //             // return document.getElementsByTagName("body")[0].innerHTML;
        //         });
        //         // console.log(content1);

        //         return new Promise(function(res, rej) {res("success");});

        //     }, function (err) {
        //         logging.error('Error crawling the state: ' + err);
        //     });
        // }
        
        // promise = promise.then(function (message){
        //     console.log('before');
        //     return self.logout(self.page);
        // });
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
var jaxsnoopServer = new JaxsnoopServer ();
jaxsnoopServer.StartSlaveWebServer(jaxsnoopCrawler);

var jaxsnoopCrawler = new JaxsnoopCrawler ();
jaxsnoopCrawler.createWebpage();
jaxsnoopCrawler.crawlStaticActions();
// jaxsnoopCrawler.closeWebpage();
