"""
RemoteConnect NT — run the whole pipeline in order, then check the results.

    python run_all.py

Steps
  1. src/enrich.py            add network links, cyclones, towers 2018-2025, schools, clinics, satellite
  2. src/cluster.py           machine learning: group places into five kinds (k-means, no labels)
  3. src/score.py             recalculate the checklist and gap scores, and check them
  4. src/analysis_figures.py  presentation charts and every quoted number (outputs/figures)
  5. prototype/build_prototype.py   the offline website (prototype/remoteconnect_nt.html)

Afterwards the headline numbers are compared with the submitted results, so anyone can
confirm they reproduced the same analysis.
"""
import os, subprocess, sys
import pandas as pd

ROOT = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable
env = dict(os.environ, MPLBACKEND="Agg")   # draw charts to files, no screen needed

STEPS = [
    ("1/5  Enrich the base table", [PY, os.path.join(ROOT, "src", "enrich.py")], ROOT),
    ("2/5  Kinds of place (clustering)", [PY, os.path.join(ROOT, "src", "cluster.py")], ROOT),
    ("3/5  Checklist and gap scores", [PY, os.path.join(ROOT, "src", "score.py")], ROOT),
    ("4/5  Figures and findings", [PY, os.path.join(ROOT, "src", "analysis_figures.py")], ROOT),
    ("5/5  Offline website", [PY, os.path.join(ROOT, "prototype", "build_prototype.py")], ROOT),
]
for title, cmd, cwd in STEPS:
    print(f"\n=== {title}")
    r = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True)
    out = (r.stdout or "").strip().splitlines()
    print("\n".join(out[-12:]))
    if r.returncode != 0:
        print(r.stderr[-2000:])
        sys.exit(f"Step failed: {title}")

# ---------------------------------------------------------------- check against the submitted results
print("\n=== Checking results against the submitted analysis")
d = pd.read_csv(os.path.join(ROOT, "data", "RemoteConnect_enriched_v4.csv"))
n = ((d.Nearest_Site_km > 10).astype(int) + (d.Operators_within_50km <= 1).astype(int)
     + (d.SA2_4G_area_indicator < 10).astype(int) + d.Backhaul.eq("Microwave radio").astype(int)
     + (d.Cyclones_100km_30yr >= 10).astype(int))
checks = {
    "places analysed": (len(d), 188),
    "places with 4 of 5 problems": (int((n == 4).sum()), 6),
    "network link known": (int(d.Backhaul.notna().sum()), 81),
    "schools matched": (int(d.Schools.sum()), 66),
    "places with a clinic": (int(d.Has_clinic.sum()), 61),
    "one radio link in cyclone country": (int((d.Resilience_Risk == "Single microwave link in a cyclone-exposed area").sum()), 15),
    "places served by a satellite-linked tower": (int(d.Tower_via_satellite.sum()), 7),
    "Top End communities (largest-problem group)": (int((d.Group == "Top End communities").sum()), 54),
}
ok = True
for k, (got, want) in checks.items():
    flag = "ok " if got == want else "DIFFERENT"
    ok &= got == want
    print(f"  {flag}  {k}: {got} (submitted {want})")
figs = sorted(f for f in os.listdir(os.path.join(ROOT, "outputs", "figures")) if f.endswith(".png"))
html = os.path.join(ROOT, "prototype", "remoteconnect_nt.html")
print(f"  {len(figs)} figures in outputs/figures; website {os.path.getsize(html) // 1024} KB")
print("\nAll results match." if ok else "\nSome results differ: see above.")
