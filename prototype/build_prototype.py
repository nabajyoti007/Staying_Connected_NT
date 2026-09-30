"""
Builds the offline prototype (one self-contained HTML file) from the enriched data.

Run from this folder:  python build_prototype.py
Needs: ../data/RemoteConnect_enriched_v4.csv, ../data/mobile-sites-telstra-2018.csv,
       ../data/mobile-sites-telstra-2025.csv, assets/*.geojson, template.html, app.js
Out:   remoteconnect_nt.html  (works with no internet connection)
"""
import json, os
import numpy as np
import pandas as pd
import geopandas as gpd
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
A = lambda f: os.path.join(HERE, "assets", f)

d = pd.read_csv(os.path.join(DATA, "RemoteConnect_enriched_v4.csv"))
points = json.loads(d.to_json(orient="records"))

# Telstra towers inside the NT, 2018 and new by 2025 (same rule as enrich.py: no 2018 site within 1 km)
nt = gpd.read_file(A("nt_outline.geojson")).to_crs(4326).union_all()
def sites(f):
    s = pd.read_csv(os.path.join(DATA, f), low_memory=False)
    return s[s.Longitude.between(126, 141) & s.Latitude.between(-29, -9)].drop_duplicates(["Latitude", "Longitude"]).copy()
xy = lambda z: (lambda g: np.c_[g.x, g.y])(gpd.GeoSeries(gpd.points_from_xy(z.Longitude, z.Latitude), crs=4326).to_crs(3577))
a18, a25 = sites("mobile-sites-telstra-2018.csv"), sites("mobile-sites-telstra-2025.csv")
a25["new"] = cKDTree(xy(a18)).query(xy(a25))[0] > 1000
inside = lambda z: gpd.GeoSeries(gpd.points_from_xy(z.Longitude, z.Latitude), crs=4326).within(nt).values
a18, a25 = a18[inside(a18)], a25[inside(a25)]
new = a25[a25.new]
towers = {"old": a18[["Longitude", "Latitude"]].round(4).values.tolist(),
          "new": new[["Longitude", "Latitude"]].round(4).values.tolist(),
          "newCof": new.Co_funded.eq("Y").tolist(),
          "newProg": new.Co_contribution_program.fillna("Commercial / not stated").tolist(),
          "total2025": int(len(a25))}

# label point for each region: a point guaranteed inside the shape, plus its area for label priority
sa2 = gpd.read_file(A("nt_sa2.geojson")).to_crs(4326)
area = sa2.to_crs(3577).area / 1e6
region_labels = [{"name": r.SA2_NAME21, "lon": round(r.geometry.representative_point().x, 4),
                  "lat": round(r.geometry.representative_point().y, 4), "km2": int(a)}
                 for r, a in zip(sa2.itertuples(), area)]

html = open(os.path.join(HERE, "template.html"), encoding="utf-8").read()
for key, text in [("__POINTS__", json.dumps(points)),
                  ("__SA2__", open(A("nt_sa2.geojson")).read()),
                  ("__OUTLINE__", open(A("nt_outline.geojson")).read()),
                  ("__STATES__", open(A("aus_states.geojson")).read()),
                  ("__LABELS__", open(A("labels.json")).read()),
                  ("__SITES__", json.dumps(towers)),
                  ("__RLABELS__", json.dumps(region_labels)),
                  ("__APP__", open(os.path.join(HERE, "app.js"), encoding="utf-8").read())]:
    html = html.replace(key, text)
open(os.path.join(HERE, "remoteconnect_nt.html"), "w", encoding="utf-8").write(html)
print(f"remoteconnect_nt.html written: {len(points)} places, {len(a18)} towers in 2018, {len(new)} new by 2025")
