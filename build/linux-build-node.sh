#!/bin/sh

OutFile='output/nodejs/postal.js'

cp version-header.js $OutFile

# Combine the source files
while read line; do
    cat ../$line >> $OutFile
done < SourceManifest-node.txt

cat ./boilerplate/node_footer.txt  >> $OutFile