'use strict';

let crawler = require('./crawler/crawler.js')

let crawlingCtrl = new crawler.CrawlingCtrl();
crawlingCtrl.setupWebBrowsers()
.then(() => {
    // process.on('SIGINT', function() {
    //     console.log('Caught interrupt signal');

    //     crawlingCtrl.shutdownWebBrowsers()
    //     .then(() => {
    //         process.exit();
    //     });
    // });
})
.then(result => {
    return crawlingCtrl.startCrawling();
})
.catch(err => {
    console.log(err);
})
.then(() => {
    return crawlingCtrl.shutdownWebBrowsers();
})
.catch(err => {
    console.log(err);
});
