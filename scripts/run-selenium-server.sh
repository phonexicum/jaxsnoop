#! /bin/bash
java -jar -Dwebdriver.gecko.driver=./selenium-server-standalone/geckodriver -Dwebdriver.chrome.driver=./selenium-server-standalone/chromedriver ./selenium-server-standalone/selenium-server-standalone-3.4.0.jar # -timeout 30
