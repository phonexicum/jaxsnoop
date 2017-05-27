'use strict';

const assert = require('assert');
const path = require('path');

// ====================================================================================================================
const webdriver = require('selenium-webdriver');
const wdBy = webdriver.By, wdUntil = webdriver.until;

// ====================================================================================================================
describe('crawler', () => {
    describe('#checkSettingUpCrawlersThroughProxy()', () => {
        let crawler = null;
        let driver = null;

        before(function() {
            this.timeout(10*1000);
            process.argv.push('-s', './test/_resources/crawler/empty-webApp-settings.js');
            crawler = require('../../crawler/crawler.js');
            process.argv.pop();
            process.argv.pop();
        });

        after(function(done) {
            this.timeout(10*1000);
            driver.browserClient.close();
            driver.browserClient.quit();
            driver.browserClient.controlFlow().execute(() => done());
        });

        it ('check loading duckduckgo.com web-page', function(done) {
            this.timeout(15*1000);

            driver = new crawler.Crawler('fake-user-name');
            driver.setup()
            .then(() => driver.browserClient.get('https://duckduckgo.com/'))
            .then(() => driver.browserClient.findElement(wdBy.name('q')).sendKeys('selenium-webdriver'))
            .then(() => driver.browserClient.findElement(wdBy.id('search_button_homepage')).click())
            .then(() => driver.browserClient.getTitle())
            .then(title => {
                assert.strictEqual(title, 'selenium-webdriver at DuckDuckGo');
            }).then(() => {
                driver.browserClient.controlFlow().execute(() => done());
            }).catch(err => {
                assert(false, 'Error: ' + err);
            });

            // www.google.com
            // driver.browserClient.get('http://www.google.com/ncr');
            // driver.browserClient.findElement(wdBy.name('q')).sendKeys('webdriver', webdriver.Key.ENTER);
            // driver.browserClient.wait(wdUntil.titleIs('webdriver - Google Search'), 1000);
            // driver.browserClient.quit();
        });

    });
});
