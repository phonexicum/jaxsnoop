'use strict';

// ====================================================================================================================
// argparse

const ArgumentParser = require('argparse').ArgumentParser;
const argparse = new ArgumentParser();
argparse.addArgument(
    ['-l', '--log-level'],
    {help: 'logging level', required: true}
);
const args = argparse.parseArgs();

// ====================================================================================================================
// Includes & Setup

const url = require('url');

const ClientProxy = require('ClientProxy');
const proxyLogger = require('../utils/logging.js').proxyLogger(args.log_level);

// ====================================================================================================================
let proxyParams = {
    portNumber: 0,

    filterWhiteList: false,
    urlWhiteList: [],

    filterBlackList: false,
    urlBlackList: [],
};

// ====================================================================================================================
// Utilities

function getUrl(protocol, req) {
    let reqUrl = url.parse(req.url);
    reqUrl.protocol = protocol + ':';
    reqUrl.host = req.headers.host;
    return url.parse(url.format(reqUrl));
}

// ====================================================================================================================
function Intercepter (req, res) {
    let url = req.url;

    

    if (proxyParams.filterWhiteList) {
        if (!proxyParams.urlWhiteList.some((val) => val.test(url))) {

            proxyLogger.debug('Request dropped (whitelist):', url);
            res.statusCode = 423;
            res.statusMessage = 'Locked';
            res.end();
            return false;
        }
    }

    if (proxyParams.filterBlackList) {
        if (proxyParams.urlBlackList.some((val) => val.test(url))) {
            
            proxyLogger.debug('Request dropped (blacklist):', url);
            res.statusCode = 423;
            res.statusMessage = 'Locked';
            res.end();
            return false;
        }
    }
}

// ====================================================================================================================
let webProxy = new ClientProxy((req, res) => {
        // http request intercepter
        
        let reqUrl = getUrl('http', req);
        proxyLogger.trace('connection on url:', reqUrl.href);
        return Intercepter(req, res);

    }, (req, res) => {
        // https request intercepter

        let reqUrl = getUrl('https', req);
        proxyLogger.trace('connection on url:', reqUrl.href);
        return Intercepter(req, res);

    }, (req, res) => {
        // http response intercepter
        res.removeHeader('Strict-Transport-Security');

    }, (req, res) => {
        // https response intercepter
        res.removeHeader('Strict-Transport-Security');

    }, { // CAkeyOptions
        key: '_proxy-cert/proxy.key',
        keySize: 2048,
        cert: '_proxy-cert/proxy.crt'
    }, { // hostKeyOptions - options for server key generation
        keySize: 2048,
        reuseCAkey: true // flag indicating if proxy can reuse CA private key as server key
    },
    true // quietNetErrors
);

webProxy.on('listening', () => {
    proxyLogger.info('proxy server started at port:', webProxy.webProxyPort);
    proxyParams.portNumber = webProxy.webProxyPort;
});

// ====================================================================================================================
process.on('message', m => {

    if (m.command === 'getProxyPort'){
        if (proxyParams.portNumber === 0)
            webProxy.once('listening', () => {
                proxyParams.portNumber = webProxy.webProxyPort
                process.send({
                    report: 'proxyPort',
                    webProxyPort: proxyParams.portNumber
                });
            });
        else
            process.send({
                report: 'proxyPort',
                webProxyPort: proxyParams.portNumber
            });
    }
    else if (m.command === 'filterWhiteList') {
        proxyParams.filterWhiteList = m.whiteListEnable;
        proxyParams.urlWhiteList = m.whiteList.map(val => new RegExp(val.source, val.flags));
    }
    else if (m.command === 'filterBlackList') {
        proxyParams.filterBlackList = m.blackListEnable;
        proxyParams.urlBlackList = m.blackList.map(val => new RegExp(val.source, val.flags));
    }
    else if (m.command === 'start') {
        webProxy.start(proxyParams.portNumber);
        webProxy.once('listening', () => {
            process.send({report: 'listening'});
        });
    }
});
