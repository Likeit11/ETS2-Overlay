@echo off
chcp 65001 >nul

echo [1/3] Checking Telemetry Server status...
tasklist /FI "IMAGENAME eq Ets2Telemetry.exe" 2>NUL | find /I /N "Ets2Telemetry.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo Telemetry Server is already running. Skipping startup...
) else (
    echo Starting Telemetry Server...
    cd /d "%~dp0ets2-telemetry-server\server"
    start "" "Ets2Telemetry.exe"
)

echo [2/3] Opening Transparent In-Game Overlay...
cd /d "%~dp0"
start "" "node_modules\electron\dist\electron.exe" overlay-main.js

if "%~1"=="" (
    echo [3/3] No game command received. Standalone mode.
) else (
    echo [3/3] Launching game via Steam...
    %*
)

exit
