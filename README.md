# jaxsnoop
AJAX web-crawler based on nodejs and selenium-webdriver.

*Nothing works, project still in its first stages.*

Theory basis for this project can be found at https://phonexicum.github.io/infosec/jaxsnoop.html

## Table of Contents

1. [Crawlers ideas](#crawlers-ideas)
1. [TODO list (approximate plan of development)](#todo-list)
1. [Possible libraries](#possible-libraries)
1. [Choosing technologies](#choosing-technologies)
1. [Dump](#dump)

## Crawlers ideas

CrawlJax, htcap

## TODO list

Getting the global oriented graph of web-app web-state for all users

- constructing web-state for one user without trigerring events

    - preprocessing of each downloaded web-page
        - function of downloading web-page in slimer and wait for its full load
        - function of looking through loaded by slimer web-page and generating tree of clickable elements and some of their characteristis. tree must correlate with web-page DOM
        - function, which will decide if the targeted DOM-element is clickable by user. Create some base of identificators for such elements.

    - write primitive graph-library with functions:

        - graph must contain in itself spanning tree in explicit form
        - function for adding and removing nodes
        - function of applying specified func to all nodes
        - function of searching for vertex with specified by some func properties
        - function for searching the path from one vertex to another and to search from initial vertex to another

    - creation of data structure (oriented graph) to store captured DOM and its clickables after preprocessing

    - crawling without triggering state-changing clickables

        - function for selecting clickable from graph (first of all from current web-page) (or reload other page - function for reloading) to be triggered to get into new state, preprocess it, add to graph, etc.
        - function-handler of new queries to web-server to stop web-server state-changing clickables, if smth blocked - mark loaded web-page as unconsistent

    - add to preprocessing

        - function for detecting similarities

            between:
                
            - stored DOM-pages
            - elements of DOM-pages

            sub-functions:

            - fragmentation of current web-page into potential duplicate elements
            - function for fragmentation of other web-pages
            - function for comparison of currently loaded web-page with previously loaded and extracting the diffences

                - several rules must be written
                - comparison must be done with appropriate ignoring of web-page content

            - function for calculation of tree edit distance with considering of some content

            - in case of detecting similarities, they must be moved into separated vertex of oriented graph

- functions in slimer and nodejs for passing user web-states oriented graphs into nodejs (serialization/deserialization)

- analyzing global users web-state

    - adapting oriented graph-library from slimerjs to nodejs 
    - writing serialization and deserialization of collected global web-states

    - function for adding global users web-state into oriented graph of site web-states

        - function to compare currently gotten global web-state with previously recorded for deteting already known states

    - function for selecting some web-state changing clickable.
    - function for passing the selected choice of changing clickable to appropriate slimerjs (with according user) and
        
        function in slimerjs to load necessary web-page state and trigger the clickable

    - function to make an order to slimer crawlers for gathering new users web-state

    - adding stopping requirements (amount of time, or amount of states, etc.)

- adding functional to slimer crawlers of one users web-state

    - function of checking if user is still logged in

After getting graph, basing on the same code-base must be written crawler for authorization vulnerabilities:

Slimerjs crawlers for per-users web-state will be the same

- getting current global users web-state and searching in oriented graph the current position

- selecting the clickable of interest in the oriented graph

- changing the current global state into the state of interest (after searching the path in oriented graph) (through passing the sequence of commands to slimerjs crawlers with appropriate user role)

- passing the command to slimerjs to click the clickable of interest and getting the answer

- function of classifying the answer, if it succeeded, if yes - writing a bug report for user (writing the hole path in oriented graph of global web-states)

improving the software:

- add various blacklists and whitelists as an option

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
