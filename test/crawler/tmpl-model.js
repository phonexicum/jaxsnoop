'use strict';

const assert = require('assert');
const path = require('path');

// ====================================================================================================================
const webdriver = require('selenium-webdriver'),
    wdCapabilities = require('selenium-webdriver/lib/capabilities'),
    firefox = require('selenium-webdriver/firefox');

const GenerateDOMCopy = require('../../crawler/copying-DOM.js').GenerateDOMCopy;
const utils = require('../../utils/utils.js');
const tmplModel = require('../../model/tmpl-model.js');
const nodeHandlers = require('../../model/node-handlers.js');

// ====================================================================================================================
describe('crawler', () => {
    describe('#checkModelConstruction()', () => {
        let browser = null;
        
        before(() => {
            browser = new webdriver.Builder()
                .forBrowser('firefox')
                .usingServer('http://localhost:4444/wd/hub')
                .build();
        });
        
        after(function(done) {
            this.timeout(10*1000);
            browser.close();
            browser.quit();
            browser.controlFlow().execute(() => done());
        });

        it('check Copying-DOM functionality', function(done) {
            this.timeout(10*1000);

            let correctWebModel = {
                "clickables": [], "childNodes": [{
                    "clickables": [], "childNodes": [{
                        "clickables": [], "childNodes": [],
                        "props": {
                            "attributes": [{"attrName": "href", "attrValue": "./test_dom.html"}],
                            "nodeValues": ["test1"],
                            "tagName": "a"
                        }
                    },{
                        "clickables": [], "childNodes": [],
                        "props": {
                            "attributes": [],
                            "nodeValues": ["test1"],
                            "tagName": "b"
                        }
                    }],
                    "props": {
                        "attributes": [],
                        "nodeValues": [],
                        "tagName": "div"
                    }
                },{
                    "clickables": [], "childNodes": [{
                        "clickables": [], "childNodes": [],
                        "props": {
                            "attributes": [{"attrName": "href", "attrValue": "./test_dom.html"}],
                            "nodeValues": ["test2"],
                            "tagName": "a"
                        }
                    },{
                        "clickables": [], "childNodes": [],
                        "props": {
                            "attributes": [],
                            "nodeValues": ["test2"],
                            "tagName": "b"
                        }
                    }],
                    "props": {
                        "attributes": [],
                        "nodeValues": [],
                        "tagName": "div"
                    }
                },{
                    "clickables": [], "childNodes": [{
                        "clickables": [],"childNodes": [],
                        "props": {
                            "attributes": [{"attrName": "href", "attrValue": "./lolz.html"}],
                            "nodeValues": ["testing"],
                            "tagName": "a"
                        }
                    },{
                        "clickables": [], "childNodes": [],
                        "props": {
                            "attributes": [],
                            "nodeValues": ["Home"],
                            "tagName": "b"
                        }
                    }],
                    "props": {
                        "attributes": [],
                        "nodeValues": [],
                        "tagName": "div"
                    }
                },
                {
                    "clickables": [], "childNodes": [{
                        "clickables": ["onclick"], "childNodes": [],
                        "props": {
                            "attributes": [{"attrName": "onclick", "attrValue": "alert(1)"}],
                            "nodeValues": ["Click me"],
                            "tagName": "div"
                        }
                    }],
                    "props": {
                        "attributes": [],
                        "nodeValues": ["Basket"],
                        "tagName": "div"
                    }
                }],
                "props": {
                    "attributes": [],
                    "nodeValues": ["Hello World!"],
                    "tagName": "body"
                }
            };

            let url = path.normalize('file://' + __dirname + '/../_resources/crawler/model/copy-dom.html');

            browser.get(url);

            browser.executeScript(GenerateDOMCopy, utils.yieldTreeNodes,
                'function ' + tmplModel.NodeProcessing.getDomNodeDraft.toString(),
                nodeHandlers.checkNodeIsBlacklisted, nodeHandlers.getPropertiesOfDOMnode)
            .then(domModel => {
                domModel = JSON.parse(domModel);

                assert.ok(path.normalize(url) === path.normalize(domModel.url));

                function* yieldNodeChilds(node) {
                    for (let child of node.childNodes)
                        yield child;
                }

                let domModelGen1 = utils.yieldTreeNodes(correctWebModel, yieldNodeChilds);
                let domModelGen2 = utils.yieldTreeNodes(domModel.domSnapshot, tmplModel.NodeProcessing.getYieldNodeChilds());

                let value;
                let {value:{node:node1, levelChange:levelChange1}, done:done1} = domModelGen1.next();
                let {value:{node:node2, levelChange:levelChange2}, done:done2} = domModelGen2.next();

                while (done1 === false && done2 === false) {
                    assert.ok(levelChange1 === levelChange2);
                    assert.deepStrictEqual(node1.props, node2.props);
                    assert.deepStrictEqual(node1.clickables, node2.clickables);

                    ({value, done:done1} = domModelGen1.next());
                    if (done1 === false) ({node:node1, levelChange:levelChange1} = value);
                    ({value, done:done2} = domModelGen2.next());
                    if (done2 === false) ({node:node2, levelChange:levelChange2} = value);
                }
                assert.ok(done1 === done2);

            });

            browser.controlFlow().execute(() => done());
        });

        describe('check adding domModels into webApp model (checking correct template extraction)', function() {
            this.timeout(20*1000);

            let base = 'file:///home/avasilenko/Desktop/jaxsnoop/test/_resources/crawler/model/';
            let webAppTmplModel = new tmplModel.WebAppTmplModel();

            after(function() {
                webAppTmplModel.dumpWebAppTmplModel('./_html/');
            });

            function loadWebPage(webPageUrl) {
                browser.get(webPageUrl);
                return browser.executeScript(GenerateDOMCopy, utils.yieldTreeNodes,
                    'function ' + tmplModel.NodeProcessing.getDomNodeDraft.toString(),
                    nodeHandlers.checkNodeIsBlacklisted, nodeHandlers.getPropertiesOfDOMnode)
            }

            function addDomModel(domModel) {
                // // log domModel before template extraction
                // console.log(
                //     webAppTmplModel.rebuildDom({
                //         type: 'webPage',
                //         name: '-1',
                //         url: domModel.url,
                //         domRoot: domModel.domSnapshot
                //     })[0].dom
                // );

                webAppTmplModel.addDomModel(domModel);
                
                // log webAppTmplModel
                // for (let html of webAppTmplModel.rebuildDom())
                //     console.log(html.name + '\n' + html.dom);
            }

            function makeConsistancyChecks() {
                
                // ===============================
                // Make various webAppTmplModel checks
                // ===============================
                
                let allNodeObjects = [];
                let seenTmpl = {};
                for (let webPage of webAppTmplModel.webAppPageList) {
                    for (let {node, levelChange, parent} of utils.yieldTreeNodes(webPage.domRoot, tmplModel.NodeProcessing.getYieldNodeChilds('tmpl'))) {
                        allNodeObjects.push(node);

                        // Check node type
                        assert.ok(node.type === undefined || node.type === 'tmpl', 'Wrong node type in web-page model');

                        // Check parent pointer consistency
                        if (node === webPage.domRoot) assert.ok(node.parent === undefined, 'Parent must not exist for root node of web-page model');
                        else {
                            if (node.parent === parent)
                                assert.ok(node.parent === parent, 'Wrong parent pointer for some node in some web-page model');
                            else
                                assert.ok(node.parent === parent, 'Wrong parent pointer for some node in some web-page model');
                        }

                        // Memorize nodes, pointing to templates
                        if (node.type === 'tmpl') {
                            if (seenTmpl[node.tmpl.name] === undefined)
                                seenTmpl[node.tmpl.name] = {
                                    tmpl: node.tmpl,
                                    parentNodes: [node]
                                };
                            else
                                seenTmpl[node.tmpl.name].parentNodes.push(node);
                        }

                        // Check if nodeChilds.tmplNode of curent tmpl node-pointer endeed points at some node from template
                        if (node.type === 'tmpl') {
                            for (let childPointer of node.childNodes) {
                                let exists = false;
                                for (let {node:tmplNode} of utils.yieldTreeNodes(node.tmpl.tmplRoot, tmplModel.NodeProcessing.getYieldNodeChilds()))
                                    if (childPointer.tmplNode === tmplNode) {
                                        exists = true;
                                        break;
                                    }
                                if (!exists)
                                    assert(false, 'Some template-pointer node contains as one of its childNode object {tmplNode, child}, BUT tmplNode does not belong to pointed out template');
                            }
                        }
                    }
                }

                // Check if webAppTmplModel.templates does not contain redundant templates
                assert.strictEqual(webAppTmplModel.templates.length, Object.getOwnPropertyNames(seenTmpl).length);
                for (let tmplName in seenTmpl) {
                    assert.strictEqual(seenTmpl[tmplName].parentNodes.length, seenTmpl[tmplName].tmpl.tmplParents.length);
                    if (! seenTmpl[tmplName].parentNodes.every(val => seenTmpl[tmplName].tmpl.tmplParents.indexOf(val) !== -1))
                        assert(false, 'Some template lost at least one pointer to tmplParents.');
                }

                for (let tmpl of webAppTmplModel.templates) {
                    for (let {node, parent} of utils.yieldTreeNodes(tmpl.tmplRoot, tmplModel.NodeProcessing.getYieldNodeChilds())) {
                        allNodeObjects.push(node);

                        // Check node type
                        assert.ok(node.type === undefined, 'Wrong node type');

                        // Check parent pointer consistency
                        if (node === tmpl.tmplRoot)
                            assert.ok(node.parent === undefined, 'Parent must not exist for root node in some template');
                        else {
                            if (node.parent === parent)
                                assert.ok(node.parent === parent, 'Wrong parent pointer for some node in some template');
                            else {
                                let kkk = 12;
                            }
                        }
                    }
                }

                // Check that there is no webAppTmplModel nodes present at two places simultaneously
                for (let i = 0; i < allNodeObjects.length; i++) {
                    if (allNodeObjects.indexOf(allNodeObjects[i], i +1) !== -1)
                        assert(false, 'Some node present in webAppTmplModel in two places simultaneously');
                }
            }

            it('adding add-dom1.html', function(done) {
                loadWebPage(base + 'add-dom1.html').then(domModel => {
                    domModel = JSON.parse(domModel);
                    addDomModel(domModel);
                    makeConsistancyChecks();
                })
                .then(() => done());
            });

            it('adding add-dom2.html', function(done) {
                loadWebPage(base + 'add-dom2.html').then(domModel => {
                    domModel = JSON.parse(domModel);
                    addDomModel(domModel);
                    makeConsistancyChecks();
                })
                .then(() => done());
            });

            it('adding add-dom3.html', function(done) {
                loadWebPage(base + 'add-dom3.html').then(domModel => {
                    domModel = JSON.parse(domModel);
                    addDomModel(domModel);
                    makeConsistancyChecks();
                })
                .then(() => done());
            });

            it('adding add-dom4.html', function(done) {
                loadWebPage(base + 'add-dom4.html').then(domModel => {
                    domModel = JSON.parse(domModel);
                    addDomModel(domModel);
                    makeConsistancyChecks();
                })
                .then(() => done());
            });

        });

    });
});
