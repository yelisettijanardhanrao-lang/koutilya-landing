@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install Node.js first.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing required packages...
  call npm install
)
echo.
echo Starting Shakarambham website on http://localhost:5500
echo IMPORTANT: Do not use VS Code Live Server for this site.
echo.
call npm start
pause
