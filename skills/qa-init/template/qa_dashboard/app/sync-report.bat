@echo off
setlocal
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0sync-report.ps1"
set "sync_exit=%ERRORLEVEL%"
echo.
if not "%sync_exit%"=="0" (
  echo Report sync failed with exit code %sync_exit%.
) else (
  echo Report sync completed successfully.
)
pause
exit /b %sync_exit%
