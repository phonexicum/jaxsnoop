'use strict';

// main.js starts webCrawlers and delegates execution to controller.js

// ====================================================================================================================
// argparse

const ArgumentParser = require('argparse').ArgumentParser;
const argparse = new ArgumentParser({
    addHelp: true,
    description: 'Example \t nodejs --harmony main.js --settings-dir=./settings/pyforum | bunyan -o short'
});
argparse.addArgument(
        ['-s', '--settings-dir'],
        {help: 'relative path to settings directory', required: true}
    )
const args = argparse.parseArgs();

// ====================================================================================================================
// Includes & Setup

const path = require('path');
const childProcess = require('child_process');

const jaxsnoopSettingsPath = './' + path.join (args.settings_dir, './settings.js');
const jaxsnoopSettings = require(jaxsnoopSettingsPath);
const crawlerSettingsPath = './' + path.join (args.settings_dir, './crawler-settings.js');
const crawlerSettings = require (crawlerSettingsPath);

const ctrlLogger = require('./utils/logging.js').ctrlLogger(jaxsnoopSettings.logLevel);;

const JaxsnoopCtrl = require('./controller/controller.js');


// ====================================================================================================================
class Jaxsnoop {

    // ================================================================================================================
    constructor() {
        this.crawlers = {};
    }

    // ================================================================================================================
    startCrawlers() {

        let waitLoadingCrawlers = [];

        for (let user in crawlerSettings.users) {
            let crawlerInst = childProcess.fork('./crawler/crawler.js',
                ['--expose-gc', '--settings-file', crawlerSettingsPath, '--user-name', user, '--log-level', jaxsnoopSettings.logLevel],
                {stdio: 'inherit'}
            );
            waitLoadingCrawlers.push(
                new Promise( (resolve, reject) => {
                    let handler = m => {
                        if (m.report === 'crawlerReady') {
                            crawlerInst.removeListener('message', handler);
                            resolve('success');
                        }
                    };
                    crawlerInst.on('message', handler);
                })
            );
            this.crawlers[user] = {
                crawlerInst: crawlerInst
            };
            ctrlLogger.debug('Crawler for user', user, 'starting.');
        }

        return Promise.all(waitLoadingCrawlers);
    };
    
    // ================================================================================================================
}


// ====================================================================================================================
// Main

ctrlLogger.trace('JaxSnoop application started.');

let jaxsnoop = new Jaxsnoop();

let workflow = Promise.resolve('success')
.then(result => {
    return jaxsnoop.startCrawlers();
})
.then(result => {
    ctrlLogger.info('Crawlers for all users started.');
    ctrlLogger.trace('Delegating management to controller.');
    new JaxsnoopCtrl(jaxsnoop.crawlers, jaxsnoopSettings).run();
});
