#!/bin/sh

OutFile='../output/browser/postal.js'

cp ./version-header.js $OutFile

cat ../boilerplate/browser_header.txt  >> $OutFile

# Combine the source files
while read line; do
    cat ../../$line >> $OutFile
done < source-browser-postal.txt

cat ../boilerplate/browser_footer.txt  >> $OutFile

DiagOutFile='../output/browser/postal.diagnostics.js'
cat ../../src/Diagnostics.js  >> $DiagOutFile