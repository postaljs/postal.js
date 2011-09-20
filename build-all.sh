#!/bin/sh

anvil -b build-browser.json
anvil -b build-browser-diags.json
anvil -b build-node.json
anvil -b build-node-diags.json