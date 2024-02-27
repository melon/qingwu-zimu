#!/bin/bash

CURRENT_DIR="$(dirname "$0")"

WHISPER_DIR="${CURRENT_DIR}/../extraResources/whisper"
BUILD_DIR="${WHISPER_DIR}/build-darwin-x64"

cmake -S "$WHISPER_DIR" -B "$BUILD_DIR"
cmake --build "$BUILD_DIR" --config Release
