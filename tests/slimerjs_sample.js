// var util = require('/usr/lib/node_modules/util-slimy/util.js');

// var system = require('system');
// console.error(util.inspect(system, false, 1));


// slimer.exit(1);


// var page = require('webpage').create();
// page.onResourceRequested = function(request) {
//   console.log('Request ' + JSON.stringify(request, undefined, 4));
// };
// page.onResourceReceived = function(response) {
//   console.log('Receive ' + JSON.stringify(response, undefined, 4));
// };
// page.open('http://127.0.0.1:8000/pyforum/default/index');


// var page = require('webpage').create();
// page.open("http://slimerjs.org")
//     .then(function(status){
//          if (status == "success") {
//              console.log("The title of the page is: "+ page.title);
//          }
//          else {
//              console.log("Sorry, the page is not loaded");
//          }
//     });



var fs = require('fs');
var myfifo = fs.open('/home/avasilenko/Desktop/jaxsnoop/tests/myfifo', 'a');
    // {
    //     mode: 'w',
    //     nobuffer: true
    // });
// var util = require('/usr/lib/node_modules/util-slimy/util.js');
// console.log(util.inspect(myfifo, false, null));

myfifo.write("Hello World");
myfifo.write("Hello World");
myfifo.close();

slimer.exit(1);




// var webpage1 = require('webpage').create();

// webpage1
//   .open('http://127.0.0.1:8000/pyforum/default/index') // loads a page

//   .then(function(){ // executed after loading
//     // store a screenshot of the page
//     // webpage.viewportSize =
//     //     { width:650, height:320 };
//     // webpage.render('page.png',
//     //                {onlyViewport:true});
//     // then open a second page
    
//     console.error("first Hifi");

//     return webpage1.open('http://localhost/javadoc/');
//   })

//   .then(function(){
//     // click somewhere on the second page
//     // webpage.sendEvent("click", 5, 5,
//     //                     'left', 0);

//     console.error("second Hifi");
//     // slimer.exit();
//   });

// var webpage2 = require('webpage').create();

// webpage2.open('http://127.0.0.1:8000/pyforum/default/index')
//     .then(function(){
//         console.error("third Hifi");
//         // slimer.exit();
//     });

// // slimer.exit();