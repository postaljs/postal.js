#!/bin/sh

anvil -b build-browser-standard.json
anvil -b build-browser-standard-diags.json

cp ./lib/browser/standard/postal.js ./example/amd/js/libs/postal/
cp ./lib/browser/standard/postal.diagnostics.js ./example/amd/js/libs/postal/
cp ./lib/browser/standard/postal.js ./example/standard/js/
cp ./lib/browser/standard/postal.diagnostics.js ./example/standard/js/

mv ./lib/browser/standard/postal.node.js ./lib/node/postal.js
rm ./lib/browser/standard/postal.node*

mv ./lib/browser/standard/postal.diagnostics.node.js ./lib/node/postal.diagnostics.js
rm ./lib/browser/standard/postal.diagnostics.node*