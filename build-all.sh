#!/bin/sh

anvil -b build-browser-standard.json
anvil -b build-browser-standard-diags.json
anvil -b build-browser-amd.json
anvil -b build-browser-amd-diags.json
anvil -b build-node.json
anvil -b build-node-diags.json

cp ./lib/browser/amd/postal.js ./example/amd/js/libs/postal/
cp ./lib/browser/amd/postal.diagnostics.js ./example/amd/js/libs/postal/
cp ./lib/browser/standard/postal.js ./example/standard/js/
cp ./lib/browser/standard/postal.diagnostics.js ./example/standard/js/