# jaxsnoop
AJAX web-crawler based on nodejs and selenium-webdriver.

*This project is not ready-to-use framework. It is buggy, complicated and must be improved to become really usable.*

Theory basis for this project can be found at https://phonexicum.github.io/infosec/jaxsnoop.html

## Table of Contents

1. [Crawlers ideas](#crawlers-ideas)
1. [TODO list (approximate plan of development)](#todo-list)
1. [Possible libraries](#possible-libraries)
1. [Choosing technologies](#choosing-technologies)
1. [Dump](#dump)

## Crawlers ideas

CrawlJax, htcap

## Possible libraries

Possile graph libraries:  
https://www.npmjs.com/package/graph.js  
https://www.npmjs.com/package/digraphe  
https://www.npmjs.com/package/jsgraph

Tree edit distance:  
https://github.com/hoonto/jqgram

Possible python BeautifulSoup analogue to manipulate and parse DOM:  
https://github.com/cheeriojs/cheerio

## Choosing technologies

#### Single-threated

For now I am solving the problem of detecting authorization vulnerabilities. Thus I will use my crawler from only two different users. Thus I can not make more then x2 parallelizm. Meaning this is not critical acceleration and I will lay down the idea of parallel crawling till the better time.

#### Selenium

All browser tries to support remoute management (mainly for sites test purposes). Obvious leader in driving browsers are **selenium**.

In case of selenium browser management chain look like:

    Programming language ->
        selenium **webdriver** for programming language (language library) ->
            selenium webserver (manages browsers instances and translates commands of *selenium standart* to browser driver) ->
                browser driver (written by vendor for browser management) ->
                    browser (e.g firefox, chrome, edge, phantomjs, etc.)

Alternatives:
* slimerjs (works only with firefox and uses old javascript and slimerjs scripts greatly bounded with available libraries (this is not nodejs)).

    After an attempt, slimerjs was rejected, too many crunches and boundaries. (e.g slimerjs stdio problem: https://github.com/laurentj/slimerjs/issues/478)

* phantomjs, casperjs
* casperjs (based on slimerjs or phantomjs)
    
    Drawback: you must fully construct suite for page processing and only after that run it. I choose slimer on its own, because you can create web page and make actions on it in motion.

#### JavaScript (nodejs)

Selenium webdriver available for: java, python, javascript, c#, ruby, php, perl.
I decided to use javascript for my project.

#### selenium-webdriver

There are several javascript webdriver implementations: https://www.slant.co/topics/2814/~node-js-selenium-webdriver-client-libraries-bindings .Oobvious leaders: webdriverio and webdriverjs (selenium-webdriver):

* webdriverio - synchronous implementation of asynchronous browser commands (you may not worry about promises). Main goal: make it easier to write selenium tests.
* selenium-webdriver - official javascript selenium webdriver implementation. webdriverjs code probably less clean but has more abilities.

Code comparison example can be found here: https://github.com/webdriverio/webdriverio/issues/138

I use selenium-webdriver version "3.0.0-beta-3", because of error `WebDriverError: Firefox option was set, but is not a FirefoxOption: {}` (see more https://github.com/seleniumhq/selenium/issues/3115)

#### proxy-server (client side)

This project demand ability to intercept and drop some requests from browser. Selenium has weak capabilities (`CaptureNetworkTraffic`), therefore I will use some proxy-server (which is needed to be online configurable).

* (BMP) Browser Mob Proxy - very discussed option in internet (https://github.com/lightbody/browsermob-proxy) (http://bmp.lightbody.net/ (https://keshavtechinfo.wordpress.com/web-automation/selenium/web-page-load-testing-using-selenium-and-browsermob-proxy/)
* Firebug + NetExport plugin: http://www.seleniumtests.com/2012/10/capture-network-traffic-using-webdriver.html
* self-made proxy. I created standalone project https://github.com/phonexicum/ClientProxy (proxy-server is based on https://www.npmjs.com/package/http-proxy and the idea in https://newspaint.wordpress.com/2012/11/05/node-js-http-and-https-proxy/)

I choose to use self-made proxy. Probably this is not the best solution, maybe it is better to use some well-known programmable proxy server (e.g BrowserMob proxy (https://github.com/lightbody/browsermob-proxy#rest-api) or burpsuite).

---

# Dummy

---

* [https://github.com/webdriverio/webdriverrtc] - enables your client instance to grep statistical data from a running WebRTC peer connection (webdriver >= v4.0)
* [https://github.com/webdriverio/browserevent] - experimental feature that helps you to listen on events within the browser. It is currently only supported in Chrome browser (webdriver < v3.0 - ?)

---

Logging:
I prefered to pipe crawlers messages into nodejs through stdio, because I think for now it will work faster, not to use network.  
Messages has special format.

---

The only two modules suited to connect slimer and node: spooky and node-phantom-simple. I refused from both of them, because it is ubnormal to write functions for slimer in node files, there must be interface to 'connect' them, not to include one into another - so there is no appropriate module.

phantomjs can not be used instead of slimerjs, because it has no promises

---
