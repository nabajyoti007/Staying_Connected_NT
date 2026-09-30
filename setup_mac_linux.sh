#!/bin/sh
# One-time setup on macOS or Linux: creates .venv and installs the packages.
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
echo "Setup done. In VS Code: Cmd+Shift+P, 'Python: Select Interpreter', choose .venv"
