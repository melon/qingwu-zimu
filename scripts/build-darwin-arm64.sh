#!/bin/bash

echo "PWD: $(pwd)"

vue-tsc

rm -rf ./extraResources/whisper/build-darwin-arm64
rm -rf ./extraResources/whisper/build-darwin-arm64-coreml

sh ./scripts/cmake-whisper-darwin-arm64.sh
sh ./scripts/cmake-whisper-darwin-arm64-coreml.sh

npm run rm-dist
vite build
