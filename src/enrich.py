"""
RemoteConnect NT — enrichment step.

Takes the base analysis table (RemoteConnect_Final_Analysis_v.csv, produced by the team's
data preparation notebooks) and adds every field used by the prototype and the presentation:

  1. Network link (backhaul) per place      NT Government remote communities list
  2. Cyclone exposure since 1995            Bureau of Meteorology track database
  3. Telstra towers, 2018 against 2025      ACCC Mobile Infrastructure Report site lists
  4. Schools                                NT Government School List
  5. Remote health clinics                  NT Government "Remote health services" page (transcribed in clinics.py)
  6. Satellite and alternatives             ACCC 2025 sites (satellite small cells), community Wi-Fi programs, ADII surveys

Run from the project folder:  python src/enrich.py     (or everything at once: python run_all.py)
Out:  data/RemoteConnect_enriched_v4.csv, data/schools_matched.csv, data/clinics_matched.csv
"""
import os, re, difflib
import numpy as np
import pandas as pd
import geopandas as gpd
from scipy.spatial import cKDTree
from clinics import ROWS as CLINIC_ROWS
import satellite_sources as SAT

HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(HERE)
# Data folder: set RC_DATA to override; by default the project's data/ folder, wherever this is run from.
DATA = os.environ.get("RC_DATA") or os.path.join(PROJECT, "data")
path = lambda f: os.path.join(DATA, f)
norm = lambda x: re.sub(r"[^A-Z]", "", str(x).upper())
ALBERS = 3577  # GDA94 / Australian Albers, metres


def xy(lon, lat):
    # Key step: project longitude/latitude to Australian Albers (metres) so every distance,
    # buffer and nearest-neighbour search below is measured in real kilometres, not degrees.
    g = gpd.GeoSeries(gpd.points_from_xy(lon, lat), crs=4326).to_crs(ALBERS)
    return np.c_[g.x, g.y]


# The 188 remote places, with their distances, operator counts and regional (SA2) indicators,
# as produced by the data preparation notebooks. Every later step adds columns to this table.
d = pd.read_csv(path("RemoteConnect_Final_Analysis_v.csv"))
L = xy(d.LONGITUDE, d.LATITUDE)
# Place names in upper case with punctuation removed, used for all name matching below.
ours = {norm(n): n for n in d["SITE NAME"]}

# ------------------------------------------------------------------ 1. network link
r = pd.read_excel(path("remote-communities-mobile-coverage.xlsx"), skiprows=1)
r.columns = ["loc", "lat", "lon", "backhaul", "provider"]
r = r.dropna(subset=["lat", "lon"])
r["k"] = r["loc"].map(norm)
by_name = r.drop_duplicates("k").set_index("k")["backhaul"]
# Match first by name ("optic fibre" or "microwave radio")...
d["Backhaul"] = d["SITE NAME"].map(norm).map(by_name)
# ...then, for places still unmatched, take the nearest listed community within 5 km.
# Anything further away stays blank: we never guess a link type.
miss = d.Backhaul.isna().values
dist, idx = cKDTree(xy(r.lon, r.lat)).query(L[miss])
fill = np.where(dist <= 5000, r.backhaul.values[idx], None)
d.loc[miss, "Backhaul"] = fill

# ------------------------------------------------------------------ 2. cyclones
tc = pd.read_csv(path("IDCKMSTM0S.csv"), skiprows=4, low_memory=False)
tc.columns = [c.strip() for c in tc.columns]
lat_c = [c for c in tc.columns if c.upper().startswith("LAT")][0]
lon_c = [c for c in tc.columns if c.upper().startswith("LON")][0]
id_c = [c for c in tc.columns if "DISTURBANCE" in c.upper()][0]
tm_c = [c for c in tc.columns if c.upper() in ("TM", "TIME", "DATETIME")][0]
tc[lat_c] = pd.to_numeric(tc[lat_c], errors="coerce"); tc[lon_c] = pd.to_numeric(tc[lon_c], errors="coerce")
tc = tc.dropna(subset=[lat_c, lon_c])
tc["yr"] = pd.to_datetime(tc[tm_c], errors="coerce").dt.year
# Keep 1995 onward (earlier records are patchier) and a box around northern Australia.
tc = tc[(tc.yr >= 1995) & tc[lon_c].between(120, 148) & tc[lat_c].between(-30, -5)]
T = gpd.GeoDataFrame(tc[[id_c]], geometry=gpd.points_from_xy(tc[lon_c], tc[lat_c]), crs=4326).to_crs(ALBERS)
buf = gpd.GeoDataFrame({"idx": d.index}, geometry=gpd.GeoSeries(gpd.points_from_xy(d.LONGITUDE, d.LATITUDE), crs=4326).to_crs(ALBERS).buffer(100_000))
hits = gpd.sjoin(T, buf, predicate="within")
# Key step: count DISTINCT storms passing within 100 km, not track points,
# so a slow-moving cyclone is counted once.
d["Cyclones_100km_30yr"] = d.index.map(hits.groupby("idx")[id_c].nunique()).fillna(0).astype(int)
# "One link, cyclone country": a microwave link AND cyclone exposure in the top 40% of places.
risk_cut = d.Cyclones_100km_30yr.quantile(0.6)
d["Resilience_Risk"] = np.where(d.Backhaul.eq("Microwave radio") & (d.Cyclones_100km_30yr >= risk_cut),
                                "Single microwave link in a cyclone-exposed area",
                       np.where(d.Backhaul.eq("Microwave radio"), "Microwave backhaul",
                       np.where(d.Backhaul.eq("Optic fibre"), "Optic fibre backhaul", "Backhaul not recorded")))

# ------------------------------------------------------------------ 3. Telstra 2018 vs 2025
def sites(f):
    s = pd.read_csv(path(f), low_memory=False)
    return s[s.Longitude.between(126, 141) & s.Latitude.between(-29, -9)].drop_duplicates(["Latitude", "Longitude"]).copy()
a18, a25 = sites("mobile-sites-telstra-2018.csv"), sites("mobile-sites-telstra-2025.csv")
A, B = xy(a18.Longitude, a18.Latitude), xy(a25.Longitude, a25.Latitude)
tA, tB = cKDTree(A), cKDTree(B)
# Key step: the 2018 file has no site IDs, so a 2025 site counts as NEW when no 2018 site
# lies within 1 km. This avoids counting a tower twice when its coordinates shift slightly.
a25["new"] = tA.query(B)[0] > 1000          # no 2018 site within 1 km
tN = cKDTree(B[a25.new.values])
for yr, t in (("2018", tA), ("2025", tB)):
    d[f"Telstra_nearest_{yr}_km"] = (t.query(L)[0] / 1000).round(1)
    d[f"Telstra_sites_50km_{yr}"] = [len(x) for x in t.query_ball_point(L, 50_000)]
    d[f"Telstra_sites_25km_{yr}"] = [len(x) for x in t.query_ball_point(L, 25_000)]
d["New_Telstra_sites_50km"] = [len(x) for x in tN.query_ball_point(L, 50_000)]
d["New_Telstra_sites_25km"] = [len(x) for x in tN.query_ball_point(L, 25_000)]
d["Nearest_change_km"] = (d.Telstra_nearest_2025_km - d.Telstra_nearest_2018_km).round(1)
# Need is measured with 2018 distance, before the new towers, so the 2018-2025 comparison
# is not circular (today's scores already include the new towers).
d["Need_2018"] = pd.qcut(d.Telstra_nearest_2018_km.rank(method="first"), 4,
                         labels=["Closest 25% in 2018", "2nd", "3rd", "Furthest 25% in 2018"])

# ------------------------------------------------------------------ 4. schools
s = pd.read_csv(path("School_List_Public_2026_09_27_12_50_20.csv"), encoding="latin-1")
s.columns = [c.replace("ï»¿", "").replace("\ufeff", "") for c in s.columns]
# Ethics: staff names and contact details are removed straight away. We only need school and place.
s = s.drop(columns=[c for c in ("Principal", "Email", "Telephone Number", "Fax Number", "Postal Address") if c in s.columns])
s["locality"] = s["Physical Address"].map(lambda a: [p.strip() for p in str(a).split(",")][-3] if len(str(a).split(",")) >= 3 else "")
S_ALIAS = {"KALKARINGI": "KALKARINDJI", "HARTSRANGE": "ATITJERE", "LTYENTYEAPURTE": "SANTA TERESA", "ALEKARENGE": "ALI CURUNG"}
# Known alternative names, and two false matches found when every match was checked by hand.
S_EXCLUDE = ("Kintore Street", "Baniyala")   # Katherine street name; homeland school with a Yirrkala postal address
SUFFIX = r"\b(AREA SCHOOL|PRE SCHOOL|PRIMARY SCHOOL|SCHOOL OF THE AIR|COMMUNITY EDUCATION CENTRE|CATHOLIC SCHOOL|CHRISTIAN SCHOOL|SCHOOL|COLLEGE|HOMELANDS|CEC|CAMPUS)\b"
def school_match(row):
    # Try, in order: known alternative name, exact name, then a strict spelling match (90% similar).
    if any(x.lower() in str(row.Name).lower() for x in S_EXCLUDE): return None, None
    base = re.sub(SUFFIX, "", str(row.Name).upper()).strip()
    loc = str(row.locality)
    campus = re.findall(r"-\s*(.+?)\s+CAMPUS", str(row.Name).upper())       # "College - Imanpa Campus"
    cands = [norm(c) for c in [base, loc, re.sub(r"\(.*?\)", "", loc)] + re.findall(r"\(([^)]+)\)", loc) + campus if c]
    cands = [c for c in cands if c and c != "NA"]
    for c in cands:
        if c in S_ALIAS: return S_ALIAS[c], "alias"
        if c in ours: return ours[c], "exact"
    for c in cands:
        if len(c) >= 6:
            b = difflib.get_close_matches(c, list(ours), n=1, cutoff=0.9)
            if b: return ours[b[0]], "spelling"
    return None, None
s[["place", "how"]] = s.apply(lambda r_: pd.Series(school_match(r_)), axis=1)
sm = s[s.place.notna()]
g = sm.groupby("place").agg(Schools=("Name", "count"), School_names=("Name", lambda x: "; ".join(sorted(x))),
                            Has_early_learning=("Is Pre School", lambda x: (x == "Yes").any()),
                            Has_senior=("Is Senior School", lambda x: (x == "Yes").any())).reset_index()
d = d.merge(g, left_on="SITE NAME", right_on="place", how="left").drop(columns=["place"])
d["Schools"] = d.Schools.fillna(0).astype(int)
d["Has_school"] = d.Schools > 0

# ------------------------------------------------------------------ 5. clinics
c = pd.DataFrame(CLINIC_ROWS, columns=["Region", "Clinic", "Hours", "Operator"])
c["Emergency_24_7"] = c.Hours.str.contains("24/7")
c["Visiting_only"] = c.Hours.str.contains("Visiting")
c["Community_controlled"] = ~c.Operator.eq("NT Health")
c["Limited_days"] = c.Hours.str.match(r"^(Tue|Tuesday|Wednesday|Mon, Wed, Fri|Mon-Wed)")
# Clinics are also matched by name. Homeland, outstation and urban services cover many places, so they are not matched.
C_ALIAS = {"KALKARINGI": "KALKARINDJI", "HARTSRANGE": "ATITJERE", "LTYENTYEAPURTE": "SANTA TERESA", "AHERRENGE": "AMPILATWATJA",
           "AMPILAWATJA": "AMPILATWATJA", "YURRWI": "MILINGIMBI", "GULIN": "BULMAN", "ELLIOT": "ELLIOTT", "NAUIYUNAMBIYU": "NAUIYU",
           "MTLIEBIG": "MOUNT LIEBIG", "PALUMPA": "NGANMARRIYANGA"}
def clinic_match(n):
    if any(x in n for x in ("Homelands", "Outstations", "Urban", "PHC")) or n.startswith("Lingara"): return None, None
    cands = [re.sub(r"\(.*?\)", "", n).strip()] + re.findall(r"\(([^)]+)\)", n)
    for x in cands:
        k = norm(x)
        if k in C_ALIAS and norm(C_ALIAS[k]) in ours: return ours[norm(C_ALIAS[k])], "alias"
        if k in ours: return ours[k], "exact"
    for x in cands:
        k = norm(x)
        b = difflib.get_close_matches(k, list(ours), n=1, cutoff=0.88)
        if b and len(k) >= 6: return ours[b[0]], "spelling"
    return None, None
c[["place", "how"]] = c.Clinic.apply(lambda n: pd.Series(clinic_match(n)))
cm = c[c.place.notna()]
g = cm.groupby("place").agg(Clinic_name=("Clinic", "first"), Clinic_operator=("Operator", "first"), Clinic_hours=("Hours", "first"),
                            Clinic_emergency_24_7=("Emergency_24_7", "any"), Clinic_visiting_only=("Visiting_only", "all"),
                            Clinic_limited_days=("Limited_days", "all"), Clinic_community_controlled=("Community_controlled", "any")).reset_index()
d = d.merge(g, left_on="SITE NAME", right_on="place", how="left").drop(columns=["place"])
d["Has_clinic"] = d.Clinic_name.notna()


# ------------------------------------------------------------------ 6. satellite and alternatives
# A place whose nearest Telstra site (within 10 km) is a "Small Cell Satellite" gets its mobile service over a satellite link.
# The ACCC programme field marks "Small Cell Satellite" sites: towers whose link to the network is by satellite.
prog = a25.Co_contribution_program.fillna("").values
dist_, idx_ = tB.query(L)
d["Tower_via_satellite"] = (pd.Series(prog[idx_]).str.contains("Small Cell Satellite").values) & (dist_ <= 10_000)
key = d["SITE NAME"].map(norm)
d["Community_WiFi"] = np.where(key.isin(SAT.WIFI_ACTIVE), "Active (NBN community Wi-Fi via satellite)",
                      np.where(key.isin(SAT.WIFI_FUNDED), "Funded, due by June 2027", None))
# Survey-based digital inclusion scores exist for only a few communities; others stay blank.
# No per-place Starlink estimate is made, because no public data supports one.
adii = {norm(k): v for k, v in SAT.ADII_2023.items()}
d["ADII_2023_score"] = key.map(lambda k: adii.get(k, (None, None))[0])
d["ADII_2023_access"] = key.map(lambda k: adii.get(k, (None, None))[1])

d.to_csv(path("RemoteConnect_enriched_v4.csv"), index=False)
s[s.place.notna()].to_csv(path("schools_matched.csv"), index=False)
c.to_csv(path("clinics_matched.csv"), index=False)
print(f"{len(d)} places · network link known {d.Backhaul.notna().sum()} · schools {int(d.Schools.sum())} at {d.Has_school.sum()} places · "
      f"clinics at {d.Has_clinic.sum()} places · new Telstra sites (region) {int(a25.new.sum())}")
