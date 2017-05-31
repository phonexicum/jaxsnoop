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

    allowPosts: true,
    postsCounter: 0
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
function Intercepter (req, res, connectionType) {
    let url = getUrl(connectionType, req).href;

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

    if (req.method === 'POST' || req.method === 'DELETE' || req.method === 'PUT' || req.method === 'PATCH') {
        proxyParams.postsCounter ++;

        if (proxyParams.allowPosts === false) {
            proxyLogger.debug('Request dropped (no posts):', url);
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
        return Intercepter(req, res, 'http');

    }, (req, res) => {
        // https request intercepter

        let reqUrl = getUrl('https', req);
        proxyLogger.trace('connection on url:', reqUrl.href);
        return Intercepter(req, res, 'https');

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
    else if (m.command === 'allow-posts') {
        proxyParams.allowPosts = true;
        proxyLogger.trace('POSTs allowed.');
        process.send({report: 'allow-posts'});
    }
    else if (m.command === 'forbid-posts') {
        proxyParams.allowPosts = false;
        proxyLogger.trace('POSTs forbided.');
        process.send({report: 'forbid-posts'});
    }
    else if (m.command === 'drop-posts-counter') {
        proxyParams.postsCounter = 0;
        process.send({report: 'drop-posts-counter'});
    }
    else if (m.command === 'get-posts-counter') {
        process.send({report: 'posts-counter', postsCounter: proxyParams.postsCounter});
    }
});
