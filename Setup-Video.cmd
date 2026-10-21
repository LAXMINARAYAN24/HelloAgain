@echo off
cd /d "%~dp0"
echo Setting up local camera screening. This downloads the model and Python packages.
python -m venv .venv
if errorlevel 1 (
  echo Python 3.11 or 3.12 is required. Install Python and run this again.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -m pip install -r requirements-video.txt
if errorlevel 1 (
  echo Setup did not finish. Check the message above and try again.
  pause
  exit /b 1
)
echo Video screening is installed. Restart HelloAgain to enable calls.
pause
