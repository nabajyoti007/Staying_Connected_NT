# Staying connected in the Northern Territory

**Where is it hardest to stay connected in the Northern Territory, and why?**

We joined ten public datasets for 188 remote places across the Northern Territory, checked every
place for five plain connection problems, and built an interactive website that shows where the
gaps are, why they matter to people, and what should happen next.

**Live website:** [staying-connected-nt.netlify.app](https://staying-connected-nt.netlify.app/)

Built for the **CDU IT Code Fair 2026, Data Innovation Challenge: Remote Connectivity.**

![Overview page of the website](docs/screenshots/01_overview.png)

---

## What we found

- **Six places have four of the five problems.** Wilgi, Mandedjkadjang, Armorran, Alamirra,
  Minjilang and Warruwi, all on islands and the remote coast of the Top End.
- **Signal reaches homes, not the roads.** 4G covers 58% of homes in these regions but only 14%
  of the land people drive through.
- **New towers mostly went to the right places.** Since 2018, 89 new Telstra towers were built in
  the NT. The furthest places went from about 69 km to about 1 km from a tower, but six places are
  still waiting.
- **Schools and clinics are exposed.** In 15 places, both the school and the health clinic face
  three or more problems.
- **Machine learning agrees.** A k-means model grouped the places into five kinds without ever
  seeing our checklist, and still put all six worst-affected places in the same group.

## The five problems

Every place gets the same five yes-or-no checks. Nothing is weighted: we count the yeses.

| # | Problem | Rule | Places |
|---|---|---|---|
| 1 | Tower far away | Nearest mobile tower more than 10 km away | 38 |
| 2 | One phone company | One operator or none within 50 km | 84 |
| 3 | Little signal on the land | 4G covers under 10% of the surrounding land | 84 |
| 4 | Single radio link | The network reaches the place through one microwave link | 23 |
| 5 | Cyclones pass often | 10 or more cyclones within 100 km since 1995 | 94 |

---

## The website

| | |
|---|---|
| ![Why it matters page](docs/screenshots/02_why_it_matters.png) | ![Map with Wilgi selected](docs/screenshots/03_map.png) |
| **Why it matters.** Each problem, what it means for people, and a real NT example. | **Map.** Click any place to see which problems apply, in plain words. |
| ![Key findings page](docs/screenshots/04_key_findings.png) | ![What to do page](docs/screenshots/05_what_to_do.png) |
| **Key findings.** Eight findings, each linked to the places on the map. | **What to do.** Nine actions for governments, phone companies and communities. |

![All places table](docs/screenshots/06_all_places.png)

**All places.** Every place with its problems, sortable, each opening a printable report.

---

## Run it yourself

### In VS Code (recommended)

1. **Install once:** Python 3.10 or later (on Windows, tick *Add python.exe to PATH*), VS Code,
   and the VS Code **Python** extension.
2. **Open the folder:** *File → Open Folder*, then choose this folder (the one containing
   `run_all.py`).
3. **Set up:** open a terminal (*Terminal → New Terminal*) and run
   - Windows: `setup_windows.bat`
   - Mac/Linux: `sh setup_mac_linux.sh`

   Then press `Ctrl+Shift+P`, choose *Python: Select Interpreter*, and pick the one with `.venv`.
4. **Build:** open **Run and Debug** (`Ctrl+Shift+D`), choose
   **"1. Build everything (run_all.py)"** and press ▶. It takes about a minute and ends with
   *All results match.*
5. **See it:** choose **"2. Open the website"** and press ▶.

### From a terminal

```bash
pip install -r requirements.txt
python run_all.py
python open_website.py
```

`run_all.py` ends by checking eight headline results against the ones we submitted:

```
  ok   places analysed: 188 (submitted 188)
  ok   places with 4 of 5 problems: 6 (submitted 6)
  ...
All results match.
```

If `pip install geopandas` fails on Windows, install it with conda instead:
`conda install -c conda-forge geopandas`, then `pip install -r requirements.txt`.

---

## How it works

| Step | Script | What it does |
|---|---|---|
| 1 | `src/enrich.py` | Joins network links, cyclones, towers from 2018 and 2025, schools, clinics and satellite data to the 188 places |
| 2 | `src/cluster.py` | Machine learning: groups the places into five kinds with k-means |
| 3 | `src/score.py` | Recalculates the five-problem checklist and the gap score, and checks them |
| 4 | `src/analysis_figures.py` | Makes the 14 charts, runs the statistical tests, and writes every quoted number to `findings.txt` |
| 5 | `prototype/build_prototype.py` | Builds the website into a single HTML file |

Each step reads what the previous one wrote, so run them in this order, or just run
`run_all.py`.

**A few method details**

- **Distances** are straight-line distances in GDA94 / Australian Albers (EPSG:3577), so they're
  true kilometres.
- **New towers:** a 2025 Telstra site counts as new if no 2018 site lies within 1 km.
- **Cyclones** are counted as distinct storms passing within 100 km, not track points.
- **Schools and clinics** were matched to places by name and known alternative names, and every
  match was checked by hand.
- **Gap score:** a finer 0 to 100 ranking, weighted 35/25/20/20 across towers, 4G, 5G and home
  internet. Re-ranking under four other weightings gave Spearman correlations of 0.92 to 0.98, so
  the results don't depend on the weights.
- **Machine learning:** k-means on seven standardised measures, with no labels. Five groups was
  the most stable choice (silhouette 0.33, stability 0.84 over 20 resampled runs).

---

## Project structure

```
├── run_all.py                 runs every step in order, then checks the results
├── open_website.py            opens the built website in your browser
├── compare_with_published.py  compares your build with the published copy
├── setup_windows.bat          one-time setup (Windows)
├── setup_mac_linux.sh         one-time setup (Mac/Linux)
├── requirements.txt           Python packages
├── .vscode/                   Run and Debug buttons for every step
├── src/                       analysis code (steps 1 to 4)
├── prototype/                 website code and build script (step 5)
├── data/                      input data; steps 1 and 2 also write here
├── outputs/                   charts, findings.txt and score checks, created by the run
├── reference/                 the published website, for comparison
└── docs/screenshots/          images used in this README
```

The base table, `data/RemoteConnect_Final_Analysis_v.csv`, was produced by our data preparation
notebooks, which joined the NT Government community list to the ACCC tower lists and attached
ABS regions and their coverage indicators. `src/score.py` shows how the gap scores are built and
confirms the stored values.

## Built with

- **Python 3.12:** pandas, NumPy, GeoPandas, Shapely, pyogrio, SciPy, scikit-learn, Matplotlib,
  openpyxl
- **Website:** HTML, CSS and plain JavaScript, with a WebGL map, hosted on Netlify
- **Fonts:** Bricolage Grotesque, IBM Plex Sans and IBM Plex Mono, under the SIL Open Font
  Licence

---

## Data sources

| Data | Source |
|---|---|
| Phone towers, 2018 and 2025 | [ACCC, Mobile Infrastructure Report data release](https://data.gov.au/data/dataset/accc-mobile-infrastructure-report-data-release) |
| Remote places and network links | [NT Government, List of Remote Communities with Mobile Coverage](https://data.nt.gov.au/dataset/list-of-remote-communities-with-mobile-coverage) |
| Radio licences | [ACMA, Register of Radiocommunications Licences](https://www.acma.gov.au/radiocomms-licence-data) |
| Cyclone tracks | [Bureau of Meteorology, tropical cyclone databases](https://www.bom.gov.au/cyclone/tropical-cyclone-knowledge-centre/databases/) |
| Schools | [NT Government School List](https://data.nt.gov.au/dataset/school-list) |
| Remote health clinics | [NT Government, Remote health services](https://nt.gov.au/wellbeing/remote-health/remote-health-services) |
| Digital inclusion research | [Australian Digital Inclusion Index, Mapping the Digital Gap](https://digitalinclusionindex.org.au/case-study-mapping-the-digital-gap-digital-inclusion-in-remote-first-nations-communities/) |
| Community Wi-Fi programs | [Department of Infrastructure, First Nations digital inclusion](https://www.infrastructure.gov.au/media-communications/first-nations-digital-inclusion) |
| Regions (SA1, SA2) | [ABS, ASGS Edition 3](https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3) |

## Limitations

- Nothing here measures the signal people actually get. Distance to a tower is context, not
  signal strength.
- Coverage and home internet figures describe whole regions (SA2), so several places share them.
- The network link list dates from 2019, so some radio links may have been upgraded since.
- The 2018 tower list may leave out some small cells, so a single place's change is indicative
  only.
- No public data counts Starlink users by place, so none is estimated.

## Ethics

We used only public, place-level data, with no personal or household information. Staff names
and contact details in the school list are removed as the file loads. Places are described by the
problems they face, never as "bad" places. We follow the
[CARE principles for Indigenous data governance](https://doi.org/10.5334/dsj-2020-043): field
notes recorded on the website stay on the visitor's own device until they choose to export them.

## Team

| Member | Role |
|---|---|
| Md Ahanaf Mubashshir Alvi | Data analysis and Prototype |
| Nabajyoti Sharma | Data Source and presentation |
| Anupoma Angasree | Research and reporting |
| Shougata Das | Data Sourcing, Machine learning |

We used Claude (Anthropic) as an AI assistant during this project, as set out in the AI usage
declaration in our report.

## Acknowledgement of Country

We acknowledge the Traditional Owners of the lands and seas of the Northern Territory, and pay our
respects to Elders past and present. Most of the places in this work are Aboriginal communities.

## Attribution

Based on Australian Communications and Media Authority information. Contains ACCC, NT Government
and Bureau of Meteorology data used under their licence terms, and ABS boundaries under
CC BY 4.0.
