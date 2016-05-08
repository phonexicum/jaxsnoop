var Spooky = require('spooky');

var spooky = new Spooky({
        child: {
            transport: 'http',
            engine: 'slimerjs'
        },
        casper: {
            logLevel: 'debug',
            verbose: true
        }
    }, function (err) {
        if (err) {
            e = new Error('Failed to initialize SpookyJS');
            e.details = err;
            throw e;
        }

        spooky.start(
            'http://en.wikipedia.org/wiki/Spooky_the_Tuff_Little_Ghost');
        spooky.then(function () {
            this.emit('hello', 'Hello, from ' + this.evaluate(function () {
                return document.title;
            }));
        });
        spooky.run();
    });

spooky.on('error', function (e, stack) {
    console.error(e);

    if (stack) {
        console.log(stack);
    }
});


// Uncomment this block to see all of the things Casper has to say.
// There are a lot.
// He has opinions.
spooky.on('console', function (line) {
    console.log(line);
});


spooky.on('hello', function (greeting) {
    console.log(greeting);
});

spooky.on('log', function (log) {
    if (log.space === 'remote') {
        console.log(log.message.replace(/ \- .*/, ''));
    }
});





// var phantom = require('phantom');

// var sitepage = null;
// var phInstance = null;
// phantom.create()
//     .then(instance => {
//         phInstance = instance;
//         return instance.createPage();
//     })
//     .then(page => {
//         sitepage = page;
//         return page.open('https://stackoverflow.com/');
//     })
//     .then(status => {
//         console.log(status);
//         return sitepage.property('content');
//     })
//     .then(content => {
//         console.log(content);
//         sitepage.close();
//         phInstance.exit();
//     })
//     .catch(error => {
//         console.log(error);
//         phInstance.exit();
//     });


