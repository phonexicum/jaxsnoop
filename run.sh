#! /bin/bash
nodejs --harmony controller.js --settings-dir=./settings/pyforum | bunyan -o short
