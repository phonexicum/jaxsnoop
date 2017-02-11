'use strict';

// ====================================================================================================================
// Includes & Setup

const eventEmiter = require('events');
const ctrlEvents = new eventEmiter();

let ctrlLogger = undefined;

// ====================================================================================================================
class JaxsnoopCtrl {

    // ================================================================================================================
    run() {
        
        ctrlLogger.info('Crawling cycle', this.cycles, 'started.');
        
        let workflow = Promise.resolve("success")
        .then(result => {
            let crawlingDonePromises = [];
            for (let userName in this.crawlers) {
                crawlingDonePromises.push(new Promise ((resolve, reject) => {
                    this.crawlers[userName].crawlerInst.once('message', m => {

                        if (m.cycleNum === this.cycles) {
                            if (m.report === 'crawlingDone') {
                                resolve("success");
                            } else {
                                reject(m.failReason);
                            }
                        }
                        
                    });
                }));
            }

            for (let userName in this.crawlers) {
                this.crawlers[userName].crawlerInst.send({
                    'command': 'crawlCurrentState',
                    cycleNum: this.cycles
                });
            }

            return Promise.all(crawlingDonePromises);
        })

        .then(result => {
            ctrlLogger.info('Crawlers crawled current web-application state.');
        })

        .then(result => {
            this.cycles++;
            ctrlEvents.emit('jaxsnoopCtrlRunCycle');
        })

        .catch(error => {
            ctrlLogger.error({
                location: 'Error running jaxsnoop iteration for getting next web-application model state.',
                error: error
            });
        });
    }

    // ================================================================================================================
    constructor(crawlers, jaxsnoopSettings) {
        this.crawlers = crawlers;
        this.cycles = 0;
        this.jaxsnoopSettings = jaxsnoopSettings;

        ctrlLogger = require('../utils/logging.js').ctrlLogger(jaxsnoopSettings.logLevel);

        ctrlEvents.on('jaxsnoopCtrlRunCycle', () => this.run());
    }

    // ================================================================================================================
    destructor(){
        ctrlEvents.removeAllListeners('jaxsnoopCtrlRunCycle');
    }

    // ================================================================================================================
}

module.exports = JaxsnoopCtrl;
