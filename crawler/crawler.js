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
    _getNextClickableInStack(webCrawler, gen, stack, i_pstate, node = undefined, clk_i = undefined) {

        if (node === undefined) {
            node = this._genNextNode(gen, stack);
            if (node === undefined)
                return {node: undefined, clk_i: undefined};
            clk_i = undefined;
        }

        let i = 0; // skip clickables before clk_i
        if (clk_i !== undefined) {
            while (node.clickables[i].clk !== node.clickables[clk_i].clk)
                i++;
            i++;
        }

        while (true) {
            while ( i < node.clickables.length &&
                !( node.clickables[i][webCrawler.userName] === undefined ||
                   node.clickables[i][webCrawler.userName].type === undefined ||
                   node.clickables[i][webCrawler.userName].type === 'g'
                //    ( node.clickables[i][webCrawler.userName].type === 'g' &&
                //     !node.clickables[i][webCrawler.userName].webAppStates.some(pstate => pstate.i === i_pstate)
                //    )
                 ))
                i++;
            
            if (i >= node.clickables.length) {
                node = this._genNextNode(gen, stack);
                i = 0;
                if (node === undefined)
                    return {node: undefined, clk_i: undefined};
            } else {
                return {node, clk_i: i};
            }
        }
    }

    // ================================================================================================================
    _initWebPageMiddleCrawlState(webCrawler, webPage, tmpls, i_pstate) {
        let sp = {}; // sp - statePoint
        sp.webPage = webPage;
        sp.pageNodeStack = [];
        sp.pageIt = utils.yieldTreeNodes(sp.webPage.domRoot, tmplModel.NodeProcessing.getYieldNodeChilds('tmpl'));
        sp.tmpl = this._getNextUniqueTmplInWebPage(sp.pageIt, sp.pageNodeStack, tmpls);
        if (sp.tmpl === undefined)
            return undefined;
        tmpls.add(sp.tmpl);
        sp.tmplNodeStack = [];
        sp.tmplIt = utils.yieldTreeNodes(sp.tmpl.tmplRoot, tmplModel.NodeProcessing.getYieldNodeChilds());
        ({node: sp.node, clk_i: sp.clk_i} = this._getNextClickableInStack(webCrawler, sp.tmplIt, sp.tmplNodeStack, i_pstate));
        return sp;
    }

    // ================================================================================================================
    _getTargetedClickable_str(cp) {
        return 'node: "' + nodeHandlers.stringifyNode(cp.node) + ' clickable name: "' + cp.node.clickables[cp.clk_i].clk + '"';
    }

    // ================================================================================================================
    *_getDomNodesToTheLeft(node) {
        // Check if we are not root node and if our parent is not template (because if it is - there is no garanties of children order)
        if (node.parent !== undefined && node.parent.type === undefined /* not 'tmpl' */) {
            let parent = node.parent;
            for (let child of parent.childNodes) {

                if (child === node)
                    break;

                if (child.type === undefined)
                    yield child;
                else if (child.type === 'tmpl')
                    yield child.tmplRoot;
                else
                    throw new Error('Unknown choice.');
            }
        }
    }

    // ================================================================================================================
    _getClickableCss(cp) {

        let css_selectors_stack = [];

        for (let i = 0; i < cp.pageNodeStack.length; i++) {
            let node = cp.pageNodeStack[i];
            let css_selector_shift = Array.from(this._getDomNodesToTheLeft(node)).map(lnode => lnode.props.tagName + ' ~ ').join('');

            if (node.type === undefined) {
                css_selectors_stack.push(css_selector_shift + nodeHandlers.getNodeCssPresentation(node));
            } else if (node.type === 'tmpl') {

                // get stack of nodes inside template
                let tmplNodeStack;
                if (i + 1 === cp.pageNodeStack.length)
                    tmplNodeStack = cp.tmplNodeStack;
                else {
                    tmplNodeStack = [];
                    let child = node.childNodes.find(child => child.child === cp.pageNodeStack[i+1]);
                    let tnode = child.tmplNode;
                    while (tnode.type === undefined) {
                        tmplNodeStack.unshift(tnode);
                        tnode = tnode.parent;
                    }
                }

                // get css inside template
                let css_tmpl_selectors_stack = [];
                for (let tnode of tmplNodeStack) {
                    let css_t_selector_shift = Array.from(this._getDomNodesToTheLeft(tnode)).map(lnode => lnode.props.tagName + ' ~ ').join('');
                    if (tnode.type !== undefined)
                        throw new Error('In template nodes must be only DOM nodes (type === undefined).');
                    css_tmpl_selectors_stack.push(css_t_selector_shift + nodeHandlers.getNodeCssPresentation(tnode));
                }

                css_selectors_stack.push(css_selector_shift + css_tmpl_selectors_stack.join(' > '));
            }
            else throw new Error('Unknown choice.');
        }
        return css_selectors_stack.join(' > ');
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
        .then(() => { return webCrawler.browserClient.switchTo().alert(); })
        .then(alert => {
            return alert.accept();
        }, err => {
            if (err instanceof wdError.NoSuchAlertError) {
                // Everything is okey, there is no alert to close
            } else {
                throw err;
            }
        })
        .then(() => { return webCrawler.browserClient.getAllWindowHandles(); })
        .then(handles => {
            if (handles.length > 1) {
                // lets find first legal handle except initial and kill others
                // if there is no legal handles expect initial - then kill others and treat clickable as prohibited

                let nextHandle = undefined;
                let i = 0;
                return utils.promise_for(() => i < handles.length, () => {i++;}, (res, rej) => {
                    if (handles[i] === preState.initialHandle)
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
                        prohibitedClickable = true;
                        return webCrawler.closeHandlesButHandle(nextHandle);
                    } else
                        return webCrawler.closeHandlesButHandle(preState.initialHandle);
                });
            }
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
    crawlCurrentWebAppState(webCrawler, i_pstate){
        let depth_step = 1;
        let steps_num = 3;

        let homePage;

        let workflow = webCrawler.disablePosts()
        // .then(webCrawler.browserClient.get('file:///home/avasilenko/Desktop/jaxsnoop/test/_resources/test-dom.html'))
        .then(() => {
            crawlerLogger.trace('Crawl homePage.');
            return webCrawler.browserClient.get(crawlerSettings.homePageUrl);})
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


        let webAppStateWebPages = [homePage];
        let tmpls = new Set(); // add, delete, has, clear
        let tmplsChanged = false;
        let tmplsChangeHandler = old_tmpl => {
            if (tmpls.has(old_tmpl)) {
                tmplsChanged = true;
                tmpls.clear();
            }
        };
        this.webAppTmplModel.on('tmplPartition', tmplsChangeHandler);


        // depth first not width first
        let depth = depth_step;
        // for (; depth <= depth_step * steps_num; depth += depth_step) {
        workflow = workflow.then(() => { 
            return utils.promise_for(() => depth <= depth_step * steps_num, () => depth += depth_step, (res_d, rej_d) => {

                crawlerLogger.trace('Crawl web-app state with depth = ' + depth);

                tmpls.clear();
                let initPoint = this._initWebPageMiddleCrawlState(webCrawler, homePage, tmpls, i_pstate)
                if (initPoint === undefined) {
                    res_d();
                    return;
                }
                let webPageStack = [initPoint];
                let browserCorrelatedState = 0;
                let trace = false; // trace === false after back-off for depth first search

                let searchNextClickable = initPoint.node === undefined || initPoint.clk_i === undefined;
                // while (webPageStack.length > 0) {
                return utils.promise_for(() => webPageStack.length > 0, () => {}, (res_wp, rej_wp) => {
                    let sp = webPageStack[webPageStack.length -1]; // sp - statePoint

                    if (searchNextClickable) {
                        ({node: sp.node, clk_i: sp.clk_i} = this._getNextClickableInStack(webCrawler, sp.tmplIt, sp.tmplNodeStack, i_pstate, sp.node, sp.clk_i));
                        if (sp.node !== undefined && sp.clk_i !== undefined) {
                            searchNextClickable = false;
                        } else {
                            sp.tmpl = this._getNextUniqueTmplInWebPage(sp.pageIt, sp.pageNodeStack, tmpls);
                            if (sp.tmpl !== undefined) {
                                tmpls.add(sp.tmpl);
                                if (sp.tmplNodeStack.length > 0)
                                    throw new Error('tmplNodeStack is not cleared after previous steps.');
                                sp.tmplIt = utils.yieldTreeNodes(sp.tmpl.tmplRoot, tmplModel.NodeProcessing.getYieldNodeChilds());
                            }
                            else {
                                webPageStack.pop();
                                if (webPageStack.length -1 < browserCorrelatedState)
                                    trace = false;
                            }
                        }
                        res_wp();

                    } else { // Make click

                        crawlerLogger.trace('Target clickable = ' + this._getTargetedClickable_str(sp));

                        if (sp.node.clickables[sp.clk_i][webCrawler.userName] === undefined) {
                            sp.node.clickables[sp.clk_i][webCrawler.userName] = {
                                type: undefined,
                                webAppStates: []
                            };
                        }

                        let clickable = sp.node.clickables[sp.clk_i][webCrawler.userName];

                        let previouslyClicked = clickable.webAppStates.findIndex(pstate => pstate.i === i_pstate);
                        if (previouslyClicked !== -1) {
                            crawlerLogger.trace('Clickable already clicked.');
                            if (webPageStack.length < depth -1) {
                                let nsp = this._initWebPageMiddleCrawlState(webCrawler, clickable.webAppStates[previouslyClicked].webPage, tmpls, i_pstate);
                                if (nsp !== undefined) {
                                    crawlerLogger.trace('Loading web-page from previous click of clicked clickable.');
                                    webPageStack.push(nsp);
                                } else {
                                    crawlerLogger.trace('Web-page from previously clicked clickable was not enqueued, because it is already fully crawled. Going to search next clickable.');
                                }
                            } else {
                                crawlerLogger.trace('Skip clickable because of depth limit.');
                                searchNextClickable = true;
                            }
                            res_wp();
                        
                        } else { // Make new click

                            let wf = Promise.resolve();

                            // shift browser into appropriate state
                            if (trace === false) {
                                crawlerLogger.trace('Drop browser\'s current state.');
                                wf = wf.then(() => {return webCrawler.browserClient.get(crawlerSettings.homePageUrl);});
                                browserCorrelatedState = 0;
                                trace = true;
                            }

                            wf = wf.then(() => {
                                crawlerLogger.trace('Move browser\'s state into appropriate state to test new clickable.');
                                
                                // while (browserCorrelatedState +1 < webPageStack.length) {
                                return utils.promise_for(() => browserCorrelatedState +1 < webPageStack.length, () => {}, (res_t, rej_t) => {
                                    let cp = webPageStack[browserCorrelatedState]; // cp - currentPoint

                                    return Promise.resolve()
                                    .then(() => {return webCrawler.performAction(this._getClickableCss(cp), cp.clk_i, cp.node);})
                                    .then(() => {
                                        browserCorrelatedState ++;
                                        res_t();
                                    })
                                    .catch(err => {
                                        if (err !== undefined && err.message === 'click-failed') {
                                            // Click failed, lets just skip this clickable
                                            crawlerLogger.warn('Error RE-performing action (find the cause and patch it).');
                                            rej_t(err);
                                        } else {
                                            rej_t(err);
                                            throw err;
                                        }
                                    });
                                });
                            })
                            .then(() => {
                                let newUrl;
                                let preState;

                                return this._pre_performAction(webCrawler)
                                .then(preActionState => {
                                    preState = preActionState;

                                    crawlerLogger.trace('Perform targeted clickable action.');
                                    return webCrawler.performAction(this._getClickableCss(sp), sp.clk_i, sp.node);
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
                                            clickable.webAppStates.push({i: i_pstate, webPage: webPage});
                                            
                                            if (!tmplsChanged) {
                                                let nsp = this._initWebPageMiddleCrawlState(webCrawler, webPage, tmpls, i_pstate);
                                                if (nsp !== undefined) {
                                                    if (webPageStack.length < depth) {
                                                        webPageStack.push(nsp);
                                                        browserCorrelatedState ++;
                                                    }
                                                } else {
                                                    searchNextClickable = true;
                                                    crawlerLogger.trace('New web-page state does not contain unique templates, it will be not queued for future crawling.');
                                                }
                                            }
                                            else {
                                                searchNextClickable = true;
                                                crawlerLogger.debug('Some template in currently crawled templates is changed.');
                                                tmplsChanged = false;
                                                throw {message: 'tmplsChanged-restartDepthCrawl'};
                                            }
                                        });
                                    } else if (postState.clkType === 'p') {
                                        clickable.type = 'p';
                                        // Expect, that browser can change its state into unexpected
                                        trace = false;
                                        searchNextClickable = true;
                                    } else if (postState.clkType === 'd') {
                                        crawlerLogger.trace('Clickable will be marked as denied/forbidden.');
                                        clickable.type = 'd';
                                        // Expect, that browser can change its state into unexpected
                                        trace = false;
                                        searchNextClickable = true;
                                    }
                                    else throw new Error('Unknown choice.');
                                    
                                })
                                .then(() => {
                                    res_wp();
                                })
                                .catch(err => {
                                    if (err !== undefined && err.message === 'click-failed') {
                                        crawlerLogger.debug('Skipping clickable which is failed to be clicked. (find the cause and patch it)');
                                        trace = false;
                                        searchNextClickable = true;
                                        res_wp();
                                    }
                                    else {
                                        rej_wp(err);
                                        throw err;
                                    }
                                });
                            })
                            .catch(err => {
                                if (err !== undefined && err.message === 'click-failed') {
                                    crawlerLogger.debug('Skipping clickable (and its descendants) which is failed to be RE-clicked. (find the cause and patch it)');
                                    while (webPageStack.length > browserCorrelatedState)
                                        webPageStack.pop();
                                    trace = false;
                                    searchNextClickable = true;
                                    res_wp();
                                }
                                else {
                                    rej_wp(err);
                                    throw err;
                                }
                            });

                            return wf;

                        } // Make new click
                    } // Make click

                }) // utils.promise_for (webPageStack.length > 0)
                .then(() => {res_d();})
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
        .then(() => {
            this.webAppTmplModel.removeListener('tmplPartition', tmplsChangeHandler);
            let webAppState = {
                num: i_pstate,
                tmplSet: tmpls,
                rootWebPage: homePage,
                webPages: webAppStateWebPages
            };
            global.gc();
            return webAppState;
        });
        
        return workflow;
    }

    // ================================================================================================================
    startCrawling(webCrawlers) {
        crawlerLogger.info('Starting crawling process.');

        this.webAppTmplModel = new tmplModel.WebAppTmplModel();

        this.i_pstate = 0;



        let promise = Promise.all(this.webCrawlers.map(webCrawler => this.crawlCurrentWebAppState(webCrawler, this.i_pstate)));



        promise = promise.then(() => {
            crawlerLogger.info('End crawling process.');
            crawlerLogger.info('Dumping webApp model.');
            this.webAppTmplModel.dumpWebAppTmplModel('./_html/');
            crawlerLogger.info('Dumping ended.');
        })
        .catch(err => {
            crawlerLogger.fatal('Error while crawling web-application.');
            throw err;
        });

        return promise;
    }

    // ================================================================================================================
}

module.exports = {
    CrawlingCtrl: CrawlingCtrl,
    Crawler: Crawler
};
