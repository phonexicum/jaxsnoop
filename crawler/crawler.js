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
    ['-d', '--debug'],
    {help: 'detect debug mode for avoiding tcp debug port collisions', requied: false, defaultValue: 'false'}
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

const wdBy = webdriver.By, wdUntil = webdriver.until;

const crawlerSettings = require('../' + args.settings_file);
const crawlerLogger = require('../utils/logging.js').crawlerLogger(crawlerSettings.logLevel);

const utils = require('../utils/utils.js');
const tmplModel = require('../model/tmpl-model.js');
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
    shutdown() {
        this.browserClient.close();
        this.browserClient.quit();

        this._webProxyChild.kill('SIGTERM');
    }

    // ================================================================================================================
    _webProxySetup() {
        crawlerLogger.trace('Crawler', this.userName, '_webProxySetup started.');
        return new Promise((resolve, reject) => {
            this._webProxyChild = childProcess.fork(__dirname + '/proxy.js',
                                                    ['-l', crawlerSettings.logLevel],
                                                    args.debug === 'false' ?
                                                        {stdio: 'inherit'} :
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
        // let capabilities = webdriver.Capabilities.firefox() // chrome()
        //     .set(webdriver.Capability.ACCEPT_SSL_CERTS, true)
        //     .set(webdriver.Capability.SECURE_SSL, false);
        //     // .set(webdriver.Capability.PROXY, proxyConfig);
        //     // .setProxy(proxyConfig);

        this.browserClient = new webdriver.Builder()
            // .withCapabilities(capabilities) // err: Does not work properly

            // There is some problems with chrome and my handwritten proxy, there is some network problems and it works unstable
            .forBrowser('chrome')
            .setChromeOptions(chromeOptions)
            
            // Firefox proxy problems: http://stackoverflow.com/questions/41089511/getting-request-and-response-using-browsermobproxy-selenium-firefox-marionett/41373808#41373808
            //      it is needed to use selenium of version not more then 3.0.0-beta-3
            // .forBrowser('firefox')
            // .setFirefoxOptions(firefoxOptions)

            // .setProxy(wdProxy.manual({
            //     http: this._webProxyIP + ':' + this._webProxyPort,
            //     https: this._webProxyIP + ':' + this._webProxyPort
            // })) // This does not work properly
            .usingServer('http://localhost:4444/wd/hub')
            .build();
        
        // this.browserClient.manage().window().setSize(1000,600);

        crawlerLogger.trace('Crawler', this.userName, '_webDriverSetup success.');
    }

    // ================================================================================================================
    waitFullPageLoad() {
        this.browserClient.wait(() => {
            return this.browserClient.executeScript(function(){
                return document.readyState === 'complete';
            });
        });
    }

    // ================================================================================================================
    login() {
        return crawlerSettings.users[this.userName].login(this.browserClient);
    }

    // ================================================================================================================
    logout() {
        return crawlerSettings.users[this.userName].logout(this.browserClient);
    }

    // ================================================================================================================
    // This function returns selenium-promise
    snapshotingDom() {
        return this.browserClient.executeScript(GenerateDOMCopy,
            utils.yieldTreeNodes, 'function ' + tmplModel.NodeProcessing.getDomNodeDraft.toString(),
            nodeHandlers.checkNodeIsBlacklisted, nodeHandlers.getPropertiesOfDOMnode)
            .then((result) => {
                return JSON.parse(result);
            });
    }

    // ================================================================================================================
}


// ====================================================================================================================
class CrawlingCtrl {

    // ================================================================================================================
    constructor () {
        crawlerLogger.trace('Create web-crawler instances.');
        
        this.webCrawlers = [];
        for (let userName in crawlerSettings.users) {
            let webCrawler = new Crawler(userName);
            this.webCrawlers.push(webCrawler);
        }
    }

    // ================================================================================================================
    setupWebBrowsers () {
        crawlerLogger.info('Setup web-crawlers (browser\'s web-drivers).');

        return Promise.all(this.webCrawlers.map(webCrawler => webCrawler.setup()))
        .then(results => {
            return Promise.all(this.webCrawlers.map(webCrawler => webCrawler.login()));
        })
        .catch(error => {
            crawlerLogger.fatal('Fatal Error setting up web-crawlers: ', error);
            throw 'setupWebBrowsers error';
        });
    }

    // ================================================================================================================
    shutdownWebBrowsers () {
        crawlerLogger.info('Shutting down web-crawlers (browser\'s web-drivers).');

        return Promise.all(this.webCrawlers.map(webCrawler => webCrawler.shutdown()))
        .catch(error => {
            crawlerLogger.error('Error shutting down web-crawlers: ', error);
            throw 'shutdownWebBrowsers error';
        });
    }
    

    // ================================================================================================================
    // crawler - element of this.webCrawlers
    crawlCurrentWebAppState(webCrawler){
        return new Promise ((resolve, reject) => {

            let workflow = webCrawler.browserClient.get(crawlerSettings.homePageUrl);
            // this.browserClient.get('file:///home/avasilenko/Desktop/jaxsnoop/test/_resources/test-dom.html');

            let i_pstate = 0;

            let webAppState = {
                num: i_pstate,
                tmplSet: new Set() // add, delete, has, clear
            };

            let maxDepth = 10;

            // while (true) {
            {

                workflow = workflow.then(() => webCrawler.snapshotingDom())
                .then(domModel => {
                    // console.log(JSON.stringify(domModel.domSnapshot));
                    // console.log(
                    //     WebAppTmplModel.rebuildDom({
                    //         type: 'webPage',
                    //         name: '-1',
                    //         url: domModel.url,
                    //         domRoot: domModel.domSnapshot
                    //     })[0].dom
                    // );
                    
                    let webPageModel = this.webAppTmplModel.addDomModel(domModel);




                    // this.webAppTmplModel.dumpWebAppTmplModel('./_html/');
                })
                .then(() => {
                    console.log('client ready');
                    global.gc();
                    resolve();
                });
            }
        });
    }

    // ================================================================================================================
    startCrawling(webCrawlers) {
        crawlerLogger.info('Starting crawling process.');

        this.webAppTmplModel = new tmplModel.WebAppTmplModel();

        this.i_pstate = 0;



        let promise = Promise.all(this.webCrawlers.map(webCrawler => this.crawlCurrentWebAppState(webCrawler)));

        promise = promise.then(() => {
            crawlerLogger.info('End crawling process.');
        })
        .catch((err) => {
            crawlerLogger.fatal('Error while crawling web-application.');
        });

        return promise;
    }

    // ================================================================================================================
}

module.exports = {
    CrawlingCtrl: CrawlingCtrl,
    Crawler: Crawler
};
