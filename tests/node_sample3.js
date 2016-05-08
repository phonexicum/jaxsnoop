var slimer = require('node-slimerjs');
slimer.create(function(err, ph) {

    // I am in node

    // var util = require('/usr/lib/node_modules/util-slimy/util.js');
    // console.log(util.inspect(this, false, 1));

    return ph.createPage(function(err, page) {



        var util = require('/usr/lib/node_modules/util-slimy/util.js');
        console.log(util.inspect(webpage, false, null));

        // I am in node


        return page.open("http://tilomitra.com/repository/screenscrape/ajax.html", function(err, status) {

            // var util = require('/usr/lib/node_modules/util-slimy/util.js');
            // console.log(util.inspect(this, false, null));

            //

            console.log("opened site? ", status);
            
            page.includeJs('http://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js', function(err) {
                //jQuery Loaded.
                //Wait for a bit for AJAX content to load on the page. Here, we are waiting 5 seconds.
                setTimeout(function() {

                    return page.evaluate(function() {

                        var h2Arr = [],
                            pArr = [];
                        $('h2').each(function() {
                            h2Arr.push($(this).html());
                        });
                        $('p').each(function() {
                            pArr.push($(this).html());
                        });

                        return {
                            h2: h2Arr,
                            p: pArr
                        };
                    }, function(err, result) {
                        console.log(result);
                        ph.exit();
                    });
                }, 0);
            });
        });
    });
}, {'slimerPath': require('slimerjs').path});
