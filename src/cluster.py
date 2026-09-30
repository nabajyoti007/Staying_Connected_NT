"""
RemoteConnect NT — kinds of place (unsupervised machine learning).

Groups the 188 places by what their connectivity looks like, with no labels and no weights:
k-means on seven standardised measures. k = 5 was chosen because it was the most stable
solution (mean adjusted Rand index 0.84 across 20 bootstrap refits) with a silhouette of 0.33.
Groups are named from their profiles by fixed rules, so names don't depend on label order.

Run from the project folder:  python src/cluster.py   (updates data/RemoteConnect_enriched_v4.csv in place)
"""
import os
import numpy as np, pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score, adjusted_rand_score

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
DATA = os.environ.get("RC_DATA") or os.path.join(PROJECT, "data")
TABLE = os.path.join(DATA, "RemoteConnect_enriched_v4.csv")
d = pd.read_csv(TABLE).drop(columns=["Group", "Group_fix"], errors="ignore")
X = pd.DataFrame({
    "log distance to nearest tower": np.log1p(d.Nearest_Site_km),
    "phone companies within 50 km": d.Operators_within_50km,
    "log towers within 25 km": np.log1p(d.Sites_within_25km),
    "4G share of land (region)": d.SA2_4G_area_indicator,
    "4G share of homes (region)": d.SA2_4G_premises_indicator,
    "satellite-only homes (region)": d.SA2_NBN_satellite_premises_indicator,
    "cyclones within 100 km since 1995": d.Cyclones_100km_30yr,
})
# Key step: put every measure on the same scale (mean 0, spread 1) so kilometres, counts and
# percentages count equally in the distance between places.
Z = StandardScaler().fit_transform(X)
K = 5
km = KMeans(K, n_init=50, random_state=0).fit(Z)
lab = km.labels_
sil = silhouette_score(Z, lab)
# Stability check: refit on 20 resamples of the places and compare with the full-data groups.
# 1.0 would mean identical groups every time.
aris = []
for s in range(20):
    idx = np.random.default_rng(s).choice(len(Z), len(Z), replace=True)
    aris.append(adjusted_rand_score(lab, KMeans(K, n_init=10, random_state=s).fit(Z[idx]).predict(Z)))

# Name the groups from their average profile with fixed rules, so the names never depend on
# the arbitrary label numbers k-means assigns.
prof = X.assign(g=lab, near=d.Nearest_Site_km).groupby("g").mean()
names = {}
left = set(prof.index)
g = prof.loc[list(left), "4G share of land (region)"].idxmax(); names[g] = "Near towns and Kakadu"; left.discard(g)
g = prof.loc[list(left), "near"].idxmax(); names[g] = "Outstations near towns"; left.discard(g)
g = prof.loc[list(left), "cyclones within 100 km since 1995"].idxmin(); names[g] = "Desert communities"; left.discard(g)
g = prof.loc[list(left), "4G share of homes (region)"].idxmax(); names[g] = "Coastal and Gulf towns"; left.discard(g)
names[left.pop()] = "Top End communities"
FIX = {
    "Near towns and Kakadu": "Keep services reliable; lowest priority for new infrastructure.",
    "Desert communities": "Coverage on the roads between communities, from roadside towers or future satellite-to-phone services.",
    "Top End communities": "A second phone company, better 4G in the community, and a backup link for storms.",
    "Coastal and Gulf towns": "A second phone company on the existing tower, and a backup link for cyclone season.",
    "Outstations near towns": "Small cells or community Wi-Fi to reach the last few kilometres from the nearby network.",
}
d["Group"] = [names[x] for x in lab]
d["Group_fix"] = d.Group.map(FIX)
d.to_csv(TABLE, index=False)
print(f"k={K} silhouette={sil:.3f} stability ARI={np.mean(aris):.2f}")
print(d.Group.value_counts().to_string())
