@echo off
REM One-time setup on Windows: creates .venv and installs the packages.
python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
echo.
echo Setup done. In VS Code: Ctrl+Shift+P, "Python: Select Interpreter", choose .venv
pause
