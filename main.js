'use strict';

let crawler = require('./crawler/crawler.js')

let crawlingCtrl = new crawler.CrawlingCtrl();
crawlingCtrl.setupWebBrowsers()
.then(result => {
    return crawlingCtrl.startCrawling();
})
.then(result => {
    return crawlingCtrl.shutdownWebBrowsers();
})
.catch(err => {
    console.log('Errors in crawling process: ' + err);
});
