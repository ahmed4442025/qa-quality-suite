@echo off
title QA Dashboard
cd /d "%~dp0"
echo =======================================================
echo   Starting QA Dashboard...
echo   Keep this window open while using the dashboard.
echo   Press Ctrl+C to stop the server anytime.
echo =======================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0app\server.ps1"
if errorlevel 1 (
    echo.
    echo [ERROR] Server encountered an error.
    pause
)
