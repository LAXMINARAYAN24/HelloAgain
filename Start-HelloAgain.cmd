@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo First run: install dependencies with npm ci, then run this file again.
  pause
  exit /b 1
)
if not exist dist\index.html (
  call npm run build
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:4310 in your browser after the ready message.
call npm start
pause
