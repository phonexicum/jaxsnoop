#! /bin/bash

node --expose-gc --harmony ./main.js --settings-file=./settings/pyforum.js --user-name=member_1 | bunyan -o short --color
