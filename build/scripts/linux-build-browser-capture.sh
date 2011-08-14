#!/bin/sh

OutFile='../output/browser/postal.capture.js'

cp ./version-header.js $OutFile

cat ../boilerplate/generic_closure_header.txt  >> $OutFile

# Combine the source files
while read line; do
    cat ../../$line >> $OutFile
done < source-browser-capture.txt

cat ../boilerplate/generic_closure_footer.txt  >> $OutFile