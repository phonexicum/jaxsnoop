var sleep = require('sleep');
var phridge = require('phridge');

phantomjs1 = phridge.spawn();

phantomjs1.then(function (phantom) {
    // phantom is now a reference to a specific PhantomJS process

    phantom.run(function(){
        console.log("HIFI");
    });

    phantom.run(function(){
        console.log("HIFI 2");
    });

    // node
    phantom.run("h1", function (selector, resolve) {
        // this code runs inside PhantomJS
        
        var util = require('/usr/lib/node_modules/util');
        // console.log ( util.inspect(phantom, false, 1) );
        // console.log(util.inspect({"addCookie":function(){}}, false, 1));
        
        // console.log ( util.inspect(phantom.cookies, false, 1) );

        phantom.addCookie({"name":"cookie_name", "cookie":"cookie_value", "domain":"localhost"});

        console.log ("Here I GO");

        var page = webpage.create();
        page.customHeaders = {
            Referer: "http://google.com"
        };
        page.settings = {
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5)"
        };
        page.open("http://www.google.com", function () {
            var text = page.evaluate(function (selector) {
                return document.querySelector(selector).innerText;
            }, selector);

            // resolve the promise and pass 'text' back to node 
            resolve(text);
        });
    }).then(function (text) {
        // inside node again
        console.log("The element contains the following text: " + text);
    });

});










// phantomjs1.then(function (phantom) {
//     // We are inside phantom

//     // var util = require('util');
//     // util.debug(util.inspect(phantom, false, null));

//     phantom.run(function () {
//         console.log("Hi from PhantomJS");
//     });

//     // phantom is now a reference to a specific PhantomJS process

// });



// phridge.disposeAll().then(function () {
//     sleep.sleep(1);
//     console.log("All processes created by phridge.spawn() have been terminated");
// });


// try {
    // var Spooky = require('spooky');
// } catch (e) {
//     var Spooky = require('../lib/spooky');
// }

// var spooky = new Spooky({
//         child: {
//             transport: 'http',
//             // engine: 'slimerjs'
//             script: '--engine=slimerjs'
//         },
//         casper: {
//             logLevel: 'debug',
//             verbose: true
//         }
//     }, function (err) {
//         if (err) {
//             e = new Error('Failed to initialize SpookyJS');
//             e.details = err;
//             throw e;
//         }

//         spooky.start('http://en.wikipedia.org/wiki/Spooky_the_Tuff_Little_Ghost', function (){
//             this.echo("in casper");
//         });
//         spooky.then(function () {

//             asdf = asdfd;
//             console.error("HIFI");
            
//             this.emit('hello', 'Hello, from ' + this.evaluate(function () {
//                 return document.title;
//             }));
//         });
//         spooky.run();


//         // var x = 'spooky';    
//         // spooky.start('http://example.com/the-page.html');

//         // spooky.then(function () {
//         //   var y = 'casper';
//         //   console.log('x:', x); // -> x: undefined
//         // });

//         // spooky.thenEvaluate(function () {
//         //   console.log('x:', x); // -> x: undefined
//         //   console.log('y:', y); // -> y: undefined
//         // });

//         // spooky.run();

//     });

// spooky.on('error', function (e, stack) {
//     console.error(e);

//     if (stack) {
//         console.log(stack);
//     }
// });

/*
// Uncomment this block to see all of the things Casper has to say.
// There are a lot.
// He has opinions.
spooky.on('console', function (line) {
    console.log(line);
});
*/


// spooky.on('hello', function (greeting) {
//     console.log(greeting);
// });

// spooky.on('log', function (log) {
//     if (log.space === 'remote') {
//         console.log(log.message.replace(/ \- .*/, ''));
//     }
// });




// var path = require('path')
// var childProcess = require('child_process')
// var slimerjs = require('slimerjs')
// var binPath = slimerjs.path

// var childArgs = [
//   path.join(__dirname, 'slimerjs-script.js'),
//   'some other argument (passed to slimerjs script)'
// ]

// childProcess.execFile(binPath, childArgs, function(err, stdout, stderr) {
//   // handle results
// })

