#! /bin/bash

# node --debug-brk=16452 --expose-gc --harmony crawler/crawler.js --settings-file=./settings/pyforum/crawler-settings.js --user-name=member_1 --log-level=trace | bunyan -o short --color
node $* | bunyan -o short --color
