"""
RemoteConnect NT — analysis and slide figures.

Reproduces every statistic and chart used in the presentation from
RemoteConnect_enriched_v4.csv, the Telstra 2018/2025 site lists and the NT outline.

Run from the project folder:  python src/analysis_figures.py
Out:  outputs/figures/*.png  (1920x1080, one finding per chart)
      outputs/figures/findings.txt  (every number quoted on the slides)
"""
import json, os
import numpy as np
import pandas as pd
import geopandas as gpd
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker
from matplotlib.patches import Patch
from scipy.spatial import cKDTree
from scipy.stats import spearmanr, kruskal

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
DATA = os.environ.get("RC_DATA") or os.path.join(PROJECT, "data")
OUT = os.environ.get("RC_OUT") or os.path.join(PROJECT, "outputs", "figures")
os.makedirs(OUT, exist_ok=True)

INK, SOFT, FAINT, LINE = "#101D25", "#4C5F69", "#8598A1", "#D2DBDF"
TEAL, SAGE, GOLD, ORANGE, WINE = "#2F6F85", "#6FA08C", "#DFAE44", "#CE6F38", "#96263A"
ACCENT = "#15606E"
NC_COL = ["#CBD9DE", "#7FAAB6", "#DFAE44", "#CE6F38", "#96263A"]

plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 17, "axes.edgecolor": LINE, "axes.labelcolor": SOFT,
    "xtick.color": SOFT, "ytick.color": SOFT, "axes.spines.top": False, "axes.spines.right": False,
    "axes.titlesize": 17, "figure.facecolor": "white", "axes.facecolor": "white"})

notes = []
def note(s):
    notes.append(s); print(s)

def frame(title, subtitle, source):
    fig = plt.figure(figsize=(19.2, 10.8), dpi=100)
    fig.text(0.05, 0.925, title, fontsize=34, fontweight="bold", color=INK, va="bottom")
    fig.text(0.05, 0.895, subtitle, fontsize=19, color=SOFT, va="top")
    fig.text(0.05, 0.03, source, fontsize=13, color=FAINT)
    fig.text(0.95, 0.03, "RemoteConnect NT", fontsize=13, color=FAINT, ha="right")
    return fig

def save(fig, name):
    fig.savefig(os.path.join(OUT, name), dpi=100)
    plt.close(fig)

# ------------------------------------------------------------------ data
d = pd.read_csv(os.path.join(DATA, "RemoteConnect_enriched_v4.csv"))
outline = gpd.read_file(os.path.join(DATA, "nt_outline.geojson"))
N = len(d)

CONS = {
    "No mobile site within 10 km": d.Nearest_Site_km > 10,
    "One phone company or none within 50 km": d.Operators_within_50km <= 1,
    "4G covers under 10% of surrounding land": d.SA2_4G_area_indicator < 10,
    "Single microwave link to the network": d.Backhaul.eq("Microwave radio"),
    "10+ cyclones within 100 km since 1995": d.Cyclones_100km_30yr >= 10,
}
d["n_constraints"] = sum(v.astype(int) for v in CONS.values())
DIMS = ["Infrastructure_Gap", "Mobile_Gap", "FiveG_Gap", "Broadband_Gap"]
DLAB = ["Infrastructure", "Mobile", "5G", "Broadband"]
DCOL = [TEAL, SAGE, GOLD, ORANGE]

def nt_axes(fig, rect):
    ax = fig.add_axes(rect)
    outline.plot(ax=ax, color="white", edgecolor="#8FA4AD", linewidth=1.4)
    ax.set_xlim(128.7, 138.3); ax.set_ylim(-26.2, -10.7)
    ax.set_aspect(1 / np.cos(np.radians(18.5)))
    ax.axis("off")
    return ax

# ================================================================== 01 map
fig = frame("Six places carry four of five constraints",
            f"{N} remote NT locations, coloured by how many plain-fact connectivity constraints apply",
            "Sources: NT Government remote communities list; ACCC Mobile Infrastructure Report 2025; ABS SA2 indicators; BoM cyclone tracks.")
ax = nt_axes(fig, [0.0, 0.07, 0.6, 0.77])
for n in range(5):
    s = d[d.n_constraints == n]
    ax.scatter(s.LONGITUDE, s.LATITUDE, s=70 + 70 * n, c=NC_COL[n], edgecolor="white", linewidth=0.8, zorder=3 + n)
top = d[d.n_constraints == d.n_constraints.max()]
top = top.sort_values("Overall_Connectivity_Gap", ascending=False).reset_index(drop=True)
# box on the main map marking the inset
from matplotlib.patches import Rectangle
IX, IY = (131.9, 134.4), (-12.55, -10.8)
ax.add_patch(Rectangle((IX[0], IY[0]), IX[1] - IX[0], IY[1] - IY[0], fill=False, edgecolor=INK, linewidth=1.4, zorder=20))
lg = fig.add_axes([0.6, 0.62, 0.36, 0.25]); lg.axis("off")
lg.text(0, 1, "Constraints that apply", fontsize=19, fontweight="bold", color=INK, va="top")
for k, n in enumerate(range(4, -1, -1)):
    col, row = k // 3, k % 3
    lg.scatter([0.02 + col * 0.5], [0.66 - row * 0.28], s=240, c=NC_COL[n], edgecolor="white")
    lg.text(0.07 + col * 0.5, 0.66 - row * 0.28, f"{n} of 5 · {int((d.n_constraints == n).sum())}", va="center", fontsize=16, color=INK)
lg.set_xlim(0, 1); lg.set_ylim(0, 1)
ins = fig.add_axes([0.6, 0.12, 0.36, 0.46])
outline.plot(ax=ins, color="white", edgecolor="#8FA4AD", linewidth=1.2)
for n in range(5):
    s_ = d[(d.n_constraints == n) & d.LONGITUDE.between(*IX) & d.LATITUDE.between(*IY)]
    ins.scatter(s_.LONGITUDE, s_.LATITUDE, s=90 + 60 * n, c=NC_COL[n], edgecolor="white", linewidth=0.8, zorder=3 + n)
OFF = {"WILGI": (-0.05, 0.28), "ALAMIRRA": (-0.35, 0.18), "MINJILANG": (-0.45, -0.18), "WARRUWI": (0.1, 0.3),
       "ARMORRAN": (0.25, -0.22), "MANDEDJKADJANG": (-0.1, -0.24)}
for _, r in top.iterrows():
    dx, dy = OFF.get(r["SITE NAME"], (0.1, 0.1))
    ins.annotate(r["SITE NAME"].title(), (r.LONGITUDE, r.LATITUDE), xytext=(r.LONGITUDE + dx, r.LATITUDE + dy),
                 fontsize=14, fontweight="bold", color=INK, ha="center", zorder=12,
                 arrowprops=dict(arrowstyle="-", color=SOFT, lw=0.9))
ins.set_xlim(*IX); ins.set_ylim(*IY); ins.set_aspect(1 / np.cos(np.radians(12)))
ins.set_xticks([]); ins.set_yticks([])
for sp in ins.spines.values(): sp.set_visible(True); sp.set_edgecolor(INK); sp.set_linewidth(1.4)
ins.set_title("The six with four of five", loc="left", fontsize=16, fontweight="bold", color=INK, pad=8)
save(fig, "01_map_constraints.png")
note(f"Constraint distribution: {d.n_constraints.value_counts().sort_index().to_dict()}; four-constraint places: {', '.join(top['SITE NAME'])}")

# ================================================================== 02 homes vs land
s = d.groupby("SA2_Name").agg(n=("Location_ID", "size"), prem=("SA2_4G_premises_indicator", "first"),
                              area=("SA2_4G_area_indicator", "first")).sort_values("prem")
fig = frame("4G reaches homes, not the roads between them",
            "Share of premises and share of land with 4G, for each SA2 region containing the 188 locations",
            "Source: SA2 mobile coverage indicators (premises and land area). Regional figures, not community measurements.")
ax = fig.add_axes([0.34, 0.1, 0.6, 0.75])
y = np.arange(len(s))
ax.hlines(y, s.area, s.prem, color="#C9D4D9", linewidth=4, zorder=1)
ax.scatter(s.area, y, s=200, color="#9FC1CB", zorder=2, label="share of land with 4G")
ax.scatter(s.prem, y, s=200, color=TEAL, zorder=3, label="share of homes with 4G")
ax.set_yticks(y); ax.set_yticklabels([f"{n}  ({c})" for n, c in zip(s.index, s.n)], fontsize=15)
ax.set_xlim(0, 100); ax.set_xlabel("per cent")
ax.xaxis.grid(True, color="#EEF2F3"); ax.set_axisbelow(True)
ax.legend(loc="lower right", frameon=False, fontsize=16)
mp, ma = d.SA2_4G_premises_indicator.mean(), d.SA2_4G_area_indicator.mean()
fig.text(0.04, 0.55, f"{mp:.0f}%", fontsize=64, fontweight="bold", color=TEAL)
fig.text(0.04, 0.51, "of homes", fontsize=18, color=SOFT)
fig.text(0.04, 0.36, f"{ma:.0f}%", fontsize=64, fontweight="bold", color="#7FA8B8")
fig.text(0.04, 0.32, "of land", fontsize=18, color=SOFT)
fig.text(0.04, 0.22, "average across\nthe 188 locations", fontsize=14, color=FAINT)
save(fig, "02_homes_vs_land.png")
note(f"4G: mean premises {mp:.1f}% vs land {ma:.1f}% across locations")

# ================================================================== 03 who is served
g = d.groupby("SITE TYPE").agg(n=("Location_ID", "size"), near=("Nearest_Site_km", "median"),
                               gap=("Overall_Connectivity_Gap", "median")).loc[["COMMUNITY", "VILLAGE", "HIGHWAY", "TOURISM"]]
p_kw = kruskal(*[x.Overall_Connectivity_Gap for _, x in d.groupby("SITE TYPE")]).pvalue
fig = frame("Tourist stops are closer to towers than communities are",
            "Median distance to the nearest mobile site, by location type",
            f"Source: ACCC Mobile Infrastructure Report 2025 site lists. Gap scores differ by type, Kruskal–Wallis p = {p_kw:.4f}.")
ax = fig.add_axes([0.1, 0.12, 0.8, 0.7])
labels = [f"{t.title()}\n{int(r.n)} locations" for t, r in g.iterrows()]
cols = [WINE, ORANGE, SAGE, TEAL]
b = ax.bar(labels, g.near, color=cols, width=0.6)
for bar_, v in zip(b, g.near):
    ax.text(bar_.get_x() + bar_.get_width() / 2, v + 0.08, f"{v:.1f} km", ha="center", fontsize=24, fontweight="bold", color=INK)
ax.set_ylabel("median km to nearest site"); ax.set_ylim(0, g.near.max() * 1.25)
ax.yaxis.grid(True, color="#EEF2F3"); ax.set_axisbelow(True)
save(fig, "03_who_is_served.png")
note(f"Median nearest site by type: {g.near.round(2).to_dict()}; Kruskal-Wallis on gap p={p_kw:.4f}")

# ================================================================== 04 small places, one company
x = d.dropna(subset=["POPULATION"]).copy()
x["band"] = pd.cut(x.POPULATION, [0, 20, 100, 300, 5000], labels=["under 20", "20–99", "100–299", "300+"])
gb = x.groupby("band", observed=True).agg(n=("POPULATION", "size"), near=("Nearest_Site_km", "median"),
                                          one=("Operators_within_50km", lambda s: (s <= 1).mean() * 100))
r_pop = spearmanr(x.POPULATION, x.Nearest_Site_km)
fig = frame("Smaller places sit further from towers",
            f"{len(x)} locations with a recorded population. Choice is thin at every size: even towns of 300+ often have one company",
            f"Sources: NT Government community list; ACCC 2025 sites. Population vs distance: Spearman ρ = {r_pop.statistic:.2f}, p < 0.001.")
a1 = fig.add_axes([0.07, 0.13, 0.4, 0.66]); a2 = fig.add_axes([0.56, 0.13, 0.4, 0.66])
lab = [f"{i}\n({int(n)})" for i, n in zip(gb.index, gb.n)]
b1 = a1.bar(lab, gb.near, color=[WINE, ORANGE, SAGE, TEAL], width=0.62)
for bb, v in zip(b1, gb.near):
    a1.text(bb.get_x() + bb.get_width() / 2, v + 0.15, f"{v:.1f} km", ha="center", fontsize=19, fontweight="bold", color=INK)
a1.set_title("Median distance to nearest site", loc="left", color=INK, fontsize=19, pad=14)
a1.set_ylim(0, gb.near.max() * 1.25); a1.set_xlabel("population")
b2 = a2.bar(lab, gb.one, color="#4A6E7C", width=0.62)
for bb, v in zip(b2, gb.one):
    a2.text(bb.get_x() + bb.get_width() / 2, v + 1.5, f"{v:.0f}%", ha="center", fontsize=19, fontweight="bold", color=INK)
a2.set_title("Only one phone company within 50 km", loc="left", color=INK, fontsize=19, pad=14)
a2.set_ylim(0, 100); a2.set_xlabel("population")
for a in (a1, a2): a.yaxis.grid(True, color="#EEF2F3"); a.set_axisbelow(True)
save(fig, "04_size_and_choice.png")
note(f"Population vs nearest site rho={r_pop.statistic:.2f} p={r_pop.pvalue:.2e}; one-operator share by band {gb.one.round(0).to_dict()}; overall one operator {int((d.Operators_within_50km<=1).sum())}/{N}")

# ================================================================== 05 sources disagree
bins = np.arange(0, 95, 5)
fig = frame(f"For {int((d.Evidence_Spread >= 20).sum())} of {N} locations, the datasets tell different stories",
            "Points between the highest and lowest of the four dimension scores at each location",
            "Scores built from ACCC site data and SA2 coverage and broadband indicators.")
ax = fig.add_axes([0.07, 0.12, 0.86, 0.66])
for lo, hi, col, lab in [(0, 20, TEAL, "Sources agree"), (20, 40, GOLD, "Partly agree"), (40, 90, WINE, "Sources disagree")]:
    ax.axvspan(lo, hi, color=col, alpha=0.07)
    cnt = int(((d.Evidence_Spread >= lo) & (d.Evidence_Spread < hi)).sum())
    ax.text((lo + hi) / 2, 1.0, f"{lab}\n{cnt}", transform=ax.get_xaxis_transform(), ha="center", va="bottom",
            fontsize=18, fontweight="bold", color=col)
h, e = np.histogram(d.Evidence_Spread, bins=bins)
ax.bar(e[:-1] + 2.5, h, width=4.3, color=[TEAL if v < 20 else GOLD if v < 40 else WINE for v in e[:-1]])
ax.set_xlim(0, 90); ax.set_xlabel("points between highest and lowest source"); ax.set_ylabel("locations")
ax.yaxis.grid(True, color="#EEF2F3"); ax.set_axisbelow(True)
save(fig, "05_sources_disagree.png")
note(f"Spread classes: agree {(d.Evidence_Spread<20).sum()}, partly {((d.Evidence_Spread>=20)&(d.Evidence_Spread<40)).sum()}, disagree {(d.Evidence_Spread>=40).sum()}")

# ================================================================== 06 same score, different problem
srt = d.sort_values("Overall_Connectivity_Gap").reset_index(drop=True)
best = None
for i in range(len(srt)):
    for j in range(i + 1, len(srt)):
        if srt.Overall_Connectivity_Gap[j] - srt.Overall_Connectivity_Gap[i] > 1: break
        dist = max(abs(srt[c][i] - srt[c][j]) for c in DIMS)
        if best is None or dist > best[0]: best = (dist, i, j)
A, B = srt.loc[best[1]], srt.loc[best[2]]
fig = frame("Same score, different problem",
            f"{A['SITE NAME'].title()} and {B['SITE NAME'].title()} sit within a point of each other overall",
            "Each dimension is a percentile against the 188 locations. Overall = 0.35 infra + 0.25 mobile + 0.20 5G + 0.20 broadband.")
for k, (r, rect) in enumerate([(A, [0.13, 0.14, 0.34, 0.62]), (B, [0.61, 0.14, 0.34, 0.62])]):
    ax = fig.add_axes(rect)
    vals = [r[c] for c in DIMS]
    ax.barh(DLAB[::-1], vals[::-1], color=DCOL[::-1], height=0.6)
    for yy, v in enumerate(vals[::-1]):
        ax.text(v + 1.5, yy, f"{v:.1f}", va="center", fontsize=20, fontweight="bold", color=INK)
    ax.set_xlim(0, 100)
    ax.set_title(f"{r['SITE NAME'].title()}   overall {r.Overall_Connectivity_Gap}", loc="left", fontsize=22,
                 fontweight="bold", color=INK, pad=14)
    ax.xaxis.grid(True, color="#EEF2F3"); ax.set_axisbelow(True)
save(fig, "06_same_score.png")
note(f"Twin pair: {A['SITE NAME']} ({A.Overall_Connectivity_Gap}) vs {B['SITE NAME']} ({B.Overall_Connectivity_Gap}); max dimension gap {best[0]:.1f}")

# ================================================================== 07 investment went to need
grp = d.groupby("Need_2018", observed=True).agg(d18=("Telstra_nearest_2018_km", "median"),
                                                d25=("Telstra_nearest_2025_km", "median"),
                                                gained=("New_Telstra_sites_25km", lambda s: (s > 0).mean() * 100))
order = ["Closest 25% in 2018", "2nd", "3rd", "Furthest 25% in 2018"]
grp = grp.loc[order]
rho_inv = spearmanr(d.Telstra_nearest_2018_km, -d.Nearest_change_km)
fig = frame("New towers went where they were needed",
            "Median distance to the nearest Telstra site, 2018 and 2025, by how far locations were in 2018",
            f"Source: ACCC Mobile Infrastructure Report, Telstra site lists 2018 and 2025. 2018 distance vs improvement: ρ = {rho_inv.statistic:.2f}.")
ax = fig.add_axes([0.2, 0.14, 0.52, 0.66])
yy = np.arange(len(grp))[::-1]
nice = ["Closest quarter", "Second quarter", "Third quarter", "Furthest quarter"]
ax.hlines(yy, grp.d25, grp.d18, color="#C9D4D9", linewidth=6)
ax.scatter(grp.d18, yy, s=320, color="#B6C3C8", zorder=3, label="2018")
ax.scatter(grp.d25, yy, s=320, color=ACCENT, zorder=4, label="2025")
for y_, a_, b_ in zip(yy, grp.d18, grp.d25):
    ax.text(a_ + 2, y_ + 0.18, f"{a_:.1f} km", fontsize=16, color=SOFT)
    if abs(a_ - b_) > 3: ax.text(b_, y_ - 0.34, f"{b_:.1f} km", fontsize=16, color=ACCENT, ha="center")
ax.set_yticks(yy); ax.set_yticklabels(nice, fontsize=17)
ax.set_xlabel("km to nearest Telstra site"); ax.legend(frameon=False, loc="upper right", fontsize=16)
ax.xaxis.grid(True, color="#EEF2F3"); ax.set_axisbelow(True)
ax2 = fig.add_axes([0.78, 0.14, 0.18, 0.66]); ax2.axis("off")
ax2.text(0, 0.85, f"{grp.gained.iloc[-1]:.0f}%", fontsize=62, fontweight="bold", color=ACCENT)
ax2.text(0, 0.73, "of the furthest quarter\ngained a new site\nwithin 25 km", fontsize=16, color=SOFT, va="top")
ax2.text(0, 0.35, f"{grp.gained.iloc[0]:.0f}%", fontsize=62, fontweight="bold", color="#9FB1B8")
ax2.text(0, 0.23, "of the closest\nquarter did", fontsize=16, color=SOFT, va="top")
save(fig, "07_investment_to_need.png")
note(f"Investment: medians {grp[['d18','d25']].round(1).to_dict('index')}; gained within 25 km {grp.gained.round(0).to_dict()}; rho={rho_inv.statistic:.2f}")

# ================================================================== 08 new sites map + still waiting
a18 = pd.read_csv(os.path.join(DATA, "mobile-sites-telstra-2018.csv"), low_memory=False)
a25 = pd.read_csv(os.path.join(DATA, "mobile-sites-telstra-2025.csv"), low_memory=False)
box = lambda z: z[z.Longitude.between(126, 141) & z.Latitude.between(-29, -9)].drop_duplicates(["Latitude", "Longitude"]).copy()
a18, a25 = box(a18), box(a25)
to_xy = lambda z: (lambda gs: np.c_[gs.x, gs.y])(gpd.GeoSeries(gpd.points_from_xy(z.Longitude, z.Latitude), crs=4326).to_crs(3577))
dist, _ = cKDTree(to_xy(a18)).query(to_xy(a25))
a25["new"] = dist > 1000
nt_poly = outline.to_crs(4326).union_all()
inside = lambda z: gpd.GeoSeries(gpd.points_from_xy(z.Longitude, z.Latitude), crs=4326).within(nt_poly).values
a18_nt, a25_nt = a18[inside(a18)], a25[inside(a25)]
new = a25_nt[a25_nt.new]
cof = int(new.Co_funded.eq("Y").sum())
note(f"NT-only Telstra sites: 2018 {len(a18_nt)}, 2025 {len(a25_nt)}, new {len(new)}, co-funded {cof} ({cof/len(new)*100:.0f}%); region incl. border {len(a18)}->{len(a25)}, new {int(a25.new.sum())}")
d["rank"] = d.Overall_Connectivity_Gap.rank(ascending=False, method="min").astype(int)
far = d[d.Need_2018 == "Furthest 25% in 2018"]
left = far[(far.New_Telstra_sites_25km == 0) & (far.Nearest_change_km >= -1)].sort_values("Overall_Connectivity_Gap", ascending=False)
fig = frame(f"{len(new)} new Telstra sites in the NT since 2018, {cof} publicly co-funded",
            "Telstra sites in 2018 and new sites by 2025. Red rings: far from service in 2018 and still waiting",
            "Source: ACCC Mobile Infrastructure Report 2018 and 2025. New = no 2018 site within 1 km. 2018 list may omit some small cells.")
ax = nt_axes(fig, [0.0, 0.08, 0.58, 0.77])
ax.scatter(a18_nt.Longitude, a18_nt.Latitude, s=28, c="#B6C3C8", zorder=3)
ax.scatter(new[new.Co_funded.eq("Y")].Longitude, new[new.Co_funded.eq("Y")].Latitude, s=70, c=ACCENT, edgecolor="white", zorder=4)
ax.scatter(new[~new.Co_funded.eq("Y")].Longitude, new[~new.Co_funded.eq("Y")].Latitude, s=70, c=GOLD, edgecolor="white", zorder=4)
ax.scatter(left.LONGITUDE, left.LATITUDE, s=420, facecolor="none", edgecolor=WINE, linewidth=2.5, zorder=5)
ax.legend(handles=[Patch(color="#B6C3C8", label="site in 2018"), Patch(color=ACCENT, label="new, government co-funded"),
                   Patch(color=GOLD, label="new, commercial or not stated"),
                   Patch(facecolor="white", edgecolor=WINE, label="still waiting")],
          loc="upper left", frameon=False, fontsize=14, bbox_to_anchor=(1.02, 0.12))
tx = fig.add_axes([0.6, 0.3, 0.36, 0.56]); tx.axis("off")
tx.text(0, 1, "Still waiting", fontsize=24, fontweight="bold", color=WINE, va="top")
tx.text(0, 0.92, "In the furthest quarter in 2018, no new site within 25 km", fontsize=15, color=SOFT, va="top")
for k, (_, r) in enumerate(left.iterrows()):
    yy_ = 0.8 - k * 0.135
    tx.text(0, yy_, r["SITE NAME"].title(), fontsize=19, fontweight="bold", color=INK)
    tx.text(0, yy_ - 0.055, f"rank {r['rank']} · {r.Telstra_nearest_2025_km:.0f} km to Telstra in 2025", fontsize=14, color=SOFT)
save(fig, "08_new_sites_map.png")
note(f"New sites {len(new)}, co-funded {cof}; still waiting: {', '.join(left['SITE NAME'])}")

# ================================================================== 09 one link, cyclone country
mw = d[d.Backhaul.eq("Microwave radio")].sort_values("Cyclones_100km_30yr")
thr = d.Cyclones_100km_30yr.quantile(0.6)
fig = frame(f"{int((mw.Cyclones_100km_30yr >= thr).sum())} communities: one microwave link, cyclone country",
            "Communities connected to the network by microwave radio, and cyclones passing within 100 km since 1995",
            "Sources: NT Government remote communities list (backhaul, 2019); BoM tropical cyclone track database.")
ax = fig.add_axes([0.24, 0.1, 0.7, 0.76])
cols = [WINE if v >= thr else "#B6C3C8" for v in mw.Cyclones_100km_30yr]
ax.barh(mw["SITE NAME"].str.title(), mw.Cyclones_100km_30yr, color=cols, height=0.7)
for yy_, v in enumerate(mw.Cyclones_100km_30yr):
    ax.text(v + 0.3, yy_, str(v), va="center", fontsize=14, color=INK)
ax.set_xlabel("cyclones within 100 km since 1995"); ax.tick_params(axis="y", labelsize=14)
ax.xaxis.set_major_locator(matplotlib.ticker.MaxNLocator(integer=True))
ax.xaxis.grid(True, color="#EEF2F3"); ax.set_axisbelow(True)
save(fig, "09_one_link_cyclones.png")
note(f"Microwave backhaul {len(mw)}; with cyclone count >= {thr:.0f}: {int((mw.Cyclones_100km_30yr>=thr).sum())}")

# ================================================================== 10 robustness
SC = {"Infrastructure first": (50, 20, 10, 20), "Mobile first": (25, 45, 15, 15),
      "Broadband first": (25, 20, 15, 40), "Equal weights": (25, 25, 25, 25)}
rb = d.Overall_Connectivity_Gap.rank(ascending=False, method="first")
rows = []
for k, w in SC.items():
    sc = sum(d[c] * wi for c, wi in zip(DIMS, w)) / sum(w)
    rn = sc.rank(ascending=False, method="first")
    rows.append((k, spearmanr(rb, rn).statistic, int(((rb <= 20) & (rn <= 20)).sum())))
rows = pd.DataFrame(rows, columns=["scenario", "rho", "held"])
rho_cl = spearmanr(d.n_constraints, d.Overall_Connectivity_Gap).statistic
fig = frame("The ranking holds when the weights change",
            "Base weights 35 / 25 / 20 / 20 compared with four alternatives",
            f"Spearman rank correlation with the base ranking; top 20 retention. Checklist vs weighted score: ρ = {rho_cl:.2f}; both rank Wilgi and Mandedjkadjang first and second.")
a1 = fig.add_axes([0.19, 0.14, 0.33, 0.64]); a2 = fig.add_axes([0.6, 0.14, 0.33, 0.64])
b1 = a1.barh(rows.scenario[::-1], rows.rho[::-1], color=ACCENT, height=0.55)
for bb, v in zip(b1, rows.rho[::-1]): a1.text(v + 0.005, bb.get_y() + bb.get_height() / 2, f"{v:.2f}", va="center", fontsize=19, fontweight="bold")
a1.set_xlim(0.8, 1.02); a1.axvline(0.9, color=WINE, linestyle="--", linewidth=1.5)
a1.set_title("Rank correlation with base", loc="left", fontsize=19, color=INK, pad=14)
b2 = a2.barh(rows.scenario[::-1], rows.held[::-1], color="#4A6E7C", height=0.55)
for bb, v in zip(b2, rows.held[::-1]): a2.text(v + 0.3, bb.get_y() + bb.get_height() / 2, f"{v} of 20", va="center", fontsize=19, fontweight="bold")
a2.set_xlim(0, 23); a2.set_yticks([]); a2.set_xticks([0, 5, 10, 15, 20])
a2.set_title("Base top 20 still in top 20", loc="left", fontsize=19, color=INK, pad=14)
save(fig, "10_robustness.png")
note("Sensitivity: " + "; ".join(f"{r.scenario} rho={r.rho:.2f} held={r.held}/20" for r in rows.itertuples()) + f"; checklist vs score rho={rho_cl:.2f}")


# ================================================================== 11 schools and clinics
d["has_clinic"] = d.Clinic_name.notna()
sch, cli = d[d.Schools > 0], d[d.has_clinic]
both = d[(d.Schools > 0) & d.has_clinic & (d.n_constraints >= 3)].sort_values("POPULATION", ascending=False)
part = cli[cli.Clinic_visiting_only.fillna(False).astype(bool) | cli.Clinic_limited_days.fillna(False).astype(bool)]
fig = frame(f"School and clinic both at risk in {len(both)} places",
            f"Places with both a school and a clinic, and 3 or more connection problems. {int(sch.Schools.sum())} schools and {len(cli)} clinics matched in total",
            "Sources: NT Government School List (data.nt.gov.au); NT Government Remote health services (nt.gov.au, Aug 2026). Matched by place name, checked by hand.")
ax = fig.add_axes([0.26, 0.14, 0.4, 0.66])
rows_ = [("3 or more problems", (sch.n_constraints >= 3).mean(), (cli.n_constraints >= 3).mean()),
         ("Only one phone company", (sch.Operators_within_50km <= 1).mean(), (cli.Operators_within_50km <= 1).mean()),
         ("Single radio link", sch.Backhaul.eq("Microwave radio").mean(), cli.Backhaul.eq("Microwave radio").mean())]
yy = np.arange(len(rows_))[::-1]
ax.barh(yy + 0.2, [r[1] * 100 for r in rows_], height=0.36, color=TEAL, label=f"places with a school ({len(sch)})")
ax.barh(yy - 0.2, [r[2] * 100 for r in rows_], height=0.36, color=WINE, label=f"places with a clinic ({len(cli)})")
for y_, r in zip(yy, rows_):
    ax.text(r[1] * 100 + 1, y_ + 0.2, f"{r[1]*100:.0f}%", va="center", fontsize=16)
    ax.text(r[2] * 100 + 1, y_ - 0.2, f"{r[2]*100:.0f}%", va="center", fontsize=16)
ax.set_yticks(yy); ax.set_yticklabels([r[0] for r in rows_], fontsize=17); ax.set_xlim(0, 100)
ax.legend(frameon=False, loc="lower right", fontsize=15); ax.xaxis.grid(True, color="#EEF2F3"); ax.set_axisbelow(True)
tx = fig.add_axes([0.71, 0.14, 0.26, 0.66]); tx.axis("off")
tx.text(0, 1, "Largest of the 15", fontsize=18, fontweight="bold", color=INK, va="top")
for k, (_, r) in enumerate(both.head(8).iterrows()):
    tx.text(0, 0.9 - k * 0.085, f"{r['SITE NAME'].title()}", fontsize=16, color=INK)
    tx.text(1, 0.9 - k * 0.085, f"{int(r.POPULATION):,}" if pd.notna(r.POPULATION) else "", fontsize=16, color=SOFT, ha="right")
tx.text(0, 0.12, f"{len(part)} clinics are open part of the week or visiting only,\nso people rely on phone and video between visits.", fontsize=14, color=SOFT)
save(fig, "11_schools_clinics.png")
note(f"Schools {int(sch.Schools.sum())} at {len(sch)} places; clinics {len(cli)}; both + 3+ problems {len(both)}: {', '.join(both['SITE NAME'])}; "
     f"clinic places one company {int((cli.Operators_within_50km<=1).sum())}/{len(cli)}, radio {int(cli.Backhaul.eq('Microwave radio').sum())}/{len(cli)}; "
     f"school places one company {int((sch.Operators_within_50km<=1).sum())}/{len(sch)}, radio {int(sch.Backhaul.eq('Microwave radio').sum())}/{len(sch)}; "
     f"part-week/visiting clinics {len(part)}; community controlled {int(cli.Clinic_community_controlled.fillna(False).astype(bool).sum())}/{len(cli)}")

# ================================================================== 12 coverage maps disagree
fig = frame("Phone companies' own maps measure differently",
            "Outdoor 4G coverage as a share of roof-aerial coverage, as reported by the ACCC in 2023",
            "Source: Telstra letter to the ACCC, 1 March 2024 (ACCC Mobile Infrastructure Report data release), quoting the ACCC 2023 report.")
ax = fig.add_axes([0.2, 0.18, 0.44, 0.6])
vals = [("Optus", 83, SAGE), ("TPG", 74, "#9CBF9A"), ("Telstra, 2023 method", 52, WINE)]
ax.barh([v[0] for v in vals][::-1], [v[1] for v in vals][::-1], color=[v[2] for v in vals][::-1], height=0.55)
for y_, v in enumerate(vals[::-1]): ax.text(v[1] + 1.5, y_, f"{v[1]}%", va="center", fontsize=22, fontweight="bold")
ax.set_xlim(0, 100); ax.tick_params(axis="y", labelsize=18)
tx = fig.add_axes([0.68, 0.18, 0.28, 0.6]); tx.axis("off")
tx.text(0, 0.95, "Same towers, different method,\ndifferent map.", fontsize=20, fontweight="bold", color=INK, va="top")
tx.text(0, 0.62, "Telstra told the ACCC its \"outdoor\"\nlayer had been its older handheld\nlayer renamed, so it had been\nunderestimating its own outdoor\ncoverage for some time.", fontsize=15, color=SOFT, va="top")
save(fig, "12_coverage_maps_disagree.png")
note("Coverage-map consistency: ACCC 2023 outdoor/external-antenna ratio Optus 83%, TPG 74%, Telstra 52%; Telstra methodology letter 1 Mar 2024")

# ================================================================== 13 where the fixes are
sec = d[(d.Nearest_Site_km <= 10) & (d.Operators_within_50km <= 1)]
far_ = d[d.Nearest_Site_km > 10]
fig = frame("The cheapest fix is a second network on towers that already exist",
            "Two groups of places, and the fix that suits each",
            "Sources: ACCC 2025 site lists; NT Government community list; ACMA radio licence register (satellite ground stations). Recorded population only.")
for k, (grp, ttl, fix, col) in enumerate([(sec, "Tower within 10 km, but only one phone company", "Add a second network to the existing tower", ACCENT),
                                          (far_, "More than 10 km from any tower", "Use low-orbit satellite", GOLD)]):
    x0 = 0.06 + k * 0.47
    fig.text(x0, 0.78, ttl, fontsize=19, fontweight="bold", color=INK)
    fig.text(x0, 0.63, f"{len(grp)}", fontsize=80, fontweight="bold", color=col)
    fig.text(x0 + 0.1, 0.66, "places", fontsize=20, color=SOFT)
    stats = [("recorded people", f"{int(round(grp.POPULATION.sum(), -2)):,}" if grp.POPULATION.sum() > 1000 else f"{int(grp.POPULATION.sum())}"),
             ("with a school", str(int((grp.Schools > 0).sum()))), ("with a health clinic", str(int(grp.Clinic_name.notna().sum())))]
    for j, (a, b) in enumerate(stats):
        fig.text(x0, 0.5 - j * 0.07, b, fontsize=24, fontweight="bold", color=INK)
        fig.text(x0 + 0.1, 0.5 - j * 0.07, a, fontsize=17, color=SOFT)
    fig.text(x0, 0.18, "Fix: " + fix, fontsize=19, color=col, fontweight="bold")
fig.text(0.53, 0.12, "OneWeb, Starlink and Amazon Kuiper already hold licensed ground stations in the NT.", fontsize=14, color=SOFT)
save(fig, "13_where_the_fixes_are.png")
note(f"Second-network opportunity: {len(sec)} places, recorded people {int(sec.POPULATION.sum())}, schools {int((sec.Schools>0).sum())}, clinics {int(sec.Clinic_name.notna().sum())}; "
     f"far >10 km: {len(far_)} places, recorded people {int(far_.POPULATION.sum())}, schools {int((far_.Schools>0).sum())}, clinics {int(far_.Clinic_name.notna().sum())}")

# ================================================================== satellite and alternatives (figures quoted in the prototype)
note(f"Satellite: places in regions with 90%+ satellite-only homes {int((d.SA2_NBN_satellite_premises_indicator>=90).sum())}; "
     f"places served by a satellite small cell (nearest Telstra site within 10 km) {int(d.Tower_via_satellite.sum())}; "
     f"community Wi-Fi among our places {d.Community_WiFi.value_counts().to_dict()}; ADII 2023 scores {d.dropna(subset=['ADII_2023_score'])[['SITE NAME','ADII_2023_score']].values.tolist()}")
# ================================================================== 14 kinds of place (from cluster.py)
if "Group" in d.columns:
    GC = {"Top End communities": "#B3521F", "Coastal and Gulf towns": "#2A6F97", "Desert communities": "#C9A227",
          "Outstations near towns": "#6B5CA5", "Near towns and Kakadu": "#1E8A5A"}
    fig = frame("Five kinds of place, five kinds of fix",
                "Groups found by k-means clustering on seven measures, with no labels. All six places with four problems fall in one group",
                "k = 5: silhouette 0.33, stability (adjusted Rand index, 20 bootstrap refits) 0.84. Sources as for the other figures.")
    ax = nt_axes(fig, [0.0, 0.08, 0.5, 0.77])
    for g_, c_ in GC.items():
        s_ = d[d.Group == g_]; ax.scatter(s_.LONGITUDE, s_.LATITUDE, s=90, c=c_, edgecolor="white", linewidth=0.8, zorder=4)
    tx = fig.add_axes([0.52, 0.12, 0.45, 0.72]); tx.axis("off")
    for k, (g_, c_) in enumerate(GC.items()):
        m_ = d[d.Group == g_]; y_ = 0.95 - k * 0.2
        tx.scatter([0.01], [y_ - 0.01], s=260, c=c_)
        tx.text(0.05, y_, f"{g_}  ({len(m_)} places, {m_.n_constraints.mean():.1f} problems on average)", fontsize=17, fontweight="bold", color=INK, va="center")
        tx.text(0.05, y_ - 0.07, m_.Group_fix.iloc[0], fontsize=14, color=SOFT, va="center", wrap=True)
    tx.set_xlim(0, 1); tx.set_ylim(0, 1)
    save(fig, "14_kinds_of_place.png")
    note("Kinds of place: " + "; ".join(f"{g_} {int((d.Group==g_).sum())} (avg problems {d[d.Group==g_].n_constraints.mean():.2f})" for g_ in GC))
with open(os.path.join(OUT, "findings.txt"), "w") as f:
    f.write("\n".join(notes) + "\n")
print(f"\n{len(os.listdir(OUT))} files written to {OUT}/")
