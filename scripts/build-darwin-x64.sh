#!/bin/bash

echo "PWD: $(pwd)"

vue-tsc

rm -rf ./extraResources/whisper/build-darwin-x64

sh ./scripts/cmake-whisper-darwin-x64.sh

npm run rm-dist
vite build
