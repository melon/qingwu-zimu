vue-tsc

$CURRENT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path

$BUILD_EXE_SCRIPT = Join-Path $CURRENT_DIR ".\cmake-whisper-win32-x64.ps1"

. $BUILD_EXE_SCRIPT

$BUILD_GPU_EXE_SCRIPT = Join-Path $CURRENT_DIR ".\cmake-whisper-win32-x64-gpu.ps1"

. $BUILD_GPU_EXE_SCRIPT

npm run rm-dist
vite build
