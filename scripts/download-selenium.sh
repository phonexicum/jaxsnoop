#! /bin/bash

echo 'Downloaded versions: selenium - v3.0.1, geckodriver - v0.13.0 - linux64, chromedriver - v2.27 - linux64'
echo 'For installation of newer versions set url addresses in this script'

SELENIUM_URL='http://selenium-release.storage.googleapis.com/3.0/selenium-server-standalone-3.0.1.jar'
GECKODRIVER_URL='https://github.com/mozilla/geckodriver/releases/download/v0.13.0/geckodriver-v0.13.0-linux64.tar.gz' # Firefox
CHROMEDRIVER_URL='https://chromedriver.storage.googleapis.com/2.27/chromedriver_linux64.zip' # Chrome

# =================

mkdir -p selenium-server-standalone
cd selenium-server-standalone

curl -O $SELENIUM_URL
curl -L $GECKODRIVER_URL | tar xz

TMP_FILE='chromedriver_linux64.zip'
curl $CHROMEDRIVER_URL -o $TMP_FILE
unzip $TMP_FILE
rm $TMP_FILE

cd ../
