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
    firefox = require('selenium-webdriver/firefox'),
    wdError = require('selenium-webdriver/lib/error');

const wdBy = webdriver.By, wdUntil = webdriver.until;

const crawlerSettings = require('../' + args.settings_file);
const crawlerLogger = require('../utils/logging.js').crawlerLogger(crawlerSettings.logLevel);

const utils = require('../utils/utils.js');
const tmplModel = require('../model/tmpl-model.js');
const nodeHandlers = require('../model/node-handlers.js');
const clickSearcher = require('./click-searcher.js')

const browserUtils = require('./browser-utils.js');


// ====================================================================================================================
var fillingValue = 10000000000;

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
        this._webProxyChild.kill('SIGTERM');
        return this.browserClient.close()
        .then(() => {
            return this.browserClient.quit();
        });
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
    disablePosts() {
        return new Promise((res, rej) => {
            let handler;
            handler = m => {
                if (m.report === 'forbid-posts') {
                    this._webProxyChild.removeListener('message', handler);
                    res();
                }
            };
            this._webProxyChild.on('message', handler);
            this._webProxyChild.send({command:'forbid-posts'});
        });
    }

    // ================================================================================================================
    enablePosts() {
        return new Promise((res, rej) => {
            let handler;
            handler = m => {
                if (m.report === 'allow-posts') {
                    this._webProxyChild.removeListener('message', handler);
                    res();
                }
            };
            this._webProxyChild.on('message', handler);
            this._webProxyChild.send({command:'allow-posts'});
        });
    }

    // ================================================================================================================
    dropPostsCounter() {
        return new Promise((res, rej) => {
            let handler;
            handler = m => {
                if (m.report === 'drop-posts-counter') {
                    this._webProxyChild.removeListener('message', handler);
                    res();
                }
            };
            this._webProxyChild.on('message', handler);
            this._webProxyChild.send({command:'drop-posts-counter'});
        });
    }

    // ================================================================================================================
    getPostsCounter() {
        return new Promise((res, rej) => {
            let handler;
            handler = m => {
                if (m.report === 'posts-counter') {
                    this._webProxyChild.removeListener('message', handler);
                    res(m.postsCounter);
                }
            };
            this._webProxyChild.on('message', handler);
            this._webProxyChild.send({command:'get-posts-counter'});
        });
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
        return this.browserClient.executeScript(browserUtils.generateDOMCopy,
            utils.yieldTreeNodes, 'function ' + tmplModel.NodeProcessing.getDomNodeDraft.toString(),
            nodeHandlers.checkNodeIsBlacklisted, nodeHandlers.getPropertiesOfDOMnode)
            .then((result) => {
                return JSON.parse(result);
            });
    }

    // ================================================================================================================
    performAction(css, clk_i, model_node) {
        console.log(css);
        let clk_name = model_node.clickables[clk_i].clk;
        let elem = undefined;

        return Promise.resolve()
        .then(() => {
            return this.browserClient.findElements(wdBy.css(css));
        })
        .then(elems => {
            // Find all elements fitting to css, and displayed (clicks on non-displayed elements will trigger error in selenium)
            
            console.log(elems.length);
            
            let i = 0;
            return utils.promise_for(() => i < elems.length, () => {i++;}, (res, rej) => {
                return elems[i].isDisplayed()
                .then(isDisplayed => {
                    if (isDisplayed) {
                        elem = elems[i];
                        rej(); // elem found, stop promise_for
                    } else {
                        res(); // continue cycle promise_for
                    }
                });
            });
        })
        .then(() => {
            if (elem === undefined) {
                crawlerLogger.warn('Cannot find displayed element, defined by css: "' + css + '" to make click action: ' + clk_name);
                throw new Error('click-failed'); // Recoverable error
            }
        }, () => {
            if (elem === undefined) {
                crawlerLogger.warn('Cannot find displayed element, defined by css: "' + css + '" to make click action: ' + clk_name);
                throw new Error('click-failed'); // Recoverable error
            }
        })
        .then(() => {
            // Color all elements fitting to passed css
            return this.browserClient.executeScript(function(css) {
                for (let node of document.body.querySelectorAll(css)) {
                    node.style.color = 'black';
                    node.style.backgroundColor = 'red';
                }
            }, css);
        })
        .then(() => {
            // Sleep a little before clicking element
            return this.browserClient.sleep(0 * 1000);
        })
        .then(() => {

            // Click element
            if (clk_name === 'a') {
                return elem.click();
            } else if (clk_name === 'onclick') {
                return elem.click();
            } else if (clk_name === 'input_submit') {
                return this.browserClient.executeScript(browserUtils.fillTheForm, css, fillingValue)
                .then((fillingValueAdd) => {
                    fillingValue += fillingValueAdd;
                    elem.click();
                });
            }
        });
    }

    // ================================================================================================================
    autoAcceptAlert() {
        return this.browserClient.switchTo().alert()
        .then(alert => {
            return alert.accept();
        }, err => {
            if (err instanceof wdError.NoSuchAlertError) {
                // Everything is okey, there is no alert window to be closed
            } else { throw err; }
        })
    }


    // ================================================================================================================
    closeHandlesButHandle(handle) {
        return this.browserClient.getAllWindowHandles()
        .then(handles => {
            if (handles.length > 1) {
                let i = 0;
                return utils.promise_for(() => i < handles.length, () => {i++;}, (res, rej) => {
                    if (handle !== handles[i]) {
                        return this.browserClient.switchTo().window(handles[i])
                        .then(() => {
                            return this.browserClient.close();
                        })
                        .then(() => {
                            res();
                        });
                    }
                    else res();
                })
                .then(() => {
                    return this.browserClient.switchTo().window(handle);
                });
            }
        });
    }

    // ================================================================================================================

}


// ====================================================================================================================
class CrawlingCtrl {

    // ================================================================================================================
    constructor () {
        crawlerLogger.trace('Create web-crawler instances.');
        
        this.users = Object.getOwnPropertyNames(crawlerSettings.users);
        this.webCrawlers = {};
        for (let userName of this.users) {
            let webCrawler = new Crawler(userName);
            this.webCrawlers[userName] = webCrawler;
        }
    }

    // ================================================================================================================
    setupWebBrowsers () {
        crawlerLogger.info('Setup web-crawlers (browser\'s web-drivers).');

        return Promise.all(this.users.map(user => this.webCrawlers[user].setup()))
        .then(results => {
            return Promise.all(this.users.map(user => this.webCrawlers[user].login()));
        })
        .catch(error => {
            crawlerLogger.fatal('Fatal Error setting up web-crawlers: ', error);
            throw 'setupWebBrowsers error';
        });
    }

    // ================================================================================================================
    shutdownWebBrowsers () {
        crawlerLogger.info('Shutting down web-crawlers (browser\'s web-drivers).');

        return Promise.all(this.users.map(user => this.webCrawlers[user].shutdown()))
        .catch(error => {
            crawlerLogger.error('Error shutting down web-crawlers.');
            throw error;
        });
    }

    // ================================================================================================================
    _genNextNode(gen, stack) {
        let {value, done} = gen.next();
        if (done !== true) {
            let {node, levelChange} = value;
            for (let i = 0; i < -levelChange +1; i++)
                stack.pop();
            stack.push(node);
            return node;
        } else {
            while (stack.length > 0)
                stack.pop();
            return undefined;
        }
    }

    // ================================================================================================================
    _getNextUniqueTmplInWebPage(gen, stack, tmpls) {
        while (true) {
            let node = this._genNextNode(gen, stack);
            if (node === undefined)
                return undefined;
            else if (node.type === 'tmpl' && tmpls.has(node.tmpl) === false)
                return node.tmpl;
        }
    }

    // ================================================================================================================
    _getTargetedClickable_str(node, clk_i) {
        return ('node: "' + nodeHandlers.stringifyNode(node) + ' clickable name: "' + node.clickables[clk_i].clk + '"').split('\n').join();
    }

    // ================================================================================================================
    // return promise resolved in clickableWasProhibited if all of opened handlers leads out of web-app
    _checkHandlesAfterClickable(webCrawler, initialHandle) {
        let clickableWasProhibited = false;
        
        return webCrawler.browserClient.getAllWindowHandles()
        .then(handles => {
            if (handles.length > 1) {
                // lets find first legal handle except initial and kill others
                // if there is no legal handles expect initial - then kill others and treat clickable as prohibited

                let nextHandle = undefined;
                let i = 0;
                return utils.promise_for(() => i < handles.length, () => {i++;}, (res, rej) => {
                    if (handles[i] === initialHandle)
                        res();
                    else {
                        return webCrawler.browserClient.switchTo().window(handles[i])
                        .then(() => { return webCrawler.browserClient.getCurrentUrl(); })
                        .then(url => {
                            if (!crawlerSettings.urlWhiteListCompiled.some((val) => val.test(url)) ||
                                crawlerSettings.urlBlackListCompiled.some((val) => val.test(url))) {
                                res();
                            } else {
                                // this browser window is legal
                                nextHandle = handles[i];
                                rej();
                            }
                        });
                    }
                })
                .then(() => {
                    if (nextHandle !== undefined) {
                        // clickableWasProhibited = true;
                        return webCrawler.closeHandlesButHandle(nextHandle);
                    } else {
                        clickableWasProhibited = true;
                        return webCrawler.closeHandlesButHandle(initialHandle);
                    }
                });
            }
        })
        .then(() => {
            return clickableWasProhibited;
        })
    }

    // ================================================================================================================
    // returns Promise<preState>
    _pre_performAction(webCrawler) {
        let preState = {};

        return Promise.resolve()
        .then(() => { return webCrawler.browserClient.getWindowHandle(); })
        .then(handle => { preState.initialHandle = handle; })
        .then(() => { return webCrawler.dropPostsCounter(); })
        .then(() => { return preState; });
    }

    // ================================================================================================================
    // returns Promise<postState>
    //      postState types: g - get, p - post, d - denied (prohibited)
    _post_performAction(webCrawler, preState) {
        
        let postState = {};

        let postsCounter = undefined;
        let prohibitedClickable = false;

        return Promise.resolve()
        .then(() => { return webCrawler.autoAcceptAlert(); })
        .then(() => { return this._checkHandlesAfterClickable(webCrawler, preState.initialHandle); })
        .then(clickableWasProhibited => {
            prohibitedClickable = clickableWasProhibited;
        })
        .then(() => { return webCrawler.getPostsCounter(); })
        .then(counter => {
            postsCounter = counter;
        })
        .then(() => {
            if (prohibitedClickable)
                postState.clkType = 'd';
            else if (postsCounter === 0)
                postState.clkType = 'g';
            else 
                postState.clkType = 'p'
        })
        .then(() => { return webCrawler.browserClient.getCurrentUrl(); })
        .then(currentUrl => {
            postState.url = currentUrl;
        })
        .then(() => {
            return postState;
        });
    }
    
    // ================================================================================================================
    // webCrawler - element of this.webCrawlers
    // clickables are searched only in templates contained in webpages
    crawlCurrentWebAppState(homePageUrl, webCrawler, i_pstate){
        
        let depth_step = 1;
        let steps_num = 3;
        let depth = depth_step;

        let clk_searcher = new clickSearcher.ClickSearcher(depth, i_pstate, webCrawler.userName,
            (node, clk_i) => (
                node.clickables[clk_i][webCrawler.userName] === undefined ||
                node.clickables[clk_i][webCrawler.userName].type === undefined ||
                (node.clickables[clk_i][webCrawler.userName].type === 'g' && node.clickables[clk_i][webCrawler.userName].webAppStates.every(state => state.i_pstate !== i_pstate))
            )
        );

        let tmplsChanged = false;
        let tmplsChangeHandler = (old_tmpl, new_tmpls) => {
            if (clk_searcher.tmpls.has(old_tmpl)) {
                tmplsChanged = true;
            }
        };
        this.webAppTmplModel.on('tmplPartition', tmplsChangeHandler);

        let homePage;
        let webAppStateWebPages = [];

        let workflow = webCrawler.disablePosts()
        // .then(webCrawler.browserClient.get('file:///home/avasilenko/Desktop/jaxsnoop/test/_resources/test-dom.html'))
        .then(() => {
            crawlerLogger.trace('Crawl homePage.');
            return webCrawler.browserClient.get(homePageUrl);})
        .then(() => {return webCrawler.snapshotingDom();})
        .then(domModel => {
            // console.log(JSON.stringify(domModel.domSnapshot));
            // console.log(WebAppTmplModel.rebuildDom({
            //         type: 'webPage', name: '-1',
            //         url: domModel.url, domRoot: domModel.domSnapshot
            //     })[0].dom
            // );
            homePage = this.webAppTmplModel.addDomModel(domModel);
            homePage.i_pstate = i_pstate;
            // this.webAppTmplModel.dumpWebAppTmplModel('./_html/');
        });


        // depth first not width first
        // for (; depth <= depth_step * steps_num; depth += depth_step) {
        workflow = workflow.then(() => { 
            return utils.promise_for(() => depth <= depth_step * steps_num, () => depth += depth_step, (res_d, rej_d) => {

                crawlerLogger.trace('Crawl web-app state with depth = ' + depth);
                clk_searcher.maxDepth = depth;
                clk_searcher.drop();
                clk_searcher.addWebPageAfterClickable(homePage);

                clk_searcher.shiftToNextClickable();

                // while (webPageStack.length > 0) {
                return utils.promise_for(() => clk_searcher.webPageStack.length > 0, () => { clk_searcher.shiftToNextClickable(); }, (res_wp, rej_wp) => {

                    let sp = clk_searcher.webPageStack[clk_searcher.webPageStack.length -1]; // sp - statePoint
                    crawlerLogger.trace('Target clickable = ' + this._getTargetedClickable_str(sp.node, sp.clk_i));

                    if (sp.node.clickables[sp.clk_i][webCrawler.userName] === undefined) {
                        sp.node.clickables[sp.clk_i][webCrawler.userName] = {
                            type: undefined,
                            webAppStates: []
                        };
                    }

                    return Promise.resolve()
                    .then(() => {
                        // reset browser into initial state
                        if (clk_searcher.browserTrace === false) {
                            crawlerLogger.trace('Drop browser\'s current state.');
                            clk_searcher.browserTrace = true;
                            clk_searcher.browserPos = 0;
                            return webCrawler.browserClient.get(homePageUrl);
                        }
                    })
                    .then(() => {
                        crawlerLogger.trace('Move browser\'s state into appropriate state to test new clickable.');
                        
                        // while (browserPos +1 < webPageStack.length) {
                        return utils.promise_for(() => clk_searcher.browserPos +1 < clk_searcher.webPageStack.length, () => {}, (res_t, rej_t) => {
                            let cp = clk_searcher.webPageStack[clk_searcher.browserPos]; // cp - currentPoint

                            let initialHandle;
                            return Promise.resolve()
                            .then(() => { return webCrawler.browserClient.getWindowHandle(); })
                            .then(handle => { initialHandle = handle; })
                            .then(() => { return webCrawler.performAction(clk_searcher.getClickableCss(clk_searcher.browserPos), cp.clk_i, cp.node); })
                            .then(() => { return webCrawler.autoAcceptAlert(); })
                            .then(() => { return this._checkHandlesAfterClickable(webCrawler, initialHandle); })
                            .then(() => {
                                clk_searcher.browserPos ++;
                                res_t();
                            })
                            .catch(err => {
                                if (err !== undefined && err.message === 'click-failed') {
                                    // Click failed, lets just skip this clickable
                                    crawlerLogger.warn('Error RE-performing action (find the cause and patch it) by clicking clickable = ' + this._getTargetedClickable_str(cp.node, cp.clk_i));
                                    cp.node.clickables[cp.clk_i][webCrawler.userName].type = 'd';
                                    rej_t(err);
                                } else {
                                    rej_t(err);
                                    throw err;
                                }
                            });
                        });
                    })
                    .catch(err => {
                        if (err !== undefined && err.message === 'click-failed') {
                            // Okey we already processed it
                        } else {
                            rej_wp(err);
                            throw err;
                        }
                    })
                    .then(() => {
                        let newUrl;
                        let preState;

                        return Promise.resolve()
                        .then(() => { return this._pre_performAction(webCrawler); })
                        .then(preActionState => {
                            preState = preActionState;

                            crawlerLogger.trace('Perform target clickable action.');
                            return webCrawler.performAction(clk_searcher.getClickableCss(clk_searcher.webPageStack.length -1), sp.clk_i, sp.node);
                        })
                        .then(() => { return this._post_performAction(webCrawler, preState); })
                        .then(postState => {
                            let clickable = sp.node.clickables[sp.clk_i][webCrawler.userName];

                            if (postState.clkType === 'g') {
                                return Promise.resolve()
                                .then(() => { return webCrawler.snapshotingDom(); })
                                .then(domModel => {
                                    let webPage = this.webAppTmplModel.addDomModel(domModel);
                                    webPage.i_pstate = i_pstate;
                                    webAppStateWebPages.push(webPage);
                                    
                                    crawlerLogger.trace('New web-page state registered and templates extracted.');

                                    clickable.type = 'g';
                                    clickable.webAppStates.push({i_pstate: i_pstate, webPage: webPage});
                                    
                                    if (!tmplsChanged) {
                                        clk_searcher.addWebPageAfterClickable(webPage);
                                        ckl_searcher.browserPos ++;
                                    }
                                    else {
                                        crawlerLogger.debug('Some template in currently crawled templates in click-searcher is changed.');
                                        tmplsChanged = false;
                                        throw {message: 'tmplsChanged-restartDepthCrawl'};
                                    }
                                });
                            } else if (postState.clkType === 'p') {
                                clickable.type = 'p';
                                clk_searcher.browserTrace = false;
                            } else if (postState.clkType === 'd') {
                                crawlerLogger.trace('Clickable will be marked as denied/forbidden.');
                                clickable.type = 'd';
                                clk_searcher.browserTrace = false;
                            }
                            else throw new Error('Unknown choice.');
                        })
                        .then(() => {
                            res_wp();
                        })
                        .catch(err => {
                            if (err !== undefined && err.message === 'click-failed') {
                                crawlerLogger.warn('Error performing target action (find the cause and patch it) by clicking clickable = ' + this._getTargetedClickable_str(sp.node, sp.clk_i));
                                clk_searcher.browserTrace = false;
                                res_wp();
                            }
                            else {
                                rej_wp(err);
                                throw err;
                            }
                        });
                    })
                    .catch(err => {
                        rej_wp(err);
                        throw err;
                    });

                }) // utils.promise_for (webPageStack.length > 0)

                .then(() => { res_d(); })
                .catch(err => {
                    if (err !== undefined && err.message === 'tmplsChanged-restartDepthCrawl') {
                        crawlerLogger.debug('Because of template-changing web-app crawling process is going to be restarted for the same depth = ' + depth);
                        depth -= depth_step;
                        res_d();
                    }
                    else {
                        rej_d(err);
                        throw err;
                    }
                });
            }); // utils.promise_for (depth <= depth_step * steps_num)
        })
        .then(() => { return webCrawler.enablePosts(); })
        .then(() => {
            this.webAppTmplModel.removeListener('tmplPartition', tmplsChangeHandler);
            let webAppState = {
                user: webCrawler.userName,
                i_pstate: i_pstate,
                tmplSet: clk_searcher.tmpls,
                webPageRoot: homePage,
                webPages: webAppStateWebPages
            };
            global.gc(); // I have seen how it frees 100 Mbytes of memory
            return webAppState;
        })
        .catch(err => {
            crawlerLogger.error('Error while crawling web-application user-state for user: ' + webCrawler.userName);
            throw err;
        });
        
        return workflow;
    }




    // ================================================================================================================
    //  returns pclkQueue array containing clickables in format {i_pstate, user, tmpl, node, clk_i}
    _findNextPClickable(followTheTrace) {
        
        let currentState = this.webAppModel[this.webAppModel.length -1];

        let consideredTmpls = new Set();
        let templatesStack = [];
        let new_pclks_stack = [];

        templatesStack.push([]);
        for (let user of this.users)
        for (let tmpl of currentState[user].tmpls) {
            templatesStack[0].push({
                user: user,
                tmpl: tmpl,
                i_pstate: currentState.i_pstate,
                clk: undefined // This clickable will result in moving web-app state into state with specified template
            });
            consideredTmpls.add(tmpl);
        }

        while (true) {
            let templatesStack_nextLevel = [];
            let new_pclks_stack_nextLevel = [];

            for (let user of this.users) {
            for (let {tmpl, i_pstate} of templatesStack[templatesStack.length -1].map(val => Object({tmpl: val.tmpl, i_pstate: val.i_pstate}) )) {
            for (let {node, levelChange} of utils.yieldTreeNodes(tmpl.tmplRoot, tmplModel.NodeProcessing.getYieldNodeChilds())) {
            for (let clk_i = 0; clk_i < node.clickables.length; clk_i++) {
                if (node.clickables[clk_i][user].type === 'p')
                {
                    if (node.clickables[clk_i][user].webAppStates === undefined || node.clickables[clk_i][user].webAppStates.length === 0) {
                        
                        new_pclks_stack_nextLevel.push({
                            i_pstate: i_pstate,
                            user: user,
                            tmpl: tmpl,
                            node: node,
                            clk_i: clk_i}); //

                    } else {
                        for (let existentWebAppState of node.clickables[clk_i][user].webAppStates) {
                            existentWebAppState = existentWebAppState.webAppStateDst;
                            for (let user_j of this.users)
                            for (let tmpl_j of existentWebAppState[user_j].tmpls)
                            if (! consideredTmpls.has(tmpl_j)) {
                                
                                templatesStack_nextLevel.push({ //
                                    user: user_j,
                                    tmpl: tmpl_j,
                                    i_pstate: existentWebAppState.i_pstate,
                                    clk: {
                                        i_pstate: existentWebAppState.i_pstate,
                                        user: user,
                                        tmpl: tmpl,
                                        node: node,
                                        clk_i: clk_i} // This clickable will result in moving web-app state into state with specified template
                                });
                                
                                consideredTmpls.add(tmpl_j);
                            }
                        }
                    }
                }
            }}}}

            new_pclks_stack.push(new_pclks_stack_nextLevel);
            if (followTheTrace === 0) {
                // we are not going to follow some user's trace
                // We found clickable in "old" template known for a long time --> let's click it!
                
                // pclk belongs to "old" template
                let pclk_oldness = pclk => this.webAppTmplModel.templates.indexOf(pclk.tmpl) < this.webAppTmplModel.templates.length;
                if (new_pclks_stack_nextLevel.some(pclk_oldness)) {
                    new_pclks_stack[new_pclks_stack.length -1] = new_pclks_stack_nextLevel.filter(pclk_oldness);
                    break;
                }
            } else {
                // we are following some user's trace
                // let's click the first clickable we found
                if (new_pclks_stack_nextLevel.length > 0) {
                    break;
                }
            }
            
            if (templatesStack_nextLevel.length === 0) {
                // There is no new templates to search for new clickables --> let's click something we already found

                let i = new_pclks_stack.findIndex(val => val.length > 0);
                if (i !== -1) {
                    new_pclks_stack.splice(i+1, new_pclks_stack.length);
                    templatesStack.splice(i, templatesStack.length);
                }
                else return undefined;

                break;
            }
            templatesStack.push(templatesStack_nextLevel);
        } // while (true)


        // using 'new_pclks_stack' and 'templatesStack' lets construct array of clickables in templates needed to be performed

        let i = new_pclks_stack.length -1;
        if (new_pclks_stack[i].length === 0)
            return undefined;
        let pclkQueue = [new_pclks_stack[i][0]]; i--;
        for (; i >= 0; i--) {
            let shiftingClickable = templatesStack[i].find(val => val.tmpl === pclkQueue[0].tmpl);
            pclkQueue.unshift(shiftingClickable.clk);
        }

        return pclkQueue;
    }


    // ================================================================================================================
    startCrawling(webCrawlers) {
        crawlerLogger.info('Starting crawling process.');

        this.webAppTmplModel = new tmplModel.WebAppTmplModel();

        this.i_pstateCounter = 0;

        this.webAppModel = [];

        this.webAppTmplModel.on('tmplPartition', (old_tmpl, new_tmpls) => {
            for (let webAppState of this.webAppModel) {
                for (let user of this.users) {
                    if (webAppState[user].tmpls.has(old_tmpl)) {
                        webAppState[user].tmpls.delete(old_tmpl);
                        for (let tmpl of new_tmpls)
                            webAppState[user].tmpls.add(tmpl);
                    }
                }
            }

            // let lastState = this.webAppModel[this.webAppModel.length -1];
            // for (let user of this.users) {
            //     if (lastState[user].tmpls.has(old_tmpl))
            //         ; // template from last webApp-model state changed !!! should we restart some crawling process ??
            // }
        });
        

        // Get first web-app state
        let workflow = Promise.all(this.users.map(user => this.crawlCurrentWebAppState(crawlerSettings.homePageUrl, this.webCrawlers[user], this.i_pstateCounter)))
        // .then(webUsersStates => {
        //     let webAppState = {
        //         i_pstate: this.i_pstateCounter
        //     };
        //     for (let i = 0; i < this.users.length; i++) {
        //         webAppState[this.users[i]] = {
        //             tmpls: webUsersStates[i].tmplSet,
        //             webPageRoot: webUsersStates[i].webPageRoot,
        //         };
        //     }
        //     this.webAppModel.push(webAppState);
        //     this.i_pstateCounter ++;
        // })
        // .then(() => {
        //     return utils.promise_for(() => true, () => {}, (res, rej) => {
                
        //         let followTheTrace = 2;

        //         let pclkQueue = this._findNextPClickable(followTheTrace); // [{i_pstate, user, tmpl, node, clk_i}, ...]
        //         if (pclkQueue === undefined) {
        //             crawlerLogger.info('Unique clickables of type POST come to the end. Crawling process will be stopped.')
        //             rej('p-clk ended');
        //             return;
        //         }

        //         crawlerLogger.debug('Moving web-app state into appropriate to make target clickable.')
        //         let i = 0;
        //         return utils.promise_for(() => i < pclkQueue.length, () => i++, (res_pclk, rej_pclk) => {

        //             crawlerLogger.trace('Moving web-browser into state to make clickable = ' + this._getTargetedClickable_str(pclkQueue[i].node, pclkQueue[i].clk_i));
                    
        //             let cs = this.webAppModel[this.webAppModel.length -1]; // current web-app state
        //             // let prev_cs = cs;


        //             let webPageStack;
        //             let foundWebPageStack = false;

        //             let depthStep = 1;
        //             for (let depth = depthStep; foundWebPageStack === false; depth += depthStep) {

        //                 let tmpls = new Set();
        //                 let gclk_initPoint = this._initWebPageMiddleCrawlState(pclkQueue[i].user, cs[pclkQueue[i].user].webPageRoot, tmpls, pclkQueue[i].i_pstate);
        //                 if (gclk_initPoint === undefined) {
        //                     crawlerLogger.error('Root web-page has no g-clickables to search for required tmpl.');
        //                     rej_pclk();
        //                     return;
        //                 }
        //                 webPageStack = [gclk_initPoint];
        //                 if (webPageStack[0].tmpl === pclkQueue[i].tmpl)
        //                     foundWebPageStack = true;

        //                 let findNext_gclk = false;
        //                 while (foundWebPageStack === false) {
        //                     if (webPageStack.length === 0) {
        //                         crawlerLogger.error('Can not find required template to make p-clickable.');
        //                         if (i !== 0) {
        //                             pclkQueue[i-1].node.clickables[pclkQueue[i-1].clk_i].type = 'd';
        //                             rej_pclk();
        //                             throw undefined;
        //                         } else {
        //                             crawlerLogger.fatal('Can not find required template to make p-clickable in web-app state crawled just now.');
        //                             rej_pclk('fatal');
        //                             throw new Error('fatal');
        //                         }
        //                     }
        //                     let sp = webPageStack[webPageStack.length -1]; // sp - statePoint

        //                     if (findNext_gclk === true) {
                                
        //                         ({node: sp.node, clk_i: sp.clk_i} = this._getNextGClickableInStack(pclkQueue[i].user, sp.tmplIt, sp.tmplNodeStack, pclkQueue[i].i_pstate, sp.node, sp.clk_i));
        //                         if (sp.node !== undefined && sp.clk_i !== undefined) {
        //                             findNext_gclk = false;
        //                         } else {
        //                             sp.tmpl = this._getNextUniqueTmplInWebPage(sp.pageIt, sp.pageNodeStack, tmpls);
        //                             if (sp.tmpl !== undefined) {

        //                                 if (sp.tmpl === pclkQueue[i].tmpl) {
                                            
        //                                     foundWebPageStack = true;
        //                                     break; // Template FOUND --> break;
        //                                 }

        //                                 tmpls.add(sp.tmpl);
        //                                 if (sp.tmplNodeStack.length > 0)
        //                                     throw new Error('tmplNodeStack is not cleared after previous steps, this must never happen.');
        //                                 sp.tmplIt = utils.yieldTreeNodes(sp.tmpl.tmplRoot, tmplModel.NodeProcessing.getYieldNodeChilds());
        //                             }
        //                             else {
        //                                 webPageStack.pop();
        //                                 findNext_gclk = true;
        //                             }
        //                         }
        //                     } else {
        //                         let clickable = sp.node.clickables[sp.clk_i][pclkQueue[i].user];
        //                         let previouslyClicked = clickable.webAppStates.findIndex(pstate => pstate.i === pclkQueue[i].i_pstate);

        //                         if (previouslyClicked === -1)
        //                             findNext_gclk = true;
        //                         else {
        //                             if (webPageStack.length < depth) {
        //                                 let nsp = this._initWebPageMiddleCrawlState(pclkQueue[i].user, clickable.webAppStates[previouslyClicked].webPage, tmpls, pclkQueue[i].i_pstate);
        //                                 if (nsp !== undefined) {
        //                                     webPageStack.push(nsp);
        //                                 } else {
        //                                     findNext_gclk = true;
        //                                 }
        //                             } else {
        //                                 findNext_gclk = true;
        //                             }
        //                         }
        //                     }
        //                 } // while (true)

        //                 // restore sp.node and its p-clickable in webPageStack structure
        //                 let sp = webPageStack[webPageStack.length -1]; // sp - statePoint
        //                 sp.tmplIt = utils.yieldTreeNodes(sp.tmpl.tmplRoot, tmplModel.NodeProcessing.getYieldNodeChilds());
        //                 let {value, done} = sp.tmplIt.next();
        //                 sp.node = value.node;
        //                 // loop is needed to move sp.tmplIt generator into correct state
        //                 while (sp.node !== pclkQueue[i].node) {
        //                     ({value, done} = sp.tmplIt.next());
        //                     if (done === true) {
        //                         crawlerLogger.error('Can not find required node in known template.');
        //                         rej_pclk();
        //                         throw undefined;
        //                     } else {
        //                         sp.node = value.node;
        //                     }
        //                 }
        //                 sp.tmplNodeStack = [];
        //                 let tmp_node = sp.node;
        //                 while (tmp_node !== sp.tmpl) {
        //                     sp.tmplNodeStack.unshift(tmp_node);
        //                     tmp_node = tmp_node.parent;
        //                 }
        //                 sp.clk_i = pclkQueue[i].clk_i;

        //             } // for (depth)


        //             // webPageStack for gclk found!

        //             crawlerLogger.trace('Found web-page sequence for gclk\'s to lead into pclk\'s template.');

        //             let browserCorrelatedState = 0;
        //             return Promise.resolve()
        //             .then(() => {
        //                 return this.webCrawlers[pclkQueue[i].user].browserClient.get(cs[pclkQueue[i].user].webPageRoot.url);
        //             })
        //             .then(() => {

        //                 return utils.promise_for(() => browserCorrelatedState < webPageStack.length, () => {}, (res_t, rej_t) => {
        //                     let cp = webPageStack[browserCorrelatedState]; // cp - currentPoint

        //                     let initialHandle;
        //                     return Promise.resolve()
        //                     .then(() => { return this.webCrawlers[pclkQueue[i].user].browserClient.getWindowHandle(); })
        //                     .then(handle => { initialHandle = handle; })
        //                     .then(() => { return this.webCrawlers[pclkQueue[i].user].performAction(this._getClickableCss(cp), cp.clk_i, cp.node); })
        //                     .then(() => { return this.webCrawlers[pclkQueue[i].user].autoAcceptAlert(); })
        //                     .then(() => { return this._checkHandlesAfterClickable(this.webCrawlers[pclkQueue[i].user], initialHandle); })
        //                     .then(() => {
        //                         browserCorrelatedState ++;
        //                         res_t();
        //                     })
        //                     .catch(err => {
        //                         if (err !== undefined && err.message === 'click-failed') {
        //                             crawlerLogger.warn('Error RE-performing action (find the cause and patch it).');
        //                             rej_t(err);
        //                         } else {
        //                             rej_t(err);
        //                             throw err;
        //                         }
        //                     });
        //                 })
        //                 .then(() => {
        //                     if (i !== pclkQueue.length -1)
        //                         cs = pclkQueue[i].node.clickables[pclkQueue[i].clk_i][pclkQueue[i].user].webAppStates[0].webAppStateDst;
        //                     // else
        //                     //     prev_cs = cs;
        //                     res_pclk();
        //                 })
        //                 .catch(err => {
        //                     if (err !== undefined && err.message === 'click-failed') {
        //                         crawlerLogger.warn('Error RE-performing queue of g-clk actions ended with p-clk action.')
        //                         res_pclk();
        //                     } else {
        //                         rej_pclk(err);
        //                         throw err;
        //                     }
        //                 });
        //             })
        //             .catch(err => {
        //                 rej_pclk(err);
        //                 throw err;
        //             });



        //         }) // utils.promise_for(i < pclkQueue.length)
        //         .then(() => {
        //             // Finally targeted pclk performed !!!

        //             followTheTrace --;
        //             if (followTheTrace < 0)
        //                 followTheTrace = 2;

        //             return Promise.all(this.users.map(user => this.crawlCurrentWebAppState(this.webCrawlers[user], this.i_pstateCounter)))
        //             .then(webUsersStates => {
        //                 let webAppState = {
        //                     i_pstate: this.i_pstateCounter
        //                 };
        //                 for (let i = 0; i < this.users.length; i++) {
        //                     webAppState[this.users[i]] = {
        //                         tmpls: webUsersStates[i].tmplSet,
        //                         webPageRoot: webUsersStates[i].webPageRoot,
        //                     };
        //                 }
        //                 this.webAppModel.push(webAppState);
        //                 this.i_pstateCounter ++;

        //                 let last_pclk = pclkQueue[pclkQueue.length -1];
        //                 if (last_pclk.node.clickables[last_pclk.clk_i][last_pclk.user].webAppStates === undefined)
        //                     last_pclk.node.clickables[last_pclk.clk_i][last_pclk.user].webAppStates = [];
        //                 last_pclk.node.clickables[last_pclk.clk_i][last_pclk.user].webAppStates.push({
        //                     i_pstate: undefined,
        //                     webAppStateSrc: this.webAppModel[pclkQueue[pclkQueue.length -1].i_pstate],
        //                     webAppStateDst: webAppState
        //                 });

        //             });
        //         })
        //         .then(() => {
        //             res();
        //         })
        //         .catch(err => {
        //             if (err === undefined) {
        //                 res();
        //             } else {
        //                 rej(err);
        //                 throw err;
        //             }
        //         });

        //     }) // utils.promise_for - main loop
        //     .catch(err => {
        //         throw err;
        //     });
        // })
        // .catch (err => {
        //     if (err !== undefined && err === 'p-clk ended') {
        //         // everything is okey
        //     } else {
        //         throw err;
        //     }
        // })

        .then(() => {
            crawlerLogger.info('End crawling process.');
            crawlerLogger.info('Dumping webApp model.');
            this.webAppTmplModel.dumpWebAppTmplModel('./_html/');
            crawlerLogger.info('Dumping ended.');

            return this.webAppModel;
        })
        .catch(err => {
            crawlerLogger.fatal('Error while crawling web-application.');
            throw err;
        });

        return workflow;
    }

    // ================================================================================================================
}

module.exports = {
    CrawlingCtrl: CrawlingCtrl,
    Crawler: Crawler
};
