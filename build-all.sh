#!/bin/sh

if [ ! -f ./node_modules/anvil.js/bin/anvil ] ; then
  echo "anvil.js was not found."
  echo "Make you sure you do npm install!"
  exit
fi

./node_modules/anvil.js/bin/anvil -b build-browser.json

mv ./lib/standard/postal.amd.js ./lib/amd/postal.js
mv ./lib/standard/postal.amd.min.js ./lib/amd/postal.min.js

mv ./lib/standard/postal.node.js ./lib/node/postal.js
rm ./lib/standard/postal.node*

mv ./lib/standard/postal.standard.js ./lib/standard/postal.js
mv ./lib/standard/postal.standard.min.js ./lib/standard/postal.min.js

cp ./lib/standard/postal.* ./example/standard/js
cp ./lib/amd/postal.* ./example/amd/js/libs/postal
cp ./lib/amd/postal.js ./example/node/client/js/lib
cp ./lib/node/postal.js ./example/node/messaging
