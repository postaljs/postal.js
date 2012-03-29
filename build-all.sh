#!/bin/sh

anvil -b build-browser.json
anvil -b build-browser-diags.json

mv ./lib/standard/postal.amd.js ./lib/amd/postal.js
mv ./lib/standard/postal.amd.min.js ./lib/amd/postal.min.js
mv ./lib/standard/postal.amd.min.gz.js ./lib/amd/postal.min.gz.js
mv ./lib/standard/postal.diagnostics.amd.js ./lib/amd/postal.diagnostics.js
mv ./lib/standard/postal.diagnostics.amd.min.js ./lib/amd/postal.diagnostics.min.js
mv ./lib/standard/postal.diagnostics.amd.min.gz.js ./lib/amd/postal.diagnostics.min.gz.js

mv ./lib/standard/postal.diagnostics.node.js ./lib/node/postal.diagnostics.js
mv ./lib/standard/postal.node.js ./lib/node/postal.js
rm ./lib/standard/postal.diagnostics.node*
rm ./lib/standard/postal.node*

mv ./lib/standard/postal.standard.js ./lib/standard/postal.js
mv ./lib/standard/postal.standard.min.js ./lib/standard/postal.min.js
mv ./lib/standard/postal.standard.min.gz.js ./lib/standard/postal.min.gz.js
mv ./lib/standard/postal.diagnostics.standard.js ./lib/standard/postal.diagnostics.js
mv ./lib/standard/postal.diagnostics.standard.min.js ./lib/standard/postal.diagnostics.min.js
mv ./lib/standard/postal.diagnostics.standard.min.gz.js ./lib/standard/postal.diagnostics.min.gz.js

cp ./lib/standard/postal.* ./example/standard/js
cp ./lib/amd/postal.* ./example/amd/js/libs/postal