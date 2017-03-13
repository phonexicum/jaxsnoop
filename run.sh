#! /bin/bash
node --expose-gc --harmony main.js --settings-dir=./settings/pyforum | bunyan -o short --color
