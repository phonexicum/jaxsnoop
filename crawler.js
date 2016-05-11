// This script executes in context of slimerjs

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
// We are limited with normal node packages functionality, because slimerjs and phantomjs - are not nodejs and have
// support drawbacks
// 
// Includes
// 

var system = require('system');
var webpage = require('webpage');
var fs = require('fs');
var webserver = require('webserver');

// var sleep = require(system.env.HOME + '/node_modules/sleep/index.js');

var lutils = require('./lutils.js');
var crawlerSettings = require('./settings_crawler.js');
var crawlerUser = system.env.USER_NAME;

var util = require('/usr/lib/node_modules/util-slimy/util.js');
var logger = new lutils.crawlerLogger(crawlerUser, crawlerSettings.logLevel);

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

function JaxsnoopServer (){

    // ================================================================================================================
    this.StartSlaveWebServer = function StartSlaveWebServer (jaxsnoopCrawler) {

        var webserverSlavePort = parseInt(system.env.PORT_CRAWLER);
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

        logger.info("Rewrite settings in crawler. ");// + util.inspect(this.jaxsnoopSettings, false, null));
    };

    // ================================================================================================================
    this.createWebpage = function createWebpage() {
        
        this.page = webpage.create();
        page.onConsoleMessage = function (msg) {
            console.log('[Browser "' + crawlerUser + ' console] ' + msg);
        };       

    };

    // ================================================================================================================
    this.closeWebpage = function closeWebpage() {
        this.page.close();
    };

    // ================================================================================================================
    this.login = function login() {

    };

    // ================================================================================================================
    this.logout = function logout() {

    };

    // ================================================================================================================
    // This function crawls the web-application generating the map (oriented graph with named edges) for the user, without
    // trigering state changing events (such as POST requests to server)
    // 
    this.crawlStaticActions = function crawlStaticActions() {

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
