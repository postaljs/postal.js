#!/bin/sh

anvil

cp ./lib/standard/postal.* ./example/standard/js
cp ./lib/amd/postal.* ./example/amd/js/libs/postal
cp ./lib/amd/postal.js ./example/node/client/js/lib
cp ./lib/node/postal.js ./example/node/messaging