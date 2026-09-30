"""Open the built website in your default browser (run after run_all.py)."""
import sys, webbrowser
from pathlib import Path
site = Path(__file__).resolve().parent / "prototype" / "remoteconnect_nt.html"
if not site.exists():
    sys.exit("The website hasn't been built yet. Run run_all.py first.")
webbrowser.open(site.as_uri())
print("Opened:", site)
