#!/bin/bash

CURRENT_DIR="$(dirname "$0")"

WHISPER_DIR="${CURRENT_DIR}/../extraResources/whisper-gpu"
BUILD_DIR="${WHISPER_DIR}/build"

cmake.exe -S "$WHISPER_DIR" -B "$BUILD_DIR" -D WHISPER_CUBLAS=1
cmake.exe --build "$BUILD_DIR" --config release
