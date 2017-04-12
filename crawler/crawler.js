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
const args = argparse.parseArgs();

// ====================================================================================================================
// Includes & Setup

const childProcess = require('child_process');

// const webdriverio = require('webdriverio');
const webdriver = require('selenium-webdriver'),
    wdCapabilities = require('selenium-webdriver/lib/capabilities'),
    wdProxy = require('selenium-webdriver/lib/proxy'),
    chrome = require('selenium-webdriver/chrome'),
    firefox = require('selenium-webdriver/firefox');

const wdBy = webdriver.By,
    wdUntil = webdriver.until;

const crawlerSettings = require('../' + args.settings_file);
const crawlerLogger = require('../utils/logging.js').crawlerLogger(crawlerSettings.logLevel);

const utils = require('../utils/utils.js');
const model = require('../model/model.js');
const nodeHandlers = require('../model/node-handlers.js');

const GenerateDOMCopy = require('./copying-DOM.js').GenerateDOMCopy;


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
        .catch(error => {
            crawlerLogger.error('Error setting up crawler', this.userName);
            return Promise.reject(error);
        });
    }

    // ================================================================================================================
    _webProxySetup() {
        crawlerLogger.trace('Crawler', this.userName, '_webProxySetup started.');
        return new Promise((resolve, reject) => {
            this._webProxyChild = childProcess.fork(__dirname + '/proxy.js',
                                                    ['-l', crawlerSettings.logLevel],
                                                    {stdio: 'inherit', execArgv: ['--debug=' + 5859]} // Solves problems with debugging ports
                                                   );

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
        
        let proxyConfig = new wdCapabilities.ProxyConfig();
        proxyConfig.proxyType = 'MANUAL';
        proxyConfig.httpProxy = this._webProxyIP + ':' + this._webProxyPort;
        proxyConfig.sslProxy = this._webProxyIP + ':' + this._webProxyPort;

        let proxyObj = {
            'proxyType': 'MANUAL',
            'httpProxy': this._webProxyIP,
            'httpProxyPort': parseInt(this._webProxyPort),
            'sslProxy': this._webProxyIP,
            'sslProxyPort': parseInt(this._webProxyPort)
        };

        let chromeOptions = new chrome.Options()
            .addArguments([
                // '--disable-web-security',                            // disable SOP
                // '--enable-potentially-annoying-security-features',   // Enables a number of potentially annoying security features (strict mixed content mode, powerful feature restrictions, etc.)
                // '--reduce-security-for-testing',                     // Enables more web features over insecure connections. Designed to be used for testing purposes only.
                // '--translate-security-origin',                       // Overrides security-origin with which Translate runs in an isolated world.
                // '--ssl-version-min=tls1',                            // Specifies the minimum SSL/TLS version ("tls1", "tls1.1", "tls1.2", or "tls1.3").
                '--window-size=1000,600',
                '--allow-insecure-localhost',                           // Enables TLS/SSL errors on localhost to be ignored (no interstitial, no blocking of requests).
                '--ignore-certificate-errors'
            ])
            .setProxy(proxyConfig)
            .setUserPreferences({
                'profile.managed_default_content_settings.images': 2
            });

        // err: Does not work properly
        // let firefoxBinary = new firefox.Binary();
        //     firefoxBinary.addArguments([
        //         // '--window-size=1000,600',
        //         // '--load-images=no',
        //         '--jsconsole'
        //     ]);
        let firefoxProfile = new firefox.Profile();
            firefoxProfile.setPreference('permissions.default.image', 2);
            firefoxProfile.setPreference('dom.ipc.plugins.enabled.libflashplayer.so', false);
            // firefoxProfile.setPreference('permissions.default.stylesheet', 2);

            firefoxProfile.setPreference('network.proxy.type', 1);
            firefoxProfile.setPreference('network.proxy.no_proxies_on', '');
            firefoxProfile.setPreference('network.proxy.http', this._webProxyIP);
            firefoxProfile.setPreference('network.proxy.http_port', this._webProxyPort);
            firefoxProfile.setPreference('network.proxy.ssl', this._webProxyIP);
            firefoxProfile.setPreference('network.proxy.ssl_port', this._webProxyPort);

            firefoxProfile.setAcceptUntrustedCerts(true);
            firefoxProfile.setAssumeUntrustedCertIssuer(true);
        let firefoxOptions = new firefox.Options()
            .setProfile(firefoxProfile);
            // .setBinary(firefoxBinary)   // err: Does not work properly, can not set arguments
            // .setProxy(proxyConfig);     // err: Does not work properly, can not set proxy

        // err: Does not work properly, can not set proxy
        // let capabilities = webdriver.Capabilities.firefox()
        //     // .set(webdriver.Capability.ACCEPT_SSL_CERTS, true)
        //     // .set(webdriver.Capability.SECURE_SSL, false)
        //     .set(webdriver.Capability.PROXY, proxyConfig);
        //     // .setProxy(proxyConfig);

        this._browserClient = new webdriver.Builder()
            // .withCapabilities(capabilities) // err: Does not work properly

            // There is some problems with chrome and my handwritten proxy, there is some network problems and it works unstable
            // .forBrowser('chrome')
            // .setChromeOptions(chromeOptions)
            
            // Firefox proxy problems: http://stackoverflow.com/questions/41089511/getting-request-and-response-using-browsermobproxy-selenium-firefox-marionett/41373808#41373808
            .forBrowser('firefox')
            .setFirefoxOptions(firefoxOptions)

            // .setProxy(wdProxy.manual({
            //     http: this._webProxyIP + ':' + this._webProxyPort,
            //     https: this._webProxyIP + ':' + this._webProxyPort
            // })) // This does not work properly
            .usingServer('http://localhost:4444/wd/hub')
            .build();
        
        // this._browserClient.manage().window().setSize(1000,600);

        crawlerLogger.trace('Crawler', this.userName, '_webDriverSetup success.');
    }

    // ================================================================================================================
    listenCommands() {
        crawlerLogger.trace('Command for crawling web-application came.');

        let webAppModel = new model.WebAppModel();

        // this.logout();
        // this.login();

        // this._browserClient.get(crawlerSettings.homePageUrl);
        this._browserClient.get('file:///home/avasilenko/Desktop/jaxsnoop/test/_resources/test1-dom.html');

        this.snapshotingDom()
        .then(domModel => {
            // console.log(JSON.stringify(domModel.domSnapshot, null, 2));
            console.log(
                webAppModel.rebuildDom({
                    type: 'webPage',
                    name: '-1',
                    url: domModel.url,
                    domRoot: domModel.domSnapshot
                })[0].dom
            );
            
            webAppModel.addDomModel(domModel);
            console.log(webAppModel.rebuildDom(webAppModel.webAppPageList[0])[0].dom);
        });

        this._browserClient.controlFlow().execute(result => {
            console.log('client ready');
            global.gc();
        });

        this._browserClient.close();
        this._browserClient.quit();

        // this._browserClient.get('http://www.google.com/ncr');
        // this._browserClient.findElement(wdBy.name('q')).sendKeys('webdriver', webdriver.Key.ENTER);
        // // this._browserClient.findElement(wdBy.name('btnG')).click();
        // this._browserClient.wait(wdUntil.titleIs('webdriver - Google Search'), 1000);
        // this._browserClient.quit();

        // this._browserClient
        //     .init()
        //     .url('http://duckduckgo.com/')
        //     .setValue('#search_form_input_homepage', 'WebdriverIO')        
        //     .click('#search_button_homepage')
        //     .getTitle().then(function(title) {
        //         console.log('Title is: ' + title);
        //     })
        //     .end();

        // setTimeout(()=>{
        //     process.send({
        //         report: 'crawlingDone',
        //         cycleNum: m.cycleNum
        //     });
        // }, 1000);
    }

    // ================================================================================================================
    waitFullPageLoad() {
        this._browserClient.wait(() => {
            return this._browserClient.executeScript(function(){
                return document.readyState === 'complete';
            });
        });
    }

    // ================================================================================================================
    login() {
        crawlerSettings.users[this.userName].login(this._browserClient, this.userName);
    }

    // ================================================================================================================
    logout() {
        crawlerSettings.users[this.userName].logout(this._browserClient);
    }

    // ================================================================================================================
    // This function returns selenium-promise
    snapshotingDom() {
        return this._browserClient.executeScript(GenerateDOMCopy,
            utils.yieldTreeNodes, 'function ' + model.NodeProcessing.getDomNodeDraft.toString(),
            nodeHandlers.checkNodeIsBlacklisted, nodeHandlers.getPropertiesOfDOMnode);
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
})
.catch(error => {
    crawlerLogger.error('Fatal Error setting up crawler:', error);
});








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
