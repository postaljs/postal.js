#!/bin/sh

OutFile='output/nodejs/postal.js'

cp version-header.js $OutFile

# Combine the source files
while read line; do
    cat ../$line >> $OutFile
done < SourceManifest.txt

cat NodeExports.js  >> $OutFile