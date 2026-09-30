"""
RemoteConnect NT — the two ways each place is assessed, recalculated from raw inputs.

1. The five-problem checklist (the main method shown in the prototype).
   Each problem is simply true or false; the count is how many are true. No weights.

2. The gap score (0-100), a finer ranking used for comparison and the priorities tool.
   Every raw input is turned into a percentile against the 188 places, combined into
   four parts, and the parts are combined into one overall score.

This script recalculates both from the base table and checks the gap scores against the
values stored by the data preparation notebooks. It writes outputs/score_check.csv.

Run from the project folder:  python src/score.py
"""
import os
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
DATA = os.environ.get("RC_DATA") or os.path.join(PROJECT, "data")
OUT = os.environ.get("RC_OUT_DIR") or os.path.join(PROJECT, "outputs")
os.makedirs(OUT, exist_ok=True)
d = pd.read_csv(os.path.join(DATA, "RemoteConnect_enriched_v4.csv"))


def worse_if_higher(col):
    """Percentile 0-100 where a HIGHER raw value means a worse position (e.g. distance)."""
    return d[col].rank(pct=True) * 100


def worse_if_lower(col):
    """Percentile 0-100 where a LOWER raw value means a worse position (e.g. coverage)."""
    return (-d[col]).rank(pct=True) * 100


# ---------------------------------------------------------------- 1. five-problem checklist
PROBLEMS = {
    "No phone tower within 10 km": d.Nearest_Site_km > 10,
    "One phone company or none within 50 km": d.Operators_within_50km <= 1,
    "4G covers under 10% of the surrounding land": d.SA2_4G_area_indicator < 10,
    "Single microwave radio link to the network": d.Backhaul.eq("Microwave radio"),
    "10 or more cyclones within 100 km since 1995": d.Cyclones_100km_30yr >= 10,
}
d["Problems_found"] = sum(v.astype(int) for v in PROBLEMS.values())

# ---------------------------------------------------------------- 2. gap score, four parts
# Towers nearby (the only part measured at the place itself)
towers = (0.4 * worse_if_higher("Nearest_Site_km")
          + 0.3 * worse_if_lower("Sites_within_25km")
          + 0.3 * worse_if_lower("Operators_within_50km"))
# 4G and 5G in the region: land counts more than homes, because people travel between communities
mobile = 0.4 * worse_if_lower("SA2_4G_premises_indicator") + 0.6 * worse_if_lower("SA2_4G_area_indicator")
fiveg = 0.4 * worse_if_lower("SA2_5G_premises_indicator") + 0.6 * worse_if_lower("SA2_5G_area_indicator")
# Home internet in the region: fixed line best, then fixed wireless; satellite-only is the weakest position
home = (0.4 * worse_if_lower("SA2_NBN_fixed_line_premises_indicator")
        + 0.3 * worse_if_lower("SA2_NBN_fixed_wireless_premises_indicator")
        + 0.3 * worse_if_higher("SA2_NBN_satellite_premises_indicator"))
# Overall: 35 / 25 / 20 / 20. These weights are a stated choice; see the priorities tool and the
# sensitivity results in outputs/figures/findings.txt for how much the ranking depends on them.
overall = 0.35 * towers + 0.25 * mobile + 0.20 * fiveg + 0.20 * home

check = pd.DataFrame({
    "Location_ID": d.Location_ID, "Place": d["SITE NAME"], "Problems_found": d.Problems_found,
    "Towers_recalc": towers.round(1), "Towers_stored": d.Infrastructure_Gap,
    "4G_recalc": mobile.round(1), "4G_stored": d.Mobile_Gap,
    "5G_recalc": fiveg.round(1), "5G_stored": d.FiveG_Gap,
    "Home_internet_recalc": home.round(1), "Home_internet_stored": d.Broadband_Gap,
    "Overall_recalc": overall.round(1), "Overall_stored": d.Overall_Connectivity_Gap,
})
check.to_csv(os.path.join(OUT, "score_check.csv"), index=False)

print("Five-problem checklist:")
for name, v in PROBLEMS.items():
    print(f"  {int(v.sum()):3d}  {name}")
print("  places by number of problems:", d.Problems_found.value_counts().sort_index().to_dict())
print("\nGap score recalculated from raw inputs, largest difference from stored value:")
for part, (a, b) in {"Towers nearby": (towers, d.Infrastructure_Gap), "4G in region": (mobile, d.Mobile_Gap),
                     "5G in region": (fiveg, d.FiveG_Gap), "Home internet": (home, d.Broadband_Gap),
                     "Overall": (overall, d.Overall_Connectivity_Gap)}.items():
    print(f"  {part:15s} {float((a - b).abs().max()):.2f} points")
print("  (differences under 1 point come from rounding at each step in the original notebooks)")
