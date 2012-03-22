#!/bin/sh

anvil -b build-browser.json
anvil -b build-browser-diags.json

cp ./lib/browser/postal.js ./example/amd/js/libs/postal/
cp ./lib/browser/postal.diagnostics.js ./example/amd/js/libs/postal/
cp ./lib/browser/postal.js ./example/standard/js/
cp ./lib/browser/postal.diagnostics.js ./example/standard/js/

mv ./lib/browser/postal.node.js ./lib/node/postal.js
rm ./lib/browser/postal.node*

mv ./lib/browser/postal.diagnostics.node.js ./lib/node/postal.diagnostics.js
rm ./lib/browser/postal.diagnostics.node*