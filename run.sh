#! /bin/bash

node --expose-gc --harmony ./main.js --settings-file=./settings/pyforum.js | bunyan -o short --color
