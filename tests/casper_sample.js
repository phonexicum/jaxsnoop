var links = [];
var casper1 = require('casper').create();

function getLinks() {
    var links = document.querySelectorAll('h3.r a');
    return Array.prototype.map.call(links, function(e) {
        return e.getAttribute('href');
    });
}

casper1.start('http://127.0.0.1:8000/pyforum/default/index', function() {
    // search for 'casperjs' from google form
    // this.fill('form[action="/search"]', { q: 'casperjs' }, true);
});

casper1.then(function() {
    // aggregate results for the 'casperjs' search
    // links = this.evaluate(getLinks);
    // // now search for 'phantomjs' by filling the form again
    // this.fill('form[action="/search"]', { q: 'phantomjs' }, true);
    console.log("Hifi 1");
});

casper1.then(function() {
    // aggregate results for the 'phantomjs' search
    // links = links.concat(this.evaluate(getLinks));
    console.log("Hifi 2");
});

casper1.run(function() {
    // echo results in some pretty fashion
    // this.echo(links.length + ' links found:');
    // this.echo(' - ' + links.join('\n - ')).exit();
    console.log("Hifi 3");

    // casper.exit();
});


//var casper2 = require('casper').create();

casper1.start('http://127.0.0.1:8000/pyforum/default/index', function() {
    // search for 'casperjs' from google form
    // this.fill('form[action="/search"]', { q: 'casperjs' }, true);
});

casper1.then(function() {
    // aggregate results for the 'casperjs' search
    // links = this.evaluate(getLinks);
    // // now search for 'phantomjs' by filling the form again
    // this.fill('form[action="/search"]', { q: 'phantomjs' }, true);
    console.log("Hifi 4");
});

casper1.run(function() {
    // echo results in some pretty fashion
    // this.echo(links.length + ' links found:');
    // this.echo(' - ' + links.join('\n - ')).exit();
    console.log("Hifi 5");
    casper.exit();
});