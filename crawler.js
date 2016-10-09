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
                // else if (request.method == 'POST' && request.url == '/set_settings') {
                //     try{
                //         jaxsnoopCrawler.rewriteSettings(request.post);
                //         logger.info("settings written successfully");
                        
                //         response.statusCode = 200;
                //         response.write('');
                //         response.close();

                //     } catch (err){
                //         logger.error("Error while setting new settings " + err);

                //         response.statusCode = 400;
                //         response.write('Error: ' + err);
                //         response.close();
                //     }
                // }
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
    // this.jaxsnoopSettings = {};
    this.page = undefined;


    // // ================================================================================================================
    // this.rewriteSettings = function rewriteSettings (new_settings){
    //     this.jaxsnoopSettings = JSON.parse(new_settings);

    //     logger.debug("Rewrite settings in crawler.");
    // };

    // ================================================================================================================
    this.setRequestsFilters = function setRequestsFilters (){

        this.page.onResourceRequested.addHandler("filterWhiteListResources", function (requestData, networkRequest) {

            // console.log('Resource requested: ' + requestData.id + " " + requestData.method + " " + requestData.url);

            if (! crawlerSettings.url_whitelist.some(function (val, i, arr){
                    return val.test(requestData.url);
                }) ){
                logger.debug('Request dropped: "' + JSON.stringify(requestData) + '"');
                networkRequest.abort();
            }

        });
    };

    // ================================================================================================================
    this.waitFullPageLoad = function waitFullPageLoad (promise){
        var self = this;

        return promise.then(function(status){

            return new Promise (function(res, rej){

                if (status === "success"){

                    // Network was touched, though we must wait untill page will do everything it needs
                    //  on every onResourceRequested there must be approprite onResoruceReceived
                    //  after onUrlChanged there must be some onLoadFinished
                    
                    var lastRequestedResource = 1;
                    var requestedResourceBalance = false;

                    var pageFinishedLoading = true;

                    // Timer is used to resolve promise if network is not used for some fixed period of time
                    var installTimeout = function installTimeout (){
                        return setTimeout(function(){
                            logger.error("Too many time passed after last network communication, can not wait for waitFullPageLoad longer. RESOLVING promise in expectation that browser is ready.");
                            res('success');
                        }, crawlerSettings.maxWaitForFullPageLoadTime);
                    };
                    var timer = installTimeout();

                    var checkIfNetworkExchangeIsBalanced = function checkIfNetworkExchangeIsBalanced (){
                        if (requestedResourceBalance === true && pageFinishedLoading === true){
                            clearTimeout(timer);

                            self.page.onResourceRequested.removeHandler("monitorRequestedResourceBalance");
                            self.page.onResourceReceived.removeHandler("monitorRequestedResourceBalance");
                            self.page.onUrlChanged.removeHandler("monitorBrowserLoadingBehaviour");
                            self.page.onLoadFinished.removeHandler("monitorBrowserLoadingBehaviour");
                            res("success");
                        }
                    };

                    self.page.onResourceRequested.addHandler("monitorRequestedResourceBalance", function(requestData, networkRequest){
                        clearTimeout(timer); timer = installTimeout();

                        if (requestData.id > lastRequestedResource){
                            lastRequestedResource = requestData.id;
                            requestedResourceBalance = false;
                        } else {
                            // Probably this will never happen
                            console.log("onResourceRequested ids came in wrong order, is it possible?");
                        }
                    });
                    self.page.onResourceReceived.addHandler("monitorRequestedResourceBalance", function(response){
                        clearTimeout(timer); timer = installTimeout();

                        if (response.stage === "end" && response.id === lastRequestedResource){
                            requestedResourceBalance = true;
                            checkIfNetworkExchangeIsBalanced();
                        }
                    });

                    self.page.onUrlChanged.addHandler("monitorBrowserLoadingBehaviour", function(targetUrl){
                        clearTimeout(timer); timer = installTimeout();

                        pageFinishedLoading = false;
                    });
                    self.page.onLoadFinished.addHandler("monitorBrowserLoadingBehaviour", function(status, url, isFrame){
                        clearTimeout(timer); timer = installTimeout();

                        if (isFrame === false){
                            pageFinishedLoading = true;
                            checkIfNetworkExchangeIsBalanced();
                        }
                    });
                } else {
                    rej(status);
                }
            });
        });

    };


    // ================================================================================================================
    this.createWebpage = function createWebpage() {

        function pageEventHandlersContainer(){
            
            var handlers = {};

            this.addHandler = function addHandler(callback_name, callback, one_time_callback = false) {
                if (handlers.hasOwnProperty(callback_name) === true){
                    logger.fatal("Handler with name '" + callback_name + "' already exists. The handler will NOT be overwritten.");
                } else {
                    handlers[callback_name] = {
                        'one_time': one_time_callback,
                        'callback': callback
                    };
                }
            };

            this.removeHandler = function removeHandler(callback_name) {
                delete handlers[callback_name];
            };

            this.apply = function apply(this_arg, argsArray){

                Object.keys(handlers).forEach(function(key){

                    handlers[key].callback.apply(this_arg, argsArray);

                    // There is a chance, that callback removed itself from handlers by calling removeHandler method
                    if (handlers.hasOwnProperty(key) && handlers[key].one_time === true){
                        delete handlers[key];
                    }

                });
            };
        }

        this.page = webpage.create();

        this.page.onInitialized = new pageEventHandlersContainer();
        this.page.onLoadStarted = new pageEventHandlersContainer();
        this.page.onLoadFinished = new pageEventHandlersContainer();

        this.page.onUrlChanged = new pageEventHandlersContainer();

        this.page.onNavigationRequested = new pageEventHandlersContainer();
        this.page.onResourceRequested = new pageEventHandlersContainer();
        this.page.onResourceReceived = new pageEventHandlersContainer();
        // onResourceError, onResourceTimeout

        this.page.onInitialized.addHandler("logPurpose", function(){
            logger.trace("onInitialized");
        });
        this.page.onLoadStarted.addHandler("logPurpose", function(url, isFrame){
            logger.trace("onLoadStarted " + url + " isFrame:" + isFrame);
        });
        this.page.onLoadFinished.addHandler("logPurpose", function(status, url, isFrame){
            logger.trace("onLoadFinished " + status + " " + url + " isFrame:" + isFrame);
        });
        this.page.onUrlChanged.addHandler("logPurpose", function(targetUrl){
            logger.trace("onUrlChanged " + targetUrl);
        });
        this.page.onNavigationRequested.addHandler("logPurpose", function(url, type, willNavigate, main){
            logger.trace("onNavigationRequested " + type + " " + url + " navigationNotBlocked:" + willNavigate + " fromMainWindow:" + main);
        });
        this.page.onResourceRequested.addHandler("logPurpose", function(requestData, networkRequest){
            logger.trace("onResourceRequested #" + requestData.id + " " + requestData.method + " " + requestData.url);
        });
        this.page.onResourceReceived.addHandler("logPurpose", function(response){
            logger.trace("onResourceReceived #" + response.id + " " + response.stage + " " + response.status + " " + response.url);
        });

        this.page.onConsoleMessage = function (msg, line, file, level, functionName, timestamp) {
            logger.warn ('[Browser "' + crawlerUser + '" console] Script error. file: ' + file + ' line: ' + line + ' message: ' + msg);
        };
        this.page.onError = function(message, stack) {
            logger.warn ('[Browser "' + crawlerUser + '" console] Browser error. stack: ' + stack + ' message: ' + message);
        };

        this.setRequestsFilters();
        this.page.viewportSize = { width: 1280, height: 600 };
    };


    // ================================================================================================================
    this.closeWebpage = function closeWebpage() {
        this.page.close();
    };


    // ================================================================================================================
    this.login = function login(page) {

        // Listen network, if our actions triggered page.onNavigationRequested (maybe it is wise to also capture page.onLoadStarted and page.onResourceRequested)
        var networkUsed = false;
        page.onNavigationRequested.addHandler("monitorNetworkActivity", function(url, type, willNavigate, main){
            networkUsed = true;
        }, true);

        var promise = crawlerSettings.users[crawlerUser].login_function(page, crawlerUser);

        if (networkUsed === true){
            console.log("Network used !!!");
            promise = this.waitFullPageLoad(promise);
        }

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
