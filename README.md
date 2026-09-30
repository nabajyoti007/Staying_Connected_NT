# Staying connected in the Northern Territory (RemoteConnect NT)

## Run it in VS Code

1. **Install once:** Python 3.10+ (Windows: tick *Add python.exe to PATH*), VS Code, and the
   VS Code **Python** extension. VS Code will also suggest Live Server; that's optional.
2. **Open the folder:** File → Open Folder → this folder (the one containing `run_all.py`).
3. **Set up:** open a terminal (Terminal → New Terminal) and run
   - Windows: `setup_windows.bat`
   - Mac/Linux: `sh setup_mac_linux.sh`

   Then `Ctrl+Shift+P` → *Python: Select Interpreter* → choose the one with `.venv`.
4. **Build:** open the **Run and Debug** panel (`Ctrl+Shift+D`), pick
   **"1. Build everything (run_all.py)"** and press ▶. It takes about a minute and ends with
   *All results match.*
5. **See it:** pick **"2. Open the website"** and press ▶. The site opens in your browser.
6. **Optional check:** **"3. Compare with the published website"** confirms your build is
   byte-for-byte the same as the published one.

Terminal instead of buttons: `python run_all.py`, then `python open_website.py`.

The finished website is `prototype/remoteconnect_nt.html`. It is one file and works with no
internet. `reference/published_website.html` is the published copy, for comparison.

---

# RemoteConnect NT: source code

**Where is it hardest to stay connected in the Northern Territory?**
This package holds the Python code, input data and website source behind our entry to the
CDU IT Code Fair 2026 Data Innovation Challenge (Remote Connectivity). One command rebuilds
every number, chart and the offline website from the raw data.

---

## Quick start

```bash
pip install -r requirements.txt
python run_all.py
```

That's all. It takes about a minute and ends with a check that the results match the ones we
submitted:

```
  ok   places analysed: 188 (submitted 188)
  ok   places with 4 of 5 problems: 6 (submitted 6)
  ...
All results match.
```

Then open `prototype/remoteconnect_nt.html` in any browser. It needs no internet connection.

---

## What's in the package

```
RemoteConnect_NT_source/
├── run_all.py                 runs every step in order, then checks the results
├── open_website.py            opens the built website in your browser
├── compare_with_published.py  checks your build against the published website
├── setup_windows.bat          one-time setup (Windows)
├── setup_mac_linux.sh         one-time setup (Mac/Linux)
├── .vscode/                   Run and Debug buttons for every step
├── reference/                 the published website, for comparison
├── requirements.txt           Python packages needed
├── src/
│   ├── enrich.py              step 1: joins the extra datasets to the 188 places
│   ├── clinics.py             remote health clinic list (transcribed from an NT Government web page)
│   ├── satellite_sources.py   cited tables: community Wi-Fi programs, surveyed inclusion scores
│   ├── cluster.py             step 2: machine learning, groups places into five kinds
│   ├── score.py               step 3: recalculates the checklist and the gap scores
│   └── analysis_figures.py    step 4: presentation charts and every quoted number
├── prototype/
│   ├── build_prototype.py     step 5: builds the offline website
│   ├── template.html          page structure and styles
│   ├── app.js                 everything the website does (map, pages, tour, reports)
│   └── assets/                map shapes (NT outline, regions, states) and labels
├── data/                      raw inputs (outputs from step 1 and 2 are written here too)
└── outputs/                   created by the run: figures, findings.txt, score_check.csv
```

---

## Requirements

- **Python 3.10 or later** (tested with 3.12)
- The packages in `requirements.txt`: pandas, numpy, geopandas, shapely, pyogrio, scipy,
  scikit-learn, matplotlib, openpyxl

If `pip install geopandas` fails on Windows, install it with conda instead:
`conda install -c conda-forge geopandas`, then `pip install -r requirements.txt`.

No internet is needed to run the code. All input data is in `data/`.

---

## Running the steps one at a time

`run_all.py` does this for you. To run steps by hand, stay in the project folder and run them
in this order. Each script finds the `data/` and `outputs/` folders by itself.

| Step | Command | Produces |
|---|---|---|
| 1. Enrich | `python src/enrich.py` | `data/RemoteConnect_enriched_v4.csv`, `data/schools_matched.csv`, `data/clinics_matched.csv` |
| 2. Kinds of place | `python src/cluster.py` | adds `Group` and `Group_fix` to the enriched table |
| 3. Scores | `python src/score.py` | `outputs/score_check.csv` and a printed check |
| 4. Figures | `python src/analysis_figures.py` | 14 charts and `findings.txt` in `outputs/figures/` |
| 5. Website | `python prototype/build_prototype.py` | `prototype/remoteconnect_nt.html` |

Each step reads what the previous one wrote, so keep the order.

---

## What each step does

### Step 1: `enrich.py`, joining the datasets

Starts from `RemoteConnect_Final_Analysis_v.csv` (the 188 places, see *The base table* below)
and adds six things. The key steps are marked with comments in the code.

1. **Network link.** Whether each place connects by optic fibre or microwave radio. Matched by
   name, then by the nearest listed community within 5 km. 81 of 188 places matched; the rest
   stay blank rather than guessed.
2. **Cyclones.** Distinct storms passing within 100 km since 1995. Storms, not track points, so a
   slow cyclone counts once.
3. **Towers, 2018 against 2025.** A 2025 Telstra site is *new* if no 2018 site lies within 1 km.
   Need is measured with 2018 distance, so the comparison isn't circular.
4. **Schools.** Matched to places by name and known alternative names; every match was checked
   by hand. Staff names and contact details are removed on load.
5. **Health clinics.** The same way, from the transcribed list in `clinics.py`.
6. **Satellite.** Which places are served by a tower whose link is by satellite, plus community
   Wi-Fi programs and surveyed inclusion scores where they exist.

All distances are calculated in GDA94 / Australian Albers (EPSG:3577), so they are true
kilometres.

### Step 2: `cluster.py`, machine learning

k-means clustering groups the places by seven measures (distance to a tower, phone companies
nearby, towers within 25 km, 4G on land and homes, satellite-only homes, cyclones) with no labels
and no weights. Five groups were chosen because they were the most stable: the same groups came
back 84% of the time when the data was resampled (silhouette 0.33). The groups are named from
their profiles by fixed rules.

As an independent check, all six places with four problems fall in the same group, although the
algorithm never saw the five problems.

### Step 3: `score.py`, the two ways places are assessed

- **Five-problem checklist**, the main method in the website. Each problem is true or false:
  tower more than 10 km away; one phone company or none within 50 km; 4G on under 10% of the
  surrounding land; a single microwave link; 10 or more cyclones within 100 km since 1995.
- **Gap score, 0 to 100.** Each raw input becomes a percentile against the 188 places. They
  form four parts (towers nearby, 4G in the region, 5G in the region, home internet in the
  region), which combine 35 / 25 / 20 / 20 into one score.

The script recalculates the gap scores from raw inputs and compares them with the stored ones.
Every difference is under one point, from rounding in the original notebooks.

### Step 4: `analysis_figures.py`, charts and numbers

Makes the 14 presentation charts and writes `findings.txt`, which lists every number quoted in
the report, the slides and the website. It also runs the statistical tests (Spearman
correlations, Kruskal-Wallis) and the sensitivity check on the gap score weights.

### Step 5: `build_prototype.py`, the offline website

Puts the enriched data, map shapes, fonts and code into a single HTML file. Nothing is loaded
from the internet, so the file works offline once saved.

---

## The base table

`data/RemoteConnect_Final_Analysis_v.csv` was produced by our data preparation notebooks, which
joined the NT Government community list to the ACCC 2025 tower lists (Telstra, Optus, TPG),
calculated distances and operator counts, attached ABS SA2 regions and their coverage and
broadband indicators, and computed the gap scores. **Those notebooks should be included
alongside this package in a `notebooks/` folder.** `score.py` shows how the gap scores are
built and confirms the stored values.

---

## Data sources

| Data | Source |
|---|---|
| Phone towers 2018 and 2025; Telstra letter on its coverage method (1 March 2024) | ACCC, Mobile Infrastructure Report data release: https://data.gov.au/data/dataset/accc-mobile-infrastructure-report-data-release |
| Remote places, cell type, network link | NT Government, List of Remote Communities with Mobile Coverage: https://data.nt.gov.au/dataset/list-of-remote-communities-with-mobile-coverage |
| Radio licences, satellite ground stations | ACMA, Register of Radiocommunications Licences: https://www.acma.gov.au/radiocomms-licence-data |
| Cyclone tracks | Bureau of Meteorology: https://www.bom.gov.au/cyclone/tropical-cyclone-knowledge-centre/databases/ |
| Schools | NT Government School List: https://data.nt.gov.au/dataset/school-list |
| Remote health clinics | NT Government, Remote health services (page dated 31 August 2026): https://nt.gov.au/wellbeing/remote-health/remote-health-services |
| Digital inclusion surveys | Australian Digital Inclusion Index, Mapping the Digital Gap: https://digitalinclusionindex.org.au/case-study-mapping-the-digital-gap-digital-inclusion-in-remote-first-nations-communities/ |
| Community Wi-Fi programs | Department of Infrastructure: https://www.infrastructure.gov.au/media-communications/first-nations-digital-inclusion |
| Regions (SA1, SA2) | ABS, ASGS Edition 3: https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3 |

---

## Limitations

- Nothing here measures the signal people actually get. Distance to a tower is context, not
  signal strength.
- Coverage and home internet figures describe whole regions (SA2). The 188 places sit in 16
  regions, so several places share those figures.
- The network link list dates from 2019. Some radio links may have been upgraded since.
- The 2018 tower list may leave out some small cells, so one place's change is indicative only.
- No public data counts Starlink users by place, so none is estimated.

## Ethics

Only public, place-level data is used, with no personal or household information. Staff names
and contact details in the school list are removed as the file loads. Places are described by
the problems they face, never as "bad" places. We follow the CARE principles for Indigenous data
(collective benefit, authority to control, responsibility, ethics): field notes recorded in the
website stay on the device that collected them until a person chooses to export them.

We acknowledge the Traditional Owners of the lands and seas of the Northern Territory, and pay
our respects to Elders past and present.

## Attribution

Based on Australian Communications and Media Authority information. Contains ACCC, NT Government
and Bureau of Meteorology data used under their licence terms, and ABS boundaries under CC BY 4.0.
Typefaces in the website (Bricolage Grotesque, IBM Plex Sans, IBM Plex Mono) are used under the
SIL Open Font Licence.
