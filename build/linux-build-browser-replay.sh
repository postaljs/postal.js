#!/bin/sh

OutFile='output/browser/postal.replay.js'

cp version-header.js $OutFile

cat ./boilerplate/replay_header.txt  >> $OutFile

# Combine the source files
while read line; do
    cat ../$line >> $OutFile
done < source-browser-replay.txt

cat ./boilerplate/replay_footer.txt  >> $OutFile