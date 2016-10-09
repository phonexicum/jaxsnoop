// Main jaxsnoop crawler script
// 
// Execution context: slimerjs

// We are limited with normal node packages functionality, because slimerjs and phantomjs - are not nodejs and have support drawbacks

// ==================================================================================================================================================
//                                                                                                                                           Includes
// ==================================================================================================================================================
var system = require('system');
var webpage = require('webpage');
var fs = require('fs');
var webserver = require('webserver');

var jqgram = require('./node_modules/jqgram/index.js');

var slimer_utils = require('./utils/slimer_utils.js');
var crawlerSettings = require(system.env.CRAWLER_SETTINGS_PATH);
var crawler_test_utils = require('./test/crawler_test_utils.js');


// ==================================================================================================================================================
//                                                                                                                                              Setup
// ==================================================================================================================================================
var crawlerUser = system.env.USER_NAME;

var logger = new slimer_utils.crawlerLogger(system.env.LOGGING_HOST, system.env.LOGGING_PORT, crawlerUser, crawlerSettings.loglevel);
var debugLogger = new slimer_utils.crawlerDebugLogger("./log/debug_log.log");

var webPageModelGenerator = require('./crawler_routine/web_page_model_generator.js');


// ==================================================================================================================================================
//                                                                                                                                      Runtime tests
// ==================================================================================================================================================
// if (crawlerSettings.loglevel === 'debug')
//     crawler_test_utils.testCrawlerLogSystem();


// ==================================================================================================================================================
//                                                                                                                                     JaxsnoopServer
// ==================================================================================================================================================
function JaxsnoopServer (){
}


// ==================================================================================================================================================
//                                                                                                                                    JaxsnoopCrawler
// ==================================================================================================================================================
function JaxsnoopCrawler(){

    this.page = undefined;
    this.userWebApplicationState_Root = {};
    this.userWebApplicationState_NodeNumbers = 0;
    this.userWebApplicationState_CurrentNode = this.userWebApplicationState_Root;
}

// ==================================================================================================================================================
//                                                                                                                         PageEventHandlersContainer
// ==================================================================================================================================================
function PageEventHandlersContainer(){
    
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

// ==================================================================================================================================================
//                                                                                                                                               MAIN
// ==================================================================================================================================================
function MAIN (){
    var jaxsnoopCrawler = new JaxsnoopCrawler ();

    var jaxsnoopServer = new JaxsnoopServer ();
    jaxsnoopServer.StartSlaveWebServer(jaxsnoopCrawler);

    jaxsnoopCrawler.createWebpage();
    jaxsnoopCrawler.openNextUsersWebPageState();
    // jaxsnoopCrawler.closeWebpage();
}


// ==================================================================================================================================================
// ==================================================================================================================================================
//                                                                                                                                      CLASS METHODS
// ==================================================================================================================================================
// ==================================================================================================================================================


// ==================================================================================================================================================
//                                                                                                                     JaxsnoopCrawler::createWebpage
// ==================================================================================================================================================
// 
// Creation of slimerjs webpage and initialization of its parameters (e.g. various callbacks, page size, ...)
// 
JaxsnoopCrawler.prototype.createWebpage = function createWebpage(){

    this.page = webpage.create();

    this.page.onInitialized = new PageEventHandlersContainer();
    this.page.onLoadStarted = new PageEventHandlersContainer();
    this.page.onLoadFinished = new PageEventHandlersContainer();

    this.page.onUrlChanged = new PageEventHandlersContainer();

    this.page.onNavigationRequested = new PageEventHandlersContainer();
    this.page.onResourceRequested = new PageEventHandlersContainer();
    this.page.onResourceReceived = new PageEventHandlersContainer();

    this.page.onResourceError = new PageEventHandlersContainer();
    this.page.onResourceTimeout = new PageEventHandlersContainer();


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
    this.page.onResourceError.addHandler("logPurpose", function(resourceErr){
        logger.trace("onResourceError id:" + resourceErr.id + " " + resourceErr.url + " " + resourceErr.errorCode + " " + resourceErr.errorString);
    });
    this.page.onResourceTimeout.addHandler("logPurpose", function(resourceErr){
        logger.trace("onResourceTimeout id:" + resourceErr.id + " " + resourceErr.method + " " + resourceErr.url + " " + resourceErr.errorCode + " " + resourceErr.errorString);
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


// ==================================================================================================================================================
//                                                                                                                      JaxsnoopCrawler::closeWebpage
// ==================================================================================================================================================
// 
// Closing slimerjs webpage
// 
JaxsnoopCrawler.prototype.closeWebpage = function closeWebpage(){
    this.page.close();
};


// ==================================================================================================================================================
//                                                                                                                JaxsnoopCrawler::setRequestsFilters
// ==================================================================================================================================================
// 
// Adding to webpage url requests filtering, using whitelist from user settings
// 
JaxsnoopCrawler.prototype.setRequestsFilters = function setRequestsFilters(){

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


// ==================================================================================================================================================
//                                                                                                                  JaxsnoopCrawler::waitFullPageLoad
// ==================================================================================================================================================
// 
// This function monitors network activity through slimerjs webpage callbacks.
//      if ( there is no resources, to be received, meaning that all requests had been satisfied    and
//           if possible urlChanged event has been followed by loadFinished event               )   then
//      it is suggested, that all browser activities has been executed and webpage analysis can be continued
//      
//      if conditions are not fullfilled then crawler will wait for crawlerSettings.maxWaitForFullPageLoadTime amount of time
//      and if nothing happens, it will be also suggested, that browser executed all immidiate activities
// 
// ASSUMPTION:
//      I expect browser to be ready immidiately after any undertaken user action, in assumption that webpage scripts will be performed before
//      returning back into master-script (this one), though the only reason, why webpage can be unready is - network queries, therefore this
//      function monitors network activities.
// 
JaxsnoopCrawler.prototype.waitFullPageLoad = function waitFullPageLoad(promise){
    var self = this;

    return promise.then(function(status){
        return new Promise (function(res, rej){
            if (status === "success"){

                // Network was touched, though we must wait until page will do everything it needs
                //      on every onResourceRequested there must be approprite onResoruceReceived
                //      after onUrlChanged there must be some onLoadFinished
                
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


// ==================================================================================================================================================
//                                                                                                                             JaxsnoopCrawler::login
// ==================================================================================================================================================
// 
// Login user using function given in user settings and waiting browser to finish all activities following login process
// 
JaxsnoopCrawler.prototype.login = function login(page){

    // Listening network, by monitoring event page.onNavigationRequested (maybe it is wise to also capture
    //      page.onLoadStarted and page.onResourceRequested)
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


// ==================================================================================================================================================
//                                                                                                                            JaxsnoopCrawler::logout
// ==================================================================================================================================================
// 
// Logout user using function given in user settings and waiting browser to finish all activities following logout process
// 
JaxsnoopCrawler.prototype.logout = function logout(page){

    // Listening network, by monitoring event page.onNavigationRequested (maybe it is wise to also capture
    //      page.onLoadStarted and page.onResourceRequested)
    var networkUsed = false;
    page.onNavigationRequested.addHandler("monitorNetworkActivity", function(url, type, willNavigate, main){
        networkUsed = true;
    }, true);


    var promise = crawlerSettings.users[crawlerUser].logout_function(page);


    if (networkUsed === true){
        console.log("Network used !!!");
        promise = this.waitFullPageLoad(promise);
    }

    return promise;
};


// ==================================================================================================================================================
//                                                                                                         JaxsnoopCrawler::openNextUsersWebPageState
// ==================================================================================================================================================
JaxsnoopCrawler.prototype.openNextUsersWebPageState = function openNextUsersWebPageState(/*some parameter selecting action for opening new web page state*/) {
    var self = this;
    
    // Making user-step
    // By default I only logging in user
    // var promise = self.login(self.page);
    var promise = crawler_test_utils.openTestPage (self.page);

    // TODO: Not default behaviour (indeed making user-step)
    // 

    // Getting web-page model
    promise = promise.then((message) => {

        var jsonUsersWebPageState = self.page.evaluate(webPageModelGenerator.GenerateWebPageModel);
        var usersWebPageState = JSON.parse(jsonUsersWebPageState);

        debugLogger.log (JSON.stringify(usersWebPageState, null, 2));
        
        this.domTreeModelConvolution(usersWebPageState);

        return new Promise(function(res, rej) {res("success");});

    }, (err) => {
        logging.error('Error in opening next users web state: ' + err);
    });
    
    return promise;
};


// ==================================================================================================================================================
//                                                                                                           JaxsnoopCrawler::domTreeModelConvolution
// ==================================================================================================================================================
// 
// function must detect similarities:
//      1) similarities on one page (e.g. two forums on one webpage; crawler must be interested to crawl only one of them)
//      2) similar pages (e.g. habrahabr articles of different users)
//      3) similarities between pages (e.g. status bar (login, logout, settings, etc))
// 
JaxsnoopCrawler.prototype.domTreeModelConvolution = function domTreeModelConvolution(usersWebPageState){

    var userWebAppCurrentNode = {
        nodeNumber: undefined,
        url: usersWebPageState.url,
        domTreeModel: usersWebPageState.domTreeModel
    };



};


// ==================================================================================================================================================
//                                                                                                                   JaxsnoopCrawler::classifyWebpage
// ==================================================================================================================================================
// 
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
JaxsnoopCrawler.prototype.classifyWebpage = function classifyWebpage() {

};


// ==================================================================================================================================================
//                                                                                                                JaxsnoopServer::StartSlaveWebServer
// ==================================================================================================================================================
// 
// starting listening for incoming commands from crawler controller.
// 
JaxsnoopServer.prototype.StartSlaveWebServer = function StartSlaveWebServer (jaxsnoopCrawler) {

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

// ==================================================================================================================================================
// ==================================================================================================================================================
MAIN();
