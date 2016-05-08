// This script executes in context of slimerjs

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
// Includes
var system = require('system');
var webpage = require('webpage');
var fs = require('fs');
var webserver = require('webserver');

// var sleep = require(system.env.HOME + '/node_modules/sleep/index.js');

var lutils = require('./lutils.js');
var crawlerSettings = require('./settings_crawler.js');
var crawlerUser = system.env.USER_NAME;

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

function JaxSnoop (){

    // ================================================================================================================    
    this.jaxsnoopSettings = {};

    // ================================================================================================================
    this.RewriteSettings = function (new_settings){
        this.jaxsnoopSettings = JSON.parse(new_settings);
        lutils.log(this.jaxsnoopSettings);
    };

    // ================================================================================================================
    this.StartSlaveWebServer = function () {

        var webserverSlavePort = parseInt(system.env.PORT_CRAWLER);
        var webserverSlave = webserver.create();

        try {
            webserverSlave.listen(webserverSlavePort, function(request, response) {
                if (request.method == 'GET' && request.url == '/check_crawler') {
                    response.statusCode = 200;
                    response.write('I am alive');
                    response.close();
                }
                else if (request.method == 'POST' && request.url == '/set_settings') {
                    try{
                        RewriteSettings(request.post);
                        response.statusCode = 200;
                        response.write('');
                        response.close();
                    } catch (err){
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
                    response.statusCode = 400;
                    response.write('unrecognized response');
                    response.close();
                }
            });
            console.info('Crawler webserver started on port ' + webserverSlavePort);

        } catch (err) {
            console.log(lutils.colors.red('Error while opening webserver on web crawler side.\nError: ' + err));
            throw err;
        }
    };

    // ================================================================================================================
}

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

function jaxsnoopCrawler() {

    // ================================================================================================================
    this.page = undefined;

    // ================================================================================================================
    function createWebpage() {
        
        this.page = webpage.create();
        

    }

    // ================================================================================================================
    function login() {

    }
}


// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================

// var page = require('webpage').create();
// page.onConsoleMessage = function (msg) {
//     console.log('[Browser console] ' + msg);
// };

// ====================================================================================================================
// ====================================================================================================================
// ====================================================================================================================
var jaxSnoop = new JaxSnoop ();

jaxSnoop.StartSlaveWebServer();

// setTimeout(function(){slimer.exit();}, 1000);
// slimer.exit();