var util = require('/usr/lib/node_modules/slimy-util/util.js');

var system = require('system');
console.error(util.inspect(system, false, 1));


slimer.exit(1);


var page = require('webpage').create();
page.onResourceRequested = function(request) {
  console.log('Request ' + JSON.stringify(request, undefined, 4));
};
page.onResourceReceived = function(response) {
  console.log('Receive ' + JSON.stringify(response, undefined, 4));
};
page.open('http://127.0.0.1:8000/pyforum/default/index');




var webpage1 = require('webpage').create();

webpage1
  .open('http://127.0.0.1:8000/pyforum/default/index') // loads a page

  .then(function(){ // executed after loading
    // store a screenshot of the page
    // webpage.viewportSize =
    //     { width:650, height:320 };
    // webpage.render('page.png',
    //                {onlyViewport:true});
    // then open a second page
    
    console.error("first Hifi");

    return webpage1.open('http://localhost/javadoc/');
  })

  .then(function(){
    // click somewhere on the second page
    // webpage.sendEvent("click", 5, 5,
    //                     'left', 0);

    console.error("second Hifi");
    // slimer.exit();
  });

var webpage2 = require('webpage').create();

webpage2.open('http://127.0.0.1:8000/pyforum/default/index')
    .then(function(){
        console.error("third Hifi");
        // slimer.exit();
    });

// slimer.exit();