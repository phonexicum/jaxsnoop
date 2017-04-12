'use strict';

var assert = require('assert');

// ====================================================================================================================
const webdriver = require('selenium-webdriver'),
    wdCapabilities = require('selenium-webdriver/lib/capabilities'),
    firefox = require('selenium-webdriver/firefox');

const GenerateDOMCopy = require('../../crawler/copying-DOM.js').GenerateDOMCopy;
const utils = require('../../utils/utils.js');
const model = require('../../model/model.js');
const nodeHandlers = require('../../model/node-handlers.js');

// ====================================================================================================================
describe('crawler', () => {
    describe('#checkDOMmodelCreation()', () => {
        let browser = null;
        
        before(() => {
            browser = new webdriver.Builder()
                .forBrowser('firefox')
                .usingServer('http://localhost:4444/wd/hub')
                .build();
        });

        it('check absence of SyntaxErrors and TypeErrors', function (done) {
            this.timeout(7000);

            // browser.get('file:///home/avasilenko/Desktop/jaxsnoop/html/test_resources/test_dom.html');
            browser.get('file://' + __dirname + '/../_resources/test1-dom.html');

            browser.executeScript(GenerateDOMCopy, utils.yieldTreeNodes,
                'function ' + model.NodeProcessing.getDomNodeDraft.toString(),
                nodeHandlers.checkNodeIsBlacklisted, nodeHandlers.getPropertiesOfDOMnode);

            browser.close();
            browser.quit();
            
            browser.controlFlow().execute(() => {
                done();
            });
        });
    });
});
