/* RemoteConnect NT: an interactive map with icons, charts and place reports.
   No external libraries, so the single HTML file keeps working offline. */
"use strict";

/* ========================= helpers ========================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const nice = s => String(s || "").toLowerCase().replace(/(^|[\s\-(/])([a-z])/g, (m, a, b) => a + b.toUpperCase());
const kmText = v => v == null ? "unknown" : v < 1 ? "under 1 km" : Math.round(v) + " km";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const calm = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
function median(a) {
  const v = a.filter(x => x != null).sort((x, y) => x - y), n = v.length;
  return n ? (n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2) : 0;
}
function ranks(a) {
  const idx = a.map((v, i) => i).sort((x, y) => a[x] - a[y]), r = new Array(a.length);
  for (let i = 0; i < idx.length;) {
    let j = i; while (j + 1 < idx.length && a[idx[j + 1]] === a[idx[i]]) j++;
    for (let k = i; k <= j; k++) r[idx[k]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
}
function spearman(a, b) {
  const ra = ranks(a), rb = ranks(b), n = a.length, ma = (n + 1) / 2;
  let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < n; i++) { const x = ra[i] - ma, y = rb[i] - ma; sab += x * y; sa += x * x; sb += y * y; }
  return sab / Math.sqrt(sa * sb);
}

/* ========================= icons ========================= */
const svgI = d => `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  tower: svgI('<path d="M12 9v12M8.5 21l3.5-12 3.5 12M9.6 17h4.8"/><circle cx="12" cy="7" r="1.6"/><path d="M8.2 3.8a5.3 5.3 0 0 0 0 6.4M15.8 3.8a5.3 5.3 0 0 1 0 6.4"/>'),
  company: svgI('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/><path d="M10.5 8.5l1.5-1.5v6"/>'),
  land: svgI('<path d="M9 21l2-9M15 21l-2-9M12 14.5v1.2M12 18.5v1.5"/><path d="M8 7.5a5.6 5.6 0 0 1 8 0M10 9.8a2.8 2.8 0 0 1 4 0"/><path d="M3 21h18"/>'),
  link: svgI('<path d="M4 20V11M20 20V11"/><path d="M2.5 11.5a3 3 0 0 1 3-3M21.5 11.5a3 3 0 0 0-3-3"/><path d="M6.5 9.5l2.5-2 2.5 2 2.5-2 2.5 2 1.5-1"/>'),
  cyclone: svgI('<path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0"/><path d="M14 12c0-4-2-7-7-7M10 12c0 4 2 7 7 7"/><path d="M12 10c4 0 7-1.5 8-4M12 14c-4 0-7 1.5-8 4"/>'),
  school: svgI('<path d="M3 10l9-5 9 5-9 5z"/><path d="M7 12.5v4c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4"/>'),
  clinic: svgI('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/>'),
  home: svgI('<path d="M4 11l8-6 8 6v9H4z"/><path d="M10 20v-5h4v5"/>'),
  growth: svgI('<path d="M4 20h16"/><path d="M6 16l4-4 3 3 5-6"/><path d="M14 9h4v4"/>'),
  map: svgI('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>'),
  ask: svgI('<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.3 2-2.3 3.5"/><path d="M12 17h.01"/>'),
  sat: svgI('<path d="M13 7l4 4-6 6-4-4z"/><path d="M11 5l-2-2-3 3 2 2M19 13l2 2-3 3-2-2"/><path d="M5 19a4 4 0 0 1 0-5"/><path d="M8 21a7 7 0 0 1-5-5"/>'),
  scale: svgI('<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z"/>'),
  layers: svgI('<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>'),
  sliders: svgI('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>'
};
const smallIcon = (k, s) => ICON[k].replace('class="ico"', `class="ico" style="width:${s || 15}px;height:${s || 15}px;color:inherit"`);

/* ========================= the five problems ========================= */
const PROBLEMS = [
  { id: "tower", short: "Tower far away", text: "The nearest phone tower is more than 10 km away",
    test: p => p.Nearest_Site_km > 10, detail: p => `Nearest tower: ${kmText(p.Nearest_Site_km)}` },
  { id: "company", short: "One phone company", text: "Only one phone company has a tower nearby",
    test: p => p.Operators_within_50km <= 1,
    detail: p => p.Operators_within_50km <= 1 ? `Only ${nice(p.Operator_Names_50km || "one company")} within 50 km. If that network goes down, there is no other.`
      : `${p.Operators_within_50km} companies within 50 km: ${nice(p.Operator_Names_50km || "")}` },
  { id: "land", short: "Little signal on the land", text: "Mobile signal covers less than a tenth of the land around here",
    test: p => p.SA2_4G_area_indicator < 10, detail: p => `4G covers ${p.SA2_4G_area_indicator}% of the land in this region, but ${p.SA2_4G_premises_indicator}% of homes` },
  { id: "link", short: "Single radio link", text: "The phone network reaches this place through a single radio link",
    test: p => p.Backhaul === "Microwave radio",
    detail: p => p.Backhaul === "Microwave radio" ? "Connected by microwave radio, which storms can knock out"
      : p.Backhaul === "Optic fibre" ? "Connected by optic fibre cable" : "We don't know how this place is connected" },
  { id: "cyclone", short: "Cyclones pass often", text: "Cyclones pass nearby often",
    test: p => p.Cyclones_100km_30yr >= 10, detail: p => `${p.Cyclones_100km_30yr} cyclones passed within 100 km since 1995` }
];
/* everyday-words explanation of each problem, shown next to its icon */
const PLAIN = {
  tower: "The closest mobile phone tower is over 10 km away, so phone signal is weak or missing.",
  company: "Only one phone company (such as Telstra) works here. If its network breaks, there is no backup.",
  land: "Signal may work in town, but on the roads and land around it there is almost none.",
  link: "The whole town's phone and internet travel through one radio beam. If it breaks, everything stops.",
  cyclone: "10 or more cyclones have passed within 100 km since 1995. Storms can damage towers and links."
};
/* short explanations of words used across the site (the ⓘ bubbles) */
const WORDS = {
  tower: ["Phone tower", "A tall mast that sends out mobile phone signal. The further away it is, the weaker the signal."],
  company: ["Phone company", "A business that runs mobile towers, such as Telstra, Optus or TPG."],
  land: ["4G signal", "Modern mobile phone signal for calls and internet. 5G is the newer, faster version."],
  link: ["Radio link", "A beam of radio waves between two masts that carries a town's phone and internet traffic. Fibre cable is the sturdier alternative."],
  cyclone: ["Cyclone", "A very strong tropical storm with destructive winds, common in the north of the Territory in the wet season."],
  gap: ["Gap score", "One number from 0 to 100 showing how far behind a place is. 0 = among the best connected here, 100 = the biggest gap."],
  kind: ["Kind of place", "A computer grouped places that have similar connection problems, so each group can get the same kind of fix."],
  region: ["Region", "An official area used by the Australian Bureau of Statistics. Coverage figures are measured for each region."],
  sat: ["Satellite internet", "Internet sent from space to a dish. It works almost anywhere, but only where there is a dish, not on your phone on the road."]
};
const info = k => `<span class="info" tabindex="0" ${tipA(`<b>${WORDS[k][0]}</b><br>${WORDS[k][1]}`)} aria-label="What is ${WORDS[k][0]}?">i</span>`;
/* traffic-light colours: green = well connected, red = many problems */
const PCOL = ["#2E9E5B", "#A3C940", "#F2B632", "#EB7A2E", "#D23B2E"];
const NLABEL = ["No problems", "1 problem", "2 problems", "3 problems", "4 or more problems"];
const NWORD = ["Well connected", "Mostly fine", "Some trouble", "Hard to connect", "Very hard to connect"];
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const PRGB = PCOL.map(hexRgb);
const colourFor = n => PCOL[clamp(n, 0, 4)];
const inkOn = n => n === 0 || n === 4 ? "#fff" : "#16191B";
const rgbCss = (c, a) => a == null ? `rgb(${c.map(Math.round).join(",")})` : `rgba(${c.map(Math.round).join(",")},${a})`;
function rampRgb(v) {
  const i = Math.min(Math.floor(clamp(v, 0, 4)), 3), t = clamp(v - i, 0, 1);
  return PRGB[i].map((x, k) => x + (PRGB[i + 1][k] - x) * t);
}
const rampColour = v => rgbCss(rampRgb(v));

const TYPE = { COMMUNITY: "Community", VILLAGE: "Small settlement", HIGHWAY: "Roadhouse or highway stop", TOURISM: "Tourist spot" };
const TYPES_PL = { COMMUNITY: "Communities", VILLAGE: "Small settlements", HIGHWAY: "Roadhouses", TOURISM: "Tourist spots" };
const SURE = {
  "High Agreement": { key: "High", label: "Sure", col: "#1E8A5A", bg: "#E3F1EC", why: "Our different data sources all point the same way here." },
  "Mixed Agreement": { key: "Mixed", label: "Mostly sure", col: "#B07A12", bg: "#FBF1DA", why: "Our data sources mostly agree, but not completely." },
  "Low Agreement": { key: "Low", label: "Not sure, check locally", col: "#86361C", bg: "#FBEAE7", why: "Our data sources point different ways here. Someone should ask the people who live there." }
};
const PARTS = [
  { key: "Infrastructure_Gap", name: "Towers nearby", short: "Towers", w: 0.35, col: "#2A6F97",
    what: "how far the nearest tower is, and how few towers and phone companies are close by. Measured at the place itself." },
  { key: "Mobile_Gap", name: "4G in the region", short: "4G", w: 0.25, col: "#1E8A5A", what: "how little of the region's homes and land has 4G." },
  { key: "FiveG_Gap", name: "5G in the region", short: "5G", w: 0.20, col: "#6B5CA5", what: "how little 5G the region has." },
  { key: "Broadband_Gap", name: "Home internet in the region", short: "Home internet", w: 0.20, col: "#C2577E",
    what: "how much the region relies on satellite for home internet instead of cable or fixed wireless." }
];
const OVERALL = { key: "Overall_Connectivity_Gap", name: "Overall", short: "Overall" };
const GROUPS = [["Top End communities", "#B3521F"], ["Coastal and Gulf towns", "#2A6F97"], ["Desert communities", "#C9A227"],
  ["Outstations near towns", "#6B5CA5"], ["Near towns and Kakadu", "#1E8A5A"]];
const groupColour = g => (GROUPS.find(x => x[0] === g) || [, "#999999"])[1];

PLACES.forEach((p, i) => {
  p._i = i;
  p._name = nice(p["SITE NAME"]);
  p._type = TYPE[p["SITE TYPE"]] || "Place";
  p._probs = PROBLEMS.map(pr => pr.test(p));
  p._n = p._probs.filter(Boolean).length;
  p._sure = SURE[p.Evidence_Agreement] || SURE["Mixed Agreement"];
  p._score = p.Overall_Connectivity_Gap;
  p._unknown = [];
  if (p.POPULATION == null) p._unknown.push("how many people live here");
  if (!p.Backhaul) p._unknown.push("how the phone network reaches this place");
});
PLACES.forEach(p => { p._pct = Math.round(PLACES.filter(x => x._score < p._score).length / PLACES.length * 100); });
const MAXN = Math.max(...PLACES.map(p => p._n));
const byNeed = (a, b) => b._n - a._n || (b.Nearest_Site_km || 0) - (a.Nearest_Site_km || 0);
const byPop = (a, b) => (b.POPULATION || 0) - (a.POPULATION || 0);
const ORDER = PLACES.slice().sort(byNeed);
ORDER.forEach((p, k) => p._rank = k + 1);
const idsOf = list => list.map(p => p._i);

/* regions (ABS SA2) */
const REG = {};
PLACES.forEach(p => {
  const r = REG[p.SA2_Name] || (REG[p.SA2_Name] = { name: p.SA2_Name, places: [], homes: p.SA2_4G_premises_indicator,
    land: p.SA2_4G_area_indicator, sat: p.SA2_NBN_satellite_premises_indicator, area: p.SA2_total_area });
  r.places.push(p);
});
Object.values(REG).forEach(r => {
  r.n = r.places.length; r.avg = sum(r.places, p => p._n) / r.n;
  r.places.sort(byNeed);
  [OVERALL, ...PARTS].forEach(pt => r[pt.key] = sum(r.places, p => p[pt.key]) / r.n);
});

/* named sets used across the map, charts and actions */
const waitTest = p => p.Need_2018 === "Furthest 25% in 2018" && !(p.New_Telstra_sites_25km > 0) && p.Nearest_change_km >= -1;
const S = {
  worst: ORDER.filter(p => p._n === MAXN),
  both: PLACES.filter(p => p.Schools > 0 && p.Clinic_name && p._n >= 3).sort(byPop),
  oneLink: PLACES.filter(p => p._probs[3] && p._probs[4]).sort((a, b) => b.Cyclones_100km_30yr - a.Cyclones_100km_30yr),
  waiting: PLACES.filter(waitTest).sort(byNeed),
  lowLand: PLACES.filter(p => p._probs[2]),
  unsure: PLACES.filter(p => p.Evidence_Agreement === "Low Agreement").sort(byNeed),
  second: PLACES.filter(p => p.Nearest_Site_km <= 10 && p.Operators_within_50km <= 1),
  far: PLACES.filter(p => p.Nearest_Site_km > 10),
  clinics: PLACES.filter(p => p.Clinic_name),
  schools: PLACES.filter(p => p.Schools > 0),
  sc: PLACES.filter(p => p.Schools || p.Clinic_name),
  viaSat: PLACES.filter(p => p.Tower_via_satellite),
  satHomes: PLACES.filter(p => p.SA2_NBN_satellite_premises_indicator >= 90),
  wifi: PLACES.filter(p => p.Community_WiFi)
};
S.cc = S.clinics.filter(p => p.Clinic_community_controlled);
const SPOTS = {
  worst: [S.worst, `The ${S.worst.length} places with ${MAXN} of 5 problems, all in the Top End`],
  both: [S.both, `${S.both.length} places where a school and a clinic face 3 or more problems`],
  oneLink: [S.oneLink, `${S.oneLink.length} communities on a single radio link in cyclone country`],
  waiting: [S.waiting, `${S.waiting.length} places still waiting for a nearby tower since 2018`],
  lowLand: [S.lowLand, "Places where 4G covers less than a tenth of the land"],
  unsure: [S.unsure, "Places where the data sources disagree"],
  second: [S.second, "Places near a tower but with only one phone company"],
  far: [S.far, "Places more than 10 km from the nearest tower"],
  sc: [S.sc, "Places with a school or a health clinic"],
  cc: [S.cc, "Places with a community controlled health clinic"],
  viaSat: [S.viaSat, "Places served by a tower linked by satellite"],
  satHomes: [S.satHomes, "Places in regions where 90% or more of homes can only get satellite internet"],
  wifi: [S.wifi, "Places with free community Wi-Fi, active or funded"]
};
PROBLEMS.forEach((pr, k) => SPOTS["prob" + k] = [PLACES.filter(p => p._probs[k]), `Places where ${pr.text.charAt(0).toLowerCase() + pr.text.slice(1)}`]);
for (let n = 0; n <= 4; n++) SPOTS["n" + n] = [PLACES.filter(p => p._n === n), `Places with ${n} of the 5 problems`];
Object.entries(SURE).forEach(([k, s]) => SPOTS["sure" + s.key] = [PLACES.filter(p => p.Evidence_Agreement === k), `Places where we are: ${s.label.toLowerCase()}`]);

/* ========================= tooltips and small builders ========================= */
const tt = $("#tt");
function tip(html, x, y) {
  tt.innerHTML = html; tt.style.opacity = 1;
  const w = tt.offsetWidth, h = tt.offsetHeight;
  let L = x + 14, T = y + 16;
  if (L + w > innerWidth - 8) L = x - w - 14;
  if (T + h > innerHeight - 8) T = y - h - 12;
  tt.style.left = L + "px"; tt.style.top = T + "px";
}
function untip() { tt.style.opacity = 0; }
const tipA = html => html ? `data-tip="${esc(html)}"` : "";
const strip = p => `<span class="pstrip" aria-label="${p._n} of 5 problems">${PROBLEMS.map((pr, k) => `<i class="${p._probs[k] ? "y" : ""}">${smallIcon(pr.id, 13)}</i>`).join("")}</span>`;
const dot = n => `<span class="ndot" style="background:${colourFor(n)};color:${inkOn(n)}">${n}</span>`;
const placeTip = p => `<b style="font-size:14px">${esc(p._name)}</b><br><span class="tline">${dot(p._n)} ${NWORD[p._n]}: ${p._n} of 5 problems</span>
  ${p._n ? `<span class="tprobs">${PROBLEMS.filter((pr, k) => p._probs[k]).map(pr => `<span>${smallIcon(pr.id, 14)}${pr.short}</span>`).join("")}</span>` : ""}
  <span style="opacity:.7">${p._type}${p.POPULATION != null ? ` · about ${p.POPULATION} people` : ""}</span><br><span style="opacity:.55;font-size:12px">Click for details</span>`;
document.addEventListener("pointermove", e => {
  if (e.target === cv) return;
  const el = e.target.closest && e.target.closest("[data-tip]");
  if (el && el.dataset.tip) tip(el.dataset.tip, e.clientX, e.clientY); else untip();
}, { passive: true });
/* the ⓘ bubbles also open on tap and keyboard focus, for touch screens and keyboards */
const infoAt = el => { const r = el.getBoundingClientRect(); tip(el.dataset.tip, r.right, r.top); };
document.addEventListener("focusin", e => { if (e.target.classList && e.target.classList.contains("info")) infoAt(e.target); });
document.addEventListener("click", e => { const el = e.target.closest && e.target.closest(".info"); if (el) { e.stopPropagation(); e.preventDefault(); infoAt(el); } }, true);

function hbars(rows, lw) {
  return `<div class="viz hbars" style="--lw:${lw || 150}px">${rows.map(r => `<div class="hb" ${r.attr || ""} ${tipA(r.tip)}>
    <span class="l">${r.label}</span><span class="track"><span class="fill" style="--w:${clamp(r.value / r.max * 100, 0.8, 100)}%;background:${r.color}"></span></span>
    <span class="v">${r.text}</span></div>`).join("")}</div>`;
}
function ring(pct, color, size, label, sub) {
  const c = size / 2, r = c - 8, C = 2 * Math.PI * r;
  return `<div class="ringbox"><svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#EEEFEA" stroke-width="11"/>
    <circle class="arc" cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="11" stroke-linecap="round"
      stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" style="--off:${(C * (1 - clamp(pct, 0, 100) / 100)).toFixed(1)}" transform="rotate(-90 ${c} ${c})"/>
    <text x="${c}" y="${c}" text-anchor="middle" dominant-baseline="central" style="font:700 ${Math.round(size / 4.6)}px var(--display);fill:#16191B">${label == null ? Math.round(pct) + "%" : label}</text></svg>
    ${sub ? `<span>${sub}</span>` : ""}</div>`;
}
function vcols(items, h, labels) {
  const mx = Math.max(...items.map(i => i.v), 1);
  return `<div class="viz"><div class="vcols" style="height:${h || 180}px">${items.map(it => { const pc = it.v / mx * 100;
    return `<div ${it.attr || ""} ${tipA(it.tip)}><span class="ct" style="bottom:calc(${pc}% + 4px)">${it.top}</span>
      <div class="col" style="height:${Math.max(pc, 1.5)}%;background:${it.color}"></div></div>`; }).join("")}</div>
    <div class="vx">${labels.map(l => `<span>${l}</span>`).join("")}</div></div>`;
}
function probDonut(p, size) {
  const c = size / 2, r = c - 8, seg = 2 * Math.PI / 5, gap = 0.09;
  let arcs = "";
  for (let k = 0; k < 5; k++) {
    const a0 = -Math.PI / 2 + k * seg + gap / 2, a1 = a0 + seg - gap;
    arcs += `<path d="M${(c + r * Math.cos(a0)).toFixed(2)} ${(c + r * Math.sin(a0)).toFixed(2)} A${r} ${r} 0 0 1 ${(c + r * Math.cos(a1)).toFixed(2)} ${(c + r * Math.sin(a1)).toFixed(2)}"
      fill="none" stroke="${p._probs[k] ? PCOL[3] : "#EAEBE5"}" stroke-width="10" ${tipA(`${PROBLEMS[k].short}: ${p._probs[k] ? "yes" : "no"}`)}/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="flex:none">${arcs}
    <text x="${c}" y="${c - 4}" text-anchor="middle" dominant-baseline="central" style="font:700 ${Math.round(size / 3)}px var(--display);fill:${p._n >= 2 ? PCOL[Math.max(p._n, 3)] : "#16191B"}">${p._n}</text>
    <text x="${c}" y="${c + size / 5}" text-anchor="middle" style="font:500 11px var(--mono);fill:#8C9397">of 5</text></svg>`;
}
function stackRow(parts) {
  const tot = sum(parts, x => x.v) || 1;
  return `<div class="stack">${parts.filter(x => x.v > 0).map(x => `<div style="flex-grow:${x.v};flex-basis:0;background:${x.color};color:${x.ink || "#fff"}" ${x.attr || ""}
    ${tipA(`${x.label}: <b>${x.v}</b> (${Math.round(x.v / tot * 100)}%)`)}>${x.v / tot > 0.06 ? x.v : ""}</div>`).join("")}</div>`;
}
const chipsOf = list => `<div class="chips" style="margin-top:12px;width:100%">${list.map(p => `<button class="chip" data-pick="${p._i}" ${tipA(placeTip(p))}>${esc(p._name)}</button>`).join("")}</div>`;

/* ========================= pages and global clicks ========================= */
let page = "map";
function show(pg) {
  if (!$("#p-" + pg)) pg = "home";
  page = pg;
  $$(".page").forEach(s => s.classList.toggle("show", s.dataset.pg === pg));
  $$("#nav button").forEach(b => b.setAttribute("aria-selected", b.dataset.p === pg));
  $("#nav").classList.remove("open");
  untip();
  if (pg === "map") { resize(); requestDraw(); maybeWelcome(); } else endTour();
  observeViz();
}
function go(pg) {
  if (location.hash !== "#" + pg) history.pushState(null, "", "#" + pg);
  show(pg);
}
window.addEventListener("popstate", () => show((location.hash || "#home").slice(1)));
$$("#nav button").forEach(b => b.addEventListener("click", () => go(b.dataset.p)));
$("#menuBtn").onclick = () => { const o = !$("#nav").classList.contains("open"); $("#nav").classList.toggle("open", o); $("#menuBtn").setAttribute("aria-expanded", o); };
document.addEventListener("click", e => {
  const t = e.target.closest && e.target.closest("[data-go],[data-pick],[data-report],[data-spot],[data-region],[data-act],[data-tab]");
  if (!t) return;
  const d = t.dataset;
  if (d.go) go(d.go);
  else if (d.pick != null) { closeReport(); go("map"); clearSpot(true); selectPlace(+d.pick, true); }
  else if (d.report != null) openReport(+d.report);
  else if (d.spot) { go("map"); closeSide(); spotlight(d.spot); }
  else if (d.region) { go("map"); clearSpot(true); openRegion(d.region, true); }
  else if (d.tab) {
    const box = t.closest("[data-tabs]");
    $$("[data-tab]", box).forEach(b => b.setAttribute("aria-pressed", b === t));
    $$(".tabp", box).forEach(p => p.style.display = p.dataset.p === d.tab ? "" : "none");
    observeViz(box);
  } else if (d.act) { const [a, v] = d.act.split(":"); ACTS[a](v); }
});
const ACTS = {
  towers: () => { go("map"); closeSide(); clearSpot(true); playTowers(); },
  group: k => { const g = GROUPS[+k][0]; SPOTS["group" + k] = [PLACES.filter(p => p.Group === g), `Kind of place: ${g}`];
    go("map"); closeSide(); spotlight("group" + k); }
};
const vizObs = window.IntersectionObserver && !calm
  ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); vizObs.unobserve(en.target); } }), { threshold: 0.15 })
  : null;
function observeViz(root) { $$(".viz:not(.in)", root || document).forEach(v => vizObs ? vizObs.observe(v) : v.classList.add("in")); }

/* ========================= 3D map engine ========================= */
const K = Math.cos(18.5 * Math.PI / 180);
const WX = lon => lon * K, WY = lat => -lat;
function toRings(geom, eps) {
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  return polys.map(poly => poly.map(ring => {
    const out = []; let lx = 1e9, ly = 1e9;
    ring.forEach((c, i) => { const x = WX(c[0]), y = WY(c[1]);
      if (i === ring.length - 1 || Math.abs(x - lx) + Math.abs(y - ly) > eps) { out.push(x, y); lx = x; ly = y; } });
    return out;
  }).filter(r => r.length >= 6)).filter(p => p.length);
}
function bboxOf(polys) {
  const b = [1e9, 1e9, -1e9, -1e9];
  polys.forEach(poly => poly.forEach(r => { for (let i = 0; i < r.length; i += 2) {
    b[0] = Math.min(b[0], r[i]); b[1] = Math.min(b[1], r[i + 1]); b[2] = Math.max(b[2], r[i]); b[3] = Math.max(b[3], r[i + 1]); } }));
  return b;
}
function inPolys(polys, x, y) {
  let inside = false;
  for (const poly of polys) for (const r of poly)
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i], yi = r[i + 1], xj = r[j], yj = r[j + 1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
  return inside;
}
const GEO = {
  states: STATES.features.filter(f => f.properties.STE_NAME21 !== "Northern Territory").map(f => toRings(f.geometry, 0.04)),
  nt: [].concat(...NT.features.map(f => toRings(f.geometry, 0.012))),
  regions: REGIONS.features.map(f => { const polys = toRings(f.geometry, 0.012); return { name: f.properties.SA2_NAME21, polys, bb: bboxOf(polys) }; })
};

const cv = $("#gl"), ctx = cv.getContext("2d"), stage = $("#stage"), mapPage = $("#p-map");
let sizeK = 1, insetB = 0, W = 900, H = 600, DPR = 1, Z0 = 40, userMoved = false, is3D = false, started = false;
const cam = { x: WX(133.5), y: WY(-18.8), zoom: 40, pitch: 0, bearing: 0 };
const inset = { l: 0, r: 0, lt: 0, rt: 0 };
const PITCH3D = 0.78, BEAR3D = -0.18, PMAX = 1.1, NEAR = 30, LIGHT = Math.PI / 2 - 0.7;
let P = null;
function setP() {
  P = { cb: Math.cos(cam.bearing), sb: Math.sin(cam.bearing), cp: Math.cos(cam.pitch), sp: Math.sin(cam.pitch),
    D: Math.max(H, 520) * 1.7, cx: inset.l + (W - inset.l - inset.r) / 2, cy: (H - insetB) * 0.5 + H * 0.05 * Math.sin(cam.pitch) };
}
function camSpace(x, y, z) {
  const rx = (x - cam.x) * cam.zoom, ry = (y - cam.y) * cam.zoom, zz = z * cam.zoom;
  const by = rx * P.sb + ry * P.cb;
  return [rx * P.cb - ry * P.sb, by * P.cp - zz * P.sp, P.D - by * P.sp - zz * P.cp];
}
function project(x, y, z) {
  const c = camSpace(x, y, z);
  if (c[2] < NEAR) return null;
  const s = P.D / c[2];
  return [P.cx + c[0] * s, P.cy + c[1] * s, c[2]];
}
function unproject(sx, sy) {
  const u = sx - P.cx, v = sy - P.cy, den = P.D * P.cp + v * P.sp;
  if (den <= 1) return null;
  const by = v * P.D / den, s = P.D / (P.D - by * P.sp), bx = u / s;
  return [cam.x + (bx * P.cb + by * P.sb) / cam.zoom, cam.y + (-bx * P.sb + by * P.cb) / cam.zoom];
}
function traceRing(r, z) {
  const n = r.length / 2;
  let pts = new Array(n), clip = false;
  for (let i = 0; i < n; i++) { const c = camSpace(r[2 * i], r[2 * i + 1], z); pts[i] = c; if (c[2] < NEAR) clip = true; }
  if (clip) {                                  // cut the ring at the camera's near plane
    const out = [];
    for (let i = 0; i < n; i++) {
      const A = pts[i], B = pts[(i + 1) % n], ia = A[2] >= NEAR, ib = B[2] >= NEAR;
      if (ia) out.push(A);
      if (ia !== ib) { const t = (NEAR - A[2]) / (B[2] - A[2]); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, NEAR]); }
    }
    pts = out;
    if (pts.length < 3) return;
  }
  for (let i = 0; i < pts.length; i++) {
    const s = P.D / pts[i][2], x = P.cx + pts[i][0] * s, y = P.cy + pts[i][1] * s;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.closePath();
}
const tracePolys = (polys, z) => { for (const poly of polys) for (const r of poly) traceRing(r, z); };

/* map icons, drawn on the canvas from the same 24×24 shapes as the page icons */
const CICON = {
  tower: new Path2D("M12 9v12M8.5 21l3.5-12 3.5 12M9.6 17h4.8M13.6 7a1.6 1.6 0 1 1-3.2 0a1.6 1.6 0 1 1 3.2 0M8.2 3.8a5.3 5.3 0 0 0 0 6.4M15.8 3.8a5.3 5.3 0 0 1 0 6.4"),
  cyclone: new Path2D("M14 12a2 2 0 1 1-4 0a2 2 0 1 1 4 0M14 12c0-4-2-7-7-7M10 12c0 4 2 7 7 7M12 10c4 0 7-1.5 8-4M12 14c-4 0-7 1.5-8 4"),
  link: new Path2D("M4 20V11M20 20V11M2.5 11.5a3 3 0 0 1 3-3M21.5 11.5a3 3 0 0 0-3-3M6.5 9.5l2.5-2 2.5 2 2.5-2 2.5 2 1.5-1"),
  school: new Path2D("M3 10l9-5 9 5-9 5zM7 12.5v4c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5v-4"),
  clinic: new Path2D("M12 6.5v11M6.5 12h11")
};
/* things that can be switched on over the places: [key, label, colour, which places, where the badge sits (angle)] */
const LAYERS = [
  { k: "cyclone", label: "Cyclone risk", col: "#7B4FC9", test: p => p._probs[4], ang: -Math.PI / 4,
    help: "A cyclone icon marks places where 10 or more cyclones passed within 100 km since 1995." },
  { k: "link", label: "Single radio link", col: "#C2410C", test: p => p._probs[3], ang: -3 * Math.PI / 4,
    help: "A radio-link icon marks places whose phone and internet all travel over one radio beam." },
  { k: "school", label: "Schools", col: "#2563EB", test: p => p.Schools > 0, ang: 3 * Math.PI / 4,
    help: "A school icon marks places with at least one school." },
  { k: "clinic", label: "Health clinics", col: "#DC2626", test: p => !!p.Clinic_name, ang: Math.PI / 4,
    help: "A cross marks places with a remote health clinic." }
];
const LAYER_ICON = { cyclone: "cyclone", link: "link", school: "school", clinic: "clinic" };

/* map state */
const M = { mode: "problems", scoreKey: OVERALL.key, shownN: new Set([0, 1, 2, 3, 4]), need: new Set(), group: null,
  type: "ALL", school: false, clinic: false, q: "", spot: null, spotKey: null, shade: false, names: false,
  show: { cyclone: false, link: false, school: false, clinic: false },
  towers: 0, tw: 0, sel: null, selT: 0, selRegion: null, hover: null, hoverRegion: null };
const PS = PLACES.map(p => ({ x: WX(p.LONGITUDE), y: WY(p.LATITUDE), h: 0, ht: 0, vis: 1, vt: 1, col: hexRgb(colourFor(p._n)), ct: hexRgb(colourFor(p._n)), tp: null }));
const TW = { old: TOWERS.old.map(c => [WX(c[0]), WY(c[1])]),
  nw: TOWERS.new.map((c, i) => [WX(c[0]), WY(c[1]), ((i * 0.618034) % 1) * 0.7, TOWERS.newCof[i]]) };
const radiusPx = p => (p.POPULATION == null ? 3.2 : 3.2 + Math.sqrt(p.POPULATION) * 0.105) * 1.25;
function visible(p) {
  if (M.spot && !M.spot.has(p._i)) return false;
  if (M.mode === "problems" && !M.shownN.has(p._n)) return false;
  if (M.mode === "group" && M.group && p.Group !== M.group) return false;
  for (const k of M.need) if (!p._probs[k]) return false;
  if (M.type !== "ALL" && p["SITE TYPE"] !== M.type) return false;
  if (M.school && !p.Schools) return false;
  if (M.clinic && !p.Clinic_name) return false;
  if (M.q && !p._name.toLowerCase().includes(M.q) && !(p.SA2_Name || "").toLowerCase().includes(M.q)) return false;
  return true;
}
const colorOf = p => M.mode === "group" ? hexRgb(groupColour(p.Group)) : M.mode === "score" ? rampRgb(p[M.scoreKey] / 25) : hexRgb(colourFor(p._n));
const heightOf = p => M.mode === "score" ? 5 + p[M.scoreKey] * 0.6 : 5 + p._n * 14;
let anim = false;
function retarget() {
  PLACES.forEach((p, i) => { const s = PS[i]; s.vt = visible(p) ? 1 : 0; s.ht = heightOf(p); s.ct = colorOf(p); });
  anim = true; requestDraw(); updateCount();
}
function stepAnim() {
  let moving = false;
  const k = calm ? 1 : 0.13;
  for (const s of PS) {
    let d = s.ht - s.h; if (Math.abs(d) > 0.05) { s.h += d * k; moving = true; } else s.h = s.ht;
    d = s.vt - s.vis; if (Math.abs(d) > 0.005) { s.vis += d * k; moving = true; } else s.vis = s.vt;
    for (let c = 0; c < 3; c++) { d = s.ct[c] - s.col[c]; if (Math.abs(d) > 0.4) { s.col[c] += d * k; moving = true; } else s.col[c] = s.ct[c]; }
  }
  for (const side of ["l", "r"]) { const d = inset[side + "t"] - inset[side]; if (Math.abs(d) > 0.5) { inset[side] += d * (calm ? 1 : 0.16); moving = true; } else inset[side] = inset[side + "t"]; }
  const target = M.towers === 2 ? 1 : 0;
  if (M.tw !== target) { M.tw = target > M.tw ? Math.min(1, M.tw + (calm ? 1 : 0.009)) : Math.max(0, M.tw - (calm ? 1 : 0.03)); moving = true; }
  return moving;
}

/* drawing */
let hits = [];
const easeBack = t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
function signedArea(pts) { let a = 0; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1]; return a; }
function polyPath(pts) { ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); }
function groundCircle(x, y, rw) {
  ctx.beginPath(); let ok = false;
  for (let k = 0; k <= 36; k++) { const a = k / 36 * Math.PI * 2, q = project(x + rw * Math.cos(a), y + rw * Math.sin(a), 0);
    if (!q) continue; if (ok) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); ok = true; }
  return ok;
}
const growR = () => Math.pow(cam.zoom / Z0, 0.4), growH = () => Math.pow(cam.zoom / Z0, 0.55);
function draw(now) {
  setP();
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.clearRect(0, 0, W, H);
  ctx.lineJoin = "round";
  // neighbouring states
  ctx.fillStyle = "#E2E3DC"; ctx.strokeStyle = "#F4F4F0"; ctx.lineWidth = 1;
  for (const g of GEO.states) { ctx.beginPath(); tracePolys(g, 0); ctx.fill("evenodd"); ctx.stroke(); }
  // the Territory as a raised slab with a soft shadow
  const slab = 9 / cam.zoom * growH();
  ctx.beginPath(); tracePolys(GEO.nt, -slab); ctx.fillStyle = "#C3C7BD"; ctx.fill("evenodd");
  ctx.save(); ctx.shadowColor = "rgba(35,40,35,.16)"; ctx.shadowBlur = 28; ctx.shadowOffsetY = 12;
  ctx.beginPath(); tracePolys(GEO.nt, 0); ctx.fillStyle = "#FFFFFF"; ctx.fill("evenodd"); ctx.restore();
  // regions
  for (const R of GEO.regions) {
    ctx.beginPath(); tracePolys(R.polys, 0);
    const r = REG[R.name];
    if (M.shade && r) {
      ctx.fillStyle = M.mode === "score" ? rgbCss(rampRgb(r[M.scoreKey] / 25), .32) : rgbCss(rampRgb(r.avg), .32);
      ctx.fill("evenodd");
    } else if (R.name === M.hoverRegion || R.name === M.selRegion) { ctx.fillStyle = "rgba(42,111,151,.07)"; ctx.fill("evenodd"); }
    ctx.strokeStyle = "#E1E4DD"; ctx.lineWidth = 1; ctx.stroke();
  }
  for (const R of GEO.regions) if (R.name === M.hoverRegion || R.name === M.selRegion) {
    ctx.beginPath(); tracePolys(R.polys, 0);
    ctx.strokeStyle = R.name === M.selRegion ? "#16191B" : "#8FA7B5"; ctx.lineWidth = R.name === M.selRegion ? 2 : 1.4; ctx.stroke();
  }
  ctx.beginPath(); tracePolys(GEO.nt, 0); ctx.strokeStyle = "#98A39C"; ctx.lineWidth = 1.2; ctx.stroke();
  const gR = growR();
  // phone towers, drawn as small tower icons: grey = built before 2018, blue = new since 2018
  if (M.towers || M.tw > 0) {
    const tr = clamp(7.5 * gR * sizeK, 5.5, 13);
    for (const t of TW.old) { const q = project(t[0], t[1], 0); if (q) iconBadge(q[0], q[1], tr, "tower", "#7E8A85", "#fff", 1); }
    for (const t of TW.nw) {
      const k = clamp((M.tw - t[2]) / 0.3, 0, 1); if (!k) continue;
      const q = project(t[0], t[1], 0); if (!q) continue;
      iconBadge(q[0], q[1], Math.max(tr * 1.12 * easeBack(k), 0.1), "tower", "#1D6FB8", "#fff", 1);
    }
  }
  // selection pulse
  if (M.sel != null) {
    const s = PS[M.sel], q = project(s.x, s.y, 0), ph = ((now - M.selT) / 1500) % 1;
    if (q) { ctx.beginPath(); ctx.arc(q[0], q[1], markerR(gR) * (1.3 + ph * 2.2), 0, 7); ctx.strokeStyle = `rgba(22,25,27,${(1 - ph) * 0.7})`; ctx.lineWidth = 2.5; ctx.stroke(); }
  }
  // place markers: fewest problems first so the hardest-hit places sit on top
  hits = [];
  const order = PLACES.map(p => p._i).sort((a, b) => PLACES[a]._n - PLACES[b]._n);
  for (const i of order) drawMarker(i, gR);
  for (const i of order) drawBadges(i, gR);
  drawLabels();
}
/* a round badge with an outline icon inside */
function iconBadge(x, y, r, key, bg, fg, alpha) {
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = Math.max(1.2, r * 0.22); ctx.strokeStyle = "#fff"; ctx.stroke();
  ctx.save(); ctx.translate(x, y); const k = r * 1.35 / 24; ctx.scale(k, k); ctx.translate(-12, -12);
  ctx.strokeStyle = fg; ctx.lineWidth = 2.3; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke(CICON[key]); ctx.restore();
  ctx.globalAlpha = 1;
}
const markerR = gR => clamp(8.5 * gR * sizeK, 6.5, 17);
function drawMarker(i, gR) {
  const s = PS[i], v = s.vis, q = project(s.x, s.y, 0);
  s.tp = null; s.sp = null;
  if (!q) return;
  if (v < 0.04) { ctx.fillStyle = "rgba(140,147,151,.35)"; ctx.beginPath(); ctx.arc(q[0], q[1], 2.2, 0, 7); ctx.fill(); return; }
  const sel = M.sel === i, hov = M.hover === i;
  const R = markerR(gR) * (0.55 + 0.45 * v) * (hov || sel ? 1.18 : 1);
  ctx.globalAlpha = 0.3 + 0.7 * v;
  ctx.save(); ctx.shadowColor = "rgba(20,24,26,.28)"; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1.5;
  ctx.beginPath(); ctx.arc(q[0], q[1], R, 0, 7); ctx.fillStyle = rgbCss(s.col); ctx.fill(); ctx.restore();
  ctx.lineWidth = sel ? 3 : 2; ctx.strokeStyle = sel ? "#16191B" : "#fff"; ctx.stroke();
  if (M.mode === "problems" && R >= 7.5) {
    const n = PLACES[i]._n;
    ctx.fillStyle = inkOn(n); ctx.font = `700 ${Math.round(R * 1.15)}px "IBM Plex Sans", system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(n, q[0], q[1] + 0.5);
  }
  ctx.globalAlpha = 1;
  s.sp = [q[0], q[1], R];
  s.tp = [q[0], q[1] - R - (LAYERS.some(L => M.show[L.k] && L.test(PLACES[i])) ? R * 0.9 : 3)];
  if (v > 0.5) hits.push({ i, x0: q[0] - R, y0: q[1] - R, x1: q[0] + R, y1: q[1] + R, dep: -PLACES[i]._n });
}
/* small icons around a marker for the layers that are switched on */
function drawBadges(i, gR) {
  const s = PS[i]; if (!s.sp || s.vis < 0.5) return;
  const p = PLACES[i], [x, y, R] = s.sp, br = clamp(R * 0.7, 6, 12);
  for (const L of LAYERS) if (M.show[L.k] && L.test(p))
    iconBadge(x + Math.cos(L.ang) * R * 1.05, y + Math.sin(L.ang) * R * 1.05, br, LAYER_ICON[L.k], L.col, "#fff", s.vis);
}
const LABEL_ORDER = PLACES.slice().sort((a, b) => b._n - a._n || byPop(a, b)).map(p => p._i);
function drawLabels() {
  const want = [];
  if (M.sel != null) want.push([M.sel, 1]);
  if (M.hover != null) want.push([M.hover, 1]);
  if (M.spot) M.spot.forEach(i => want.push([i, 0]));
  if (M.names || cam.zoom > Z0 * 2.2) LABEL_ORDER.forEach(i => { if (PS[i].vis > 0.5) want.push([i, 0]); });
  const taken = [], seen = new Set();
  ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.lineJoin = "round";
  for (const [i, must] of want) {
    if (seen.has(i)) continue; seen.add(i);
    const s = PS[i]; if (!s.tp || s.vis < 0.3) continue;
    const big = must || (M.spot && M.spot.has(i));
    ctx.font = `${big ? 600 : 500} ${big ? 13 : 11.5}px "IBM Plex Sans", system-ui, sans-serif`;
    const t = PLACES[i]._name, w = ctx.measureText(t).width + 6, h = big ? 16 : 14;
    const b = [s.tp[0] - w / 2, s.tp[1] - h, s.tp[0] + w / 2, s.tp[1]];
    if (!must && taken.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
    taken.push(b);
    ctx.lineWidth = 3.5; ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.strokeText(t, s.tp[0], s.tp[1]);
    ctx.fillStyle = "#16191B"; ctx.fillText(t, s.tp[0], s.tp[1]);
  }
  if (M.names) {
    ctx.font = `500 10.5px "IBM Plex Mono", ui-monospace, monospace`; ctx.textBaseline = "middle";
    REGION_LABELS.slice().sort((a, b) => b.km2 - a.km2).forEach(L => {
      const q = project(WX(L.lon), WY(L.lat), 0); if (!q) return;
      const t = L.name.toUpperCase(), w = ctx.measureText(t).width + 8, b = [q[0] - w / 2, q[1] - 8, q[0] + w / 2, q[1] + 8];
      if (taken.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return;
      taken.push(b);
      ctx.lineWidth = 3; ctx.strokeStyle = "rgba(255,255,255,.85)"; ctx.strokeText(t, q[0], q[1]);
      ctx.fillStyle = "#7C8784"; ctx.fillText(t, q[0], q[1]);
    });
  }
}

/* loop, camera flights */
let raf = 0, fly = null;
function requestDraw() { if (!raf) raf = requestAnimationFrame(frame); }
function frame(now) {
  raf = 0;
  if (page !== "map") return;
  const a = stepFly(now), b = anim ? stepAnim() : false;
  anim = b;
  draw(now);
  if (a || b || (M.sel != null && now - M.selT < 6000)) requestDraw();
}
function flyTo(to, dur) {
  const b = Object.assign({ ...cam }, to);
  let db = b.bearing - cam.bearing; db = ((db + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  b.bearing = cam.bearing + db;
  fly = { a: { ...cam }, b, t0: performance.now(), dur: calm ? 1 : (dur || 1100) };
  requestDraw();
}
function stepFly(now) {
  if (!fly) return false;
  const k = clamp((now - fly.t0) / fly.dur, 0, 1), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, a = fly.a, b = fly.b;
  cam.x = lerp(a.x, b.x, e); cam.y = lerp(a.y, b.y, e); cam.pitch = lerp(a.pitch, b.pitch, e); cam.bearing = lerp(a.bearing, b.bearing, e);
  const arc = Math.min(Math.hypot(b.x - a.x, b.y - a.y) / 8, 0.45) * Math.sin(Math.PI * e);
  cam.zoom = Math.exp(lerp(Math.log(a.zoom), Math.log(b.zoom), e)) * (1 - arc);
  if (k >= 1) fly = null;
  return true;
}
function fitZoom(pitch) {
  const aw = Math.max(W - inset.lt - inset.rt - 70, 220), ah = Math.max(H - insetB - 110, 220);
  return Math.min(aw / 9.4, ah / (16.2 * (0.42 + 0.58 * Math.cos(pitch))));
}
function homeView(threeD) {
  const pitch = threeD ? PITCH3D : 0;
  return { x: WX(133.4), y: WY(-18.9) + (threeD ? 0.6 : 0), zoom: fitZoom(pitch), pitch, bearing: threeD ? BEAR3D : 0 };
}
function zoomToIds(ids) {
  if (!ids.length) return;
  const xs = ids.map(i => PS[i].x), ys = ids.map(i => PS[i].y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const aw = Math.max(W - inset.lt - inset.rt - 120, 200), ah = Math.max(H - 180, 200);
  const squash = cam.pitch > 0.2 ? 0.4 + 0.6 * Math.cos(cam.pitch) : 1;
  const z = clamp(Math.min(aw / Math.max(x1 - x0 + 1.2, 1.6), ah / Math.max((y1 - y0 + 1.2) * squash, 1.6)), Z0 * 0.9, Z0 * 9);
  flyTo({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 + (cam.pitch > 0.2 ? 0.2 * (y1 - y0 + 1) : 0), zoom: z });
}

/* size */
function resize() {
  const r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  W = r.width; H = r.height; DPR = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  const mob = W < 860;
  insetB = mob ? Math.min(H * 0.46, 380) : 0;
  sizeK = clamp(Math.min(W - inset.lt, H - insetB) / 760, 0.5, 1);
  inset.lt = mob ? 0 : 348; inset.rt = mob || !side.classList.contains("open") ? 0 : 378;
  if (!started) { inset.l = inset.lt; inset.r = inset.rt; }
  Z0 = fitZoom(0);
  if (!started) {
    started = true;
    Object.assign(cam, homeView(false)); cam.zoom *= 0.8;
    retarget();
    flyTo(homeView(false), 1200);
  } else if (!userMoved && !fly) Object.assign(cam, homeView(is3D));
  requestDraw();
}
if (window.ResizeObserver) new ResizeObserver(() => { if (page === "map") resize(); }).observe(stage);
window.addEventListener("resize", () => { if (page === "map") resize(); });

/* pointer, wheel and touch */
const ptrs = new Map();
let drag = null, moved = false;
function hideHint() { $("#hint").classList.add("gone"); }
cv.addEventListener("pointerdown", e => {
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  ptrs.set(e.pointerId, [e.offsetX, e.offsetY]); fly = null; hideHint();
  setP();
  if (ptrs.size === 1) {
    drag = { mode: "pan", x: e.offsetX, y: e.offsetY,
      g: unproject(e.offsetX, e.offsetY), pitch: cam.pitch, bearing: cam.bearing };
    moved = false;
  } else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    drag = { mode: "pinch", d: Math.hypot(a[0] - b[0], a[1] - b[1]), ang: Math.atan2(b[1] - a[1], b[0] - a[0]), zoom: cam.zoom, bearing: cam.bearing };
    moved = true;
  }
});
cv.addEventListener("pointermove", e => {
  if (!ptrs.has(e.pointerId)) { hoverAt(e.offsetX, e.offsetY, e.clientX, e.clientY); return; }
  ptrs.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (!drag) return;
  if (drag.mode === "pinch") {
    if (ptrs.size < 2) return;
    const [a, b] = [...ptrs.values()], mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    setP(); const g0 = unproject(mx, my);
    cam.zoom = clamp(drag.zoom * Math.hypot(a[0] - b[0], a[1] - b[1]) / drag.d, Z0 * 0.5, Z0 * 40);
    setP(); const g1 = unproject(mx, my);
    if (g0 && g1) { cam.x += g0[0] - g1[0]; cam.y += g0[1] - g1[1]; }
  } else {
    const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
    if (!moved && Math.hypot(dx, dy) < 4) return;
    moved = true; cv.classList.add("drag"); untip();
    setP(); const g1 = unproject(e.offsetX, e.offsetY);
    if (drag.g && g1) { cam.x += drag.g[0] - g1[0]; cam.y += drag.g[1] - g1[1]; }
  }
  userMoved = true; requestDraw();
});
function endPtr(e) {
  ptrs.delete(e.pointerId);
  if (!ptrs.size) {
    if (drag && drag.mode !== "pinch" && !moved && e.type === "pointerup") clickAt(e.offsetX, e.offsetY);
    drag = null; cv.classList.remove("drag");
  } else drag = null;
}
cv.addEventListener("pointerup", endPtr);
cv.addEventListener("pointercancel", endPtr);
cv.addEventListener("pointerleave", () => { if (!ptrs.size) { M.hover = null; M.hoverRegion = null; untip(); requestDraw(); } });
cv.addEventListener("contextmenu", e => e.preventDefault());
cv.addEventListener("wheel", e => { e.preventDefault(); fly = null; hideHint(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0016)); }, { passive: false });
function zoomAt(x, y, f) {
  setP(); const g0 = unproject(x, y);
  cam.zoom = clamp(cam.zoom * f, Z0 * 0.5, Z0 * 40);
  setP(); const g1 = unproject(x, y);
  if (g0 && g1) { cam.x += g0[0] - g1[0]; cam.y += g0[1] - g1[1]; }
  userMoved = true; requestDraw();
}
function hitAt(x, y) {
  let best = null;
  for (const h of hits) if (x >= h.x0 - 2 && x <= h.x1 + 2 && y >= h.y0 - 2 && y <= h.y1 + 2 && (!best || h.dep < best.dep)) best = h;
  return best ? best.i : null;
}
function regionAt(x, y) {
  setP(); const g = unproject(x, y); if (!g) return null;
  for (const R of GEO.regions) if (g[0] >= R.bb[0] && g[0] <= R.bb[2] && g[1] >= R.bb[1] && g[1] <= R.bb[3] && inPolys(R.polys, g[0], g[1])) return R.name;
  return null;
}
function hoverAt(x, y, cx, cy) {
  const i = hitAt(x, y), r = i == null ? regionAt(x, y) : null;
  if (i !== M.hover || r !== M.hoverRegion) { M.hover = i; M.hoverRegion = r; requestDraw(); }
  cv.classList.toggle("hand", i != null || !!(r && REG[r]));
  if (i != null) tip(placeTip(PLACES[i]), cx, cy);
  else if (r && REG[r]) tip(`<b>${esc(r)}</b> (region)<br>${REG[r].n} places here, ${REG[r].avg.toFixed(1)} problems each on average<br><span style="opacity:.55;font-size:12px">Click to see the whole region</span>`, cx, cy);
  else if (r) tip(`<b>${esc(r)}</b> (region)<br>None of the 188 places are here`, cx, cy);
  else untip();
}
function clickAt(x, y) {
  const i = hitAt(x, y);
  if (i != null) { selectPlace(i, true); return; }
  const r = regionAt(x, y);
  if (r && REG[r]) openRegion(r, false); else closeSide();
}
$("#zin").onclick = () => { hideHint(); setP(); zoomAt(P.cx, H / 2, 1.6); };
$("#zout").onclick = () => { hideHint(); setP(); zoomAt(P.cx, H / 2, 1 / 1.6); };
$("#homeBtn").onclick = () => { userMoved = false; clearSpot(true); closeSide(); flyTo(homeView(is3D)); };
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { if ($("#report").classList.contains("open")) closeReport(); else if (page === "map") closeSide(); }
});

/* ========================= map panels ========================= */
/* the round icon badge used in the panel, matching the one drawn on the map */
const badge = (key, bg, size) => `<span class="badge" style="background:${bg};width:${size || 26}px;height:${size || 26}px">${smallIcon(key, Math.round((size || 26) * 0.62))}</span>`;
function buildLP() {
  const counts = [0, 1, 2, 3, 4].map(n => PLACES.filter(p => p._n === n).length);
  const types = [["ALL", "All"], ["COMMUNITY", "Communities"], ["HIGHWAY", "Highway stops"], ["TOURISM", "Tourist spots"], ["VILLAGE", "Villages"]];
  const legend = `<div class="lbl">What the colours mean <span>click to show only those</span></div>
    <div class="nkey">${counts.map((c, n) => `<button data-n="${n}" aria-pressed="${M.shownN.has(n)}">
      ${dot(n)}<span><b>${NWORD[n]}</b><span class="soft small"> · ${NLABEL[n].toLowerCase()}</span></span><span class="mono small soft">${c}</span></button>`).join("")}</div>
    <p class="small faint" style="margin-top:6px">The number inside each circle is how many of the 5 problems that place has.</p>`;
  $("#lp").innerHTML = `
    <h1 class="lp-h">Where is it hard to stay connected?</h1>
    <p class="small soft">Each circle on the map is one of <b>188 remote places</b> in the Northern Territory. We checked every place for 5 common phone and internet problems.</p>
    <input class="search" id="q" type="search" placeholder="Search for a place or region" value="${esc(M.q)}" autocomplete="off" style="margin-top:12px">
    <div class="count-line" id="countLine"></div>
    <div class="lbl">Type of place</div>
    <div class="chips">${types.map(t => `<button class="chip" data-t="${t[0]}" aria-pressed="${M.type === t[0]}">${t[1]}</button>`).join("")}</div>
    ${legend}
    <div class="lbl">Show on the map <span>switch on or off</span></div>
    <label class="lay"><span class="badge2">${badge("tower", "#1D6FB8")}</span><span><b>Phone towers</b> ${info("tower")}<span class="sub">Grey: built before 2018 · Blue: new since 2018</span></span>
      <input type="checkbox" class="sw" id="tTowers" ${M.towers ? "checked" : ""}></label>
    ${LAYERS.map(L => `<label class="lay"><span class="badge2">${badge(LAYER_ICON[L.k], L.col)}</span><span><b>${L.label}</b>${WORDS[L.k] ? " " + info(L.k) : ""}<span class="sub">${L.help} (${PLACES.filter(L.test).length} places)</span></span>
      <input type="checkbox" class="sw" data-layer="${L.k}" ${M.show[L.k] ? "checked" : ""}></label>`).join("")}
    <label class="lay"><span class="badge2"><span class="badge" style="width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,${PCOL[1]},${PCOL[3]})"></span></span><span><b>Colour by region</b> ${info("region")}<span class="sub">Shade each region by the average number of problems of its places</span></span>
      <input type="checkbox" class="sw" id="tShade" ${M.shade ? "checked" : ""}></label>
    <label class="lay"><span class="badge2"><span class="badge" style="background:#8A948F;font:700 12px var(--body);color:#fff">Aa</span></span><span><b>Names</b><span class="sub">Always show place and region names</span></span>
      <input type="checkbox" class="sw" id="tNames" ${M.names ? "checked" : ""}></label>
    <div class="lbl">The 5 problems we check <span>click to find them</span></div>
    ${PROBLEMS.map((pr, k) => { const c = PLACES.filter(pr.test).length;
      return `<button class="prow" data-need="${k}" aria-pressed="${M.need.has(k)}">${ICON[pr.id]}<span class="t"><b>${pr.short}</b><span class="pl">${PLAIN[pr.id]}</span></span><span class="n">${c}<small>places</small></span></button>`; }).join("")}
    <p class="small faint" style="margin-top:4px">Pick one or more to show only places that have all of them.</p>
    <div class="lbl">Quick views</div>
    ${[["worst", S.worst.length, `places have ${MAXN} of the 5 problems`], ["both", S.both.length, "places where the school and clinic face 3+ problems"],
      ["oneLink", S.oneLink.length, "communities on one radio link in cyclone country"], ["waiting", S.waiting.length, "places still waiting for a tower since 2018"]].map(([k, n, t]) =>
      `<button class="story" data-story="${k}" aria-pressed="${M.spotKey === k}"><b>${n}</b><span>${t}</span></button>`).join("")}
    <p class="small faint" style="margin-top:16px;line-height:1.45">We acknowledge the Traditional Owners of the lands and seas of the Northern Territory, and pay our respects to Elders past and present.</p>`;
  const lp = $("#lp");
  $$("[data-t]", lp).forEach(b => b.onclick = () => { M.type = b.dataset.t; buildLP(); retarget(); });
  $$(".nkey [data-n]", lp).forEach(b => b.onclick = () => { const n = +b.dataset.n;
    if (M.shownN.size === 5) M.shownN = new Set([n]); else if (M.shownN.has(n)) M.shownN.delete(n); else M.shownN.add(n);
    if (!M.shownN.size) M.shownN = new Set([0, 1, 2, 3, 4]);
    buildLP(); retarget(); });
  $$("[data-need]", lp).forEach(b => b.onclick = () => { const k = +b.dataset.need; if (M.need.has(k)) M.need.delete(k); else M.need.add(k); buildLP(); retarget(); });
  $$("[data-layer]", lp).forEach(c => c.onchange = () => { M.show[c.dataset.layer] = c.checked; hideHint(); requestDraw(); });
  $("#q").oninput = e => { M.q = e.target.value.trim().toLowerCase(); retarget(); };
  $$("[data-story]", lp).forEach(b => b.onclick = () => { if (M.spotKey === b.dataset.story) clearSpot(); else { closeSide(); spotlight(b.dataset.story); } });
  $("#tShade").onchange = e => { M.shade = e.target.checked; hideHint(); requestDraw(); };
  $("#tNames").onchange = e => { M.names = e.target.checked; requestDraw(); };
  $("#tTowers").onchange = e => { if (e.target.checked) playTowers(); else setTowers(0); };
  updateCount();
}
function updateCount() {
  const el = $("#countLine"); if (!el) return;
  const n = PLACES.filter(visible).length, filtered = n < 188;
  el.innerHTML = `Showing <b>${n}</b> of 188 places${filtered ? ` · <button id="resetF" style="border:0;background:none;color:var(--accent);cursor:pointer;padding:0;font-size:13px">clear filters</button>` : ""}`;
  if (filtered) $("#resetF").onclick = () => { M.shownN = new Set([0, 1, 2, 3, 4]); M.need.clear(); M.group = null; M.type = "ALL"; M.school = M.clinic = false; M.q = ""; clearSpot(true); buildLP(); retarget(); };
}
function spotlight(key) {
  const [set, banner] = SPOTS[key];
  M.spot = new Set(idsOf(set)); M.spotKey = key;
  const bn = $("#banner");
  bn.innerHTML = `<span>${esc(banner)}</span><button id="clearSpot">Show all</button>`;
  bn.style.display = "flex";
  $("#clearSpot").onclick = () => clearSpot();
  hideHint(); buildLP(); retarget();
  requestAnimationFrame(() => zoomToIds(idsOf(set)));
}
function clearSpot(quiet) {
  const had = !!M.spot;
  M.spot = null; M.spotKey = null; $("#banner").style.display = "none";
  if (had) { buildLP(); retarget(); if (!quiet) flyTo(homeView(is3D)); }
}

/* towers timeline */
function setTowers(mode, animateIn) {
  M.towers = mode;
  if (mode === 2 && animateIn) M.tw = 0;
  const cb = $("#tTowers"); if (cb) cb.checked = !!mode;
  buildTimeline(); anim = true; requestDraw();
}
let twTimer = 0;
function playTowers() {
  clearTimeout(twTimer);
  setTowers(1);
  twTimer = setTimeout(() => setTowers(2, true), calm ? 0 : 900);
}
function buildTimeline() {
  const cof = TOWERS.newCof.filter(Boolean).length, el = $("#timeline");
  el.innerHTML = M.towers ? `
    <div class="seg"><button data-y="1" aria-pressed="${M.towers === 1}">In 2018</button><button data-y="2" aria-pressed="${M.towers === 2}">Today</button></div>
    <button class="btn sm" id="twPlay" ${tipA("Watch the new towers appear")}>${ICON.play}Play</button>
    <span class="tw-info">${M.towers === 1 ? `<span class="tw-key">${badge("tower", "#7E8A85", 20)}<b>${TOWERS.old.length}</b>&nbsp;Telstra towers in 2018</span>`
      : `<span class="tw-key">${badge("tower", "#7E8A85", 20)}${TOWERS.old.length} old&nbsp;&nbsp;${badge("tower", "#1D6FB8", 20)}<b>+${TOWERS.new.length}</b>&nbsp;new since 2018</span>`}</span>
    <button class="btn sm" id="twOff" aria-label="Hide towers">×</button>`
    : `<button class="btn sm" id="twOn">${smallIcon("tower", 16)}Show phone towers</button>`;
  if (M.towers) {
    $$("[data-y]", el).forEach(b => b.onclick = () => { clearTimeout(twTimer); setTowers(+b.dataset.y, +b.dataset.y === 2 && M.towers !== 2); });
    $("#twPlay").onclick = playTowers;
    $("#twOff").onclick = () => { clearTimeout(twTimer); setTowers(0); };
  } else $("#twOn").onclick = playTowers;
}

/* side panel: place and region */
const side = $("#side");
function openSide(html) {
  side.innerHTML = `<button class="x" id="closeSide" aria-label="Close">×</button>${html}`;
  side.classList.add("open"); mapPage.classList.add("side");
  side.scrollTop = 0;
  $("#closeSide").onclick = closeSide;
  inset.rt = W < 860 ? 0 : 378; anim = true;
  observeViz(side); hideHint(); requestDraw();
}
function closeSide() {
  if (!side.classList.contains("open") && M.sel == null && M.selRegion == null) return;
  side.classList.remove("open"); mapPage.classList.remove("side");
  M.sel = null; M.selRegion = null; inset.rt = 0; anim = true; requestDraw();
}
function sinceHtml(p) {
  if (p.Telstra_nearest_2018_km == null) return "";
  const gained = p.New_Telstra_sites_25km > 0, closer = p.Telstra_nearest_2018_km - p.Telstra_nearest_2025_km;
  return gained ? `A new Telstra tower has been built within 25 km since 2018. The nearest was ${kmText(p.Telstra_nearest_2018_km)} away and is now ${kmText(p.Telstra_nearest_2025_km)}.`
    : closer > 1 ? `The nearest Telstra tower is now ${kmText(p.Telstra_nearest_2025_km)} away, down from ${kmText(p.Telstra_nearest_2018_km)} in 2018.`
    : `No new Telstra tower has been built nearby since 2018. The nearest is still ${kmText(p.Telstra_nearest_2025_km)} away.`;
}
function sinceViz(p) {
  if (p.Telstra_nearest_2018_km == null) return "";
  const a = p.Telstra_nearest_2018_km, b = p.Telstra_nearest_2025_km, mx = Math.max(a, b, 1);
  return hbars([{ label: "2018", value: a, max: mx, color: "#9EA7A2", text: kmText(a) }, { label: "2025", value: b, max: mx, color: "#2A6F97", text: kmText(b) }], 44);
}
function clinicLine(p) {
  const when = p.Clinic_visiting_only ? "visiting service only" : p.Clinic_limited_days ? "open part of the week" : p.Clinic_emergency_24_7 ? "emergencies 24/7" : "open weekdays";
  return `${p.Clinic_operator}, ${when}`;
}
function partsViz(p, lw) {
  return hbars(PARTS.map(pt => ({ label: `${pt.short} <span class="faint">${Math.round(pt.w * 100)}%</span>`, value: p[pt.key], max: 100, color: pt.col,
    text: Math.round(p[pt.key]), tip: `<b>${pt.name}</b>, weight ${Math.round(pt.w * 100)}%<br>${pt.what}` })), lw || 132);
}
/* one row of the checklist: icon, the problem, what we found, and a clear Problem / OK mark */
const pcheck = (p, k, title) => `<div class="pcheck ${p._probs[k] ? "y" : ""}">${ICON[PROBLEMS[k].id]}<span><b>${title}</b>${WORDS[PROBLEMS[k].id] ? " " + info(PROBLEMS[k].id) : ""}<span class="v">${esc(PROBLEMS[k].detail(p))}</span></span>
  <span class="yn ${p._probs[k] ? "y" : ""}">${p._probs[k] ? "✖ Problem" : "✔ OK"}</span></div>`;
function selectPlace(i, flyThere) {
  const p = PLACES[i];
  M.sel = i; M.selT = performance.now(); M.selRegion = null;
  openSide(`
    <div class="pp-k">${p._type} · ${esc(p.SA2_Name || "")} region${p.POPULATION != null ? ` · about ${p.POPULATION} people` : ""}</div>
    <h2 class="pp-h">${esc(p._name)}</h2>
    <div class="verdict" style="--c:${colourFor(p._n)};--k:${inkOn(p._n)}"><span class="vn">${p._n}<small>of 5</small></span>
      <div><b>${NWORD[p._n]}</b><div class="small">${p._n ? `This place has ${p._n} of the 5 problems we check.` : "None of the 5 problems we check."} ${(m => m ? m + (m === 1 ? " place has" : " places have") + " more." : "No place has more.")(PLACES.filter(x => x._n > p._n).length)}</div></div></div>
    <div class="lbl">What we checked</div>
    ${PROBLEMS.map((pr, k) => pcheck(p, k, pr.short)).join("")}
    ${p.Schools || p.Clinic_name ? `<div class="lbl">Services here</div><div class="svc">${p.Schools ? `<div>${badge("school", "#2563EB", 24)}<span><b>School</b><br><span class="small soft">${esc(p.School_names)}</span></span></div>` : ""}
      ${p.Clinic_name ? `<div>${badge("clinic", "#DC2626", 24)}<span><b>Health clinic</b><br><span class="small soft">${esc(clinicLine(p))}</span></span></div>` : ""}</div>` : ""}
    ${p.Telstra_nearest_2018_km != null ? `<div class="lbl">Distance to nearest Telstra tower</div>${sinceViz(p)}<p class="small soft" style="margin-top:6px">${sinceHtml(p)}</p>` : ""}
    <details class="more"><summary>More detail</summary>
      <div class="lbl">Gap score ${info("gap")} <span><b style="color:var(--ink);font-size:15px">${Math.round(p._score)}</b> / 100 · bigger than ${p._pct}% of places</span></div>
      ${partsViz(p)}
      <div class="lbl">How sure are we?</div><span class="tag" style="background:${p._sure.bg};color:${p._sure.col}">${p._sure.label}</span>
      <p class="small soft" style="margin-top:6px">${p._sure.why}</p>
    </details>
    <div class="pp-row"><button class="btn main" data-report="${i}">Full report</button><button class="btn" data-region="${esc(p.SA2_Name)}">See the whole region</button></div>`);
  if (flyThere) flyTo({ x: PS[i].x, y: PS[i].y + (cam.pitch > 0.2 ? 0.15 : 0), zoom: Math.max(cam.zoom, Z0 * 2.4) }, 1000);
}
function openRegion(name, flyThere) {
  const r = REG[name]; if (!r) return;
  M.sel = null; M.selRegion = name;
  const dist = [0, 1, 2, 3, 4].map(n => ({ v: r.places.filter(p => p._n === n).length, color: PCOL[n], ink: inkOn(n), label: `${n} problems` }));
  openSide(`
    <div class="pp-k">Region · about ${Math.round(r.area).toLocaleString()} km²</div>
    <h2 class="pp-h">${esc(name)}</h2>
    <div class="viz rings" style="justify-content:space-between;gap:6px">${ring(r.homes, "#2A6F97", 92, null, "homes with 4G")}${ring(r.land, "#8FB3C9", 92, null, "land with 4G")}${ring(r.sat, "#B07A12", 92, null, "homes satellite-only")}</div>
    ${r.homes - r.land >= 20 ? `<div class="nb">Signal reaches homes much better than the land around them. Between places, most of this region has no mobile signal.</div>` : ""}
    <div class="lbl">${r.n} places · problems each</div>${stackRow(dist)}
    <div class="lbl">Places</div>
    ${r.places.map(p => `<button class="grow" data-pick="${p._i}" style="grid-template-columns:1fr auto 30px" ${tipA(placeTip(p))}><span>${esc(p._name)}</span>${strip(p)}<span class="pill" style="background:${colourFor(p._n)};color:${inkOn(p._n)}">${p._n}</span></button>`).join("")}`);
  if (flyThere) zoomToIds(idsOf(r.places)); else requestDraw();
}

/* ========================= tour ========================= */
const WILGI = PLACES.find(p => p["SITE NAME"] === "WILGI") || ORDER[0];
const layersOnly = keys => { Object.keys(M.show).forEach(k => M.show[k] = keys.includes(k)); buildLP(); requestDraw(); };
const TOUR = [
  { t: "Each circle is a place", x: `Every circle is one of 188 remote places. <b style="color:${PCOL[0]}">Green</b> means well connected, <b style="color:${PCOL[4]}">red</b> means hard to connect. The number inside is how many of the 5 problems it has.`,
    run: () => { closeSide(); clearSpot(true); setTowers(0); layersOnly([]); M.mode = "problems"; buildLP(); retarget(); flyTo(homeView(false)); } },
  { t: "One place, up close", x: `${WILGI._name} has ${WILGI._n} of the 5 problems. The panel on the right lists each check, marked <b>Problem</b> or <b>OK</b>, with the reason.`,
    run: () => { clearSpot(true); selectPlace(WILGI._i, true); } },
  { t: "Where it is hardest", x: `${S.worst.length} places have ${MAXN} of the 5 problems. All are in the Top End, on islands and remote coast.`,
    run: () => { closeSide(); spotlight("worst"); } },
  { t: "Schools and clinics", x: `The school and clinic icons mark places with those services. In these ${S.both.length} places, both face 3 or more problems, so online learning and telehealth suffer.`,
    run: () => { layersOnly(["school", "clinic"]); spotlight("both"); } },
  { t: "Cyclones and radio links", x: `The swirl icon marks cyclone country. The radio-link icon marks places whose phone and internet travel over one radio beam. ${S.oneLink.length} places have both: one storm can cut them off.`,
    run: () => { setTowers(0); layersOnly(["cyclone", "link"]); spotlight("oneLink"); } },
  { t: "Phone towers", x: `Each tower icon is a Telstra phone tower. <b>Blue</b> towers are the ${TOWERS.new.length} built since 2018. Most went to places that needed them, but ${S.waiting.length} places far from a tower are still waiting.`,
    run: () => { layersOnly([]); spotlight("waiting"); playTowers(); } },
  { t: "Now explore", x: "Drag the map to move it. Scroll, pinch, or use + and − to zoom. Click any circle to learn about that place. Switch icons on and off under <b>Show on the map</b>.",
    run: () => { setTowers(0); layersOnly([]); clearSpot(true); closeSide(); flyTo(homeView(false), 1200); } }
];
let tourAt = -1;
function tourStep(i) {
  tourAt = i; const s = TOUR[i], box = $("#tour");
  s.run();
  box.innerHTML = `<div class="st">Tour · ${i + 1} of ${TOUR.length}</div><h3>${s.t}</h3><p>${s.x}</p>
    <div class="row"><div class="dots">${TOUR.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("")}</div>
      <button class="btn sm" id="tExit">Close</button>${i ? '<button class="btn sm" id="tBack">Back</button>' : ""}
      ${i < TOUR.length - 1 ? '<button class="btn sm main" id="tNext">Next</button>' : '<button class="btn sm main" id="tDone">Start exploring</button>'}</div>`;
  box.style.display = "block";
  $("#tExit").onclick = endTour;
  if (i) $("#tBack").onclick = () => tourStep(i - 1);
  if (i < TOUR.length - 1) $("#tNext").onclick = () => tourStep(i + 1); else $("#tDone").onclick = endTour;
}
function endTour() { if (tourAt < 0) return; tourAt = -1; $("#tour").style.display = "none"; }
$("#tourBtn").onclick = () => { go("map"); setTimeout(() => tourStep(0), 250); };
document.addEventListener("keydown", e => {
  if (tourAt < 0) return;
  if (e.key === "ArrowRight" && tourAt < TOUR.length - 1) tourStep(tourAt + 1);
  if (e.key === "ArrowLeft" && tourAt > 0) tourStep(tourAt - 1);
});

/* ========================= welcome: how to read the map ========================= */
const SEEN = "rcnt_seen_welcome";
function showWelcome() {
  const w = $("#welcome");
  w.innerHTML = `<div class="wcard" role="document">
    <button class="x" id="wClose" aria-label="Close">×</button>
    <div class="kick">Welcome</div>
    <h2>Can people here use a phone or the internet?</h2>
    <p class="soft">This map shows how easy it is to stay connected in <b>188 remote places</b> across the Northern Territory, and what gets in the way.</p>
    <div class="wsteps">
      <div><div class="wpic">${[0, 2, 4].map(n => `<span class="ndot big" style="background:${PCOL[n]};color:${inkOn(n)}">${n}</span>`).join("")}</div>
        <b>1. Circles are places</b><p>Green = well connected. Red = hard to connect. The number is how many of 5 problems it has.</p></div>
      <div><div class="wpic">${badge("tower", "#1D6FB8", 30)}${badge("cyclone", "#7B4FC9", 30)}${badge("school", "#2563EB", 30)}${badge("clinic", "#DC2626", 30)}</div>
        <b>2. Icons add detail</b><p>Switch on phone towers, cyclone risk, schools and clinics under <i>Show on the map</i>.</p></div>
      <div><div class="wpic"><span class="ndot big" style="background:${PCOL[3]};color:${inkOn(3)};box-shadow:0 0 0 3px #16191B">3</span><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-left:-6px;margin-top:18px"><path d="M9 11V5a1.5 1.5 0 0 1 3 0v5h.5V8.5a1.5 1.5 0 0 1 3 0V10h.5a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4.6 14.8a1.5 1.5 0 0 1 2.3-1.9L9 15"/></svg></div>
        <b>3. Click to learn more</b><p>Click any circle to see which problems it has and why.</p></div>
    </div>
    <div class="lbl" style="margin-top:18px">The 5 problems we check</div>
    <div class="wprobs">${PROBLEMS.map(pr => `<div ${tipA(PLAIN[pr.id])}>${ICON[pr.id]}<span>${pr.short}</span></div>`).join("")}</div>
    <div class="wbtns"><button class="btn" id="wTour">${ICON.play}Take the 1-minute tour</button><button class="btn main" id="wGo">Start exploring</button></div>
  </div>`;
  w.classList.add("open");
  const close = () => { w.classList.remove("open"); try { localStorage.setItem(SEEN, "1"); } catch (e) {} };
  $("#wClose").onclick = close; $("#wGo").onclick = close;
  $("#wTour").onclick = () => { close(); go("map"); setTimeout(() => tourStep(0), 250); };
  w.onclick = e => { if (e.target === w) close(); };
  $("#wGo").focus();
}
$("#helpBtn").onclick = showWelcome;
let welcomed = false;
function maybeWelcome() {
  if (welcomed) return; welcomed = true;
  let seen = false; try { seen = !!localStorage.getItem(SEEN); } catch (e) {}
  // skip it when someone arrives with places already highlighted or a place already open
  if (!seen) setTimeout(() => { if (page === "map" && tourAt < 0 && !M.spot && !$("#side").classList.contains("open")) showWelcome(); }, 400);
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && $("#welcome").classList.contains("open")) $("#wClose").click(); });

/* ========================= insights ========================= */
const MB = { x: WX(128.7), y: WY(-10.7), w: WX(138.3) - WX(128.7), h: WY(-26.2) - WY(-10.7) };
const pathD = polys => polys.map(poly => poly.map(r => { let d = "M"; for (let i = 0; i < r.length; i += 2) d += (i ? "L" : "") + r[i].toFixed(3) + " " + r[i + 1].toFixed(3); return d + "Z"; }).join("")).join("");
const NT_D = pathD(GEO.nt);
function miniMap(ring_, maxH) {
  return `<svg class="chart" viewBox="${MB.x} ${MB.y} ${MB.w} ${MB.h}" style="max-height:${maxH || 320}px">
    <path d="${NT_D}" fill="#F7F7F3" stroke="#B9C0BB" stroke-width="1" vector-effect="non-scaling-stroke"/>
    ${PLACES.slice().sort((a, b) => a._n - b._n).map(p => `<circle class="pt" cx="${WX(p.LONGITUDE).toFixed(3)}" cy="${WY(p.LATITUDE).toFixed(3)}" r="${(0.08 + p._n * 0.032).toFixed(3)}"
      fill="${colourFor(p._n)}" stroke="#fff" stroke-width="1" vector-effect="non-scaling-stroke" data-pick="${p._i}" ${tipA(placeTip(p))}/>`).join("")}
    ${ring_.map(p => `<circle cx="${WX(p.LONGITUDE).toFixed(3)}" cy="${WY(p.LATITUDE).toFixed(3)}" r="0.36" fill="none" stroke="#16191B" stroke-width="1.6" vector-effect="non-scaling-stroke" pointer-events="none"/>`).join("")}</svg>`;
}
function dotsPlot() {
  const L0 = Math.log10(0.05), L1 = Math.log10(300), pos = v => (Math.log10(clamp(v || 0.05, 0.05, 300)) - L0) / (L1 - L0) * 100;
  const rows = ["COMMUNITY", "VILLAGE", "HIGHWAY", "TOURISM"].map(t => { const g = PLACES.filter(p => p["SITE TYPE"] === t); return { t, g, med: median(g.map(p => p.Nearest_Site_km)) }; });
  return `<div class="viz dots-plot">${rows.map(r => `<div class="row"><span class="small"><b>${TYPES_PL[r.t]}</b><br><span class="faint">${r.g.length} · median ${r.med < 1 ? r.med.toFixed(2) : r.med.toFixed(1)} km</span></span>
      <div class="area">${r.g.map((p, k) => `<span class="dot" style="left:${pos(p.Nearest_Site_km)}%;top:${18 + ((k * 0.618) % 1) * 64}%;background:${colourFor(p._n)}" data-pick="${p._i}"
        ${tipA(`<b>${esc(p._name)}</b><br>Nearest tower ${kmText(p.Nearest_Site_km)}`)}></span>`).join("")}
        <span class="med" style="left:${pos(r.med)}%" ${tipA(`Median: ${r.med.toFixed(2)} km`)}></span></div></div>`).join("")}
    <div class="axis">${[0.1, 1, 10, 100].map(v => `<span style="left:${pos(v)}%">${v} km</span>`).join("")}</div>
    <p class="note">Each dot is a place; the dark line is the median. Log scale.</p></div>`;
}
function scatterPop() {
  const pts = PLACES.filter(p => p.POPULATION != null && p.POPULATION > 0);
  const W_ = 620, H_ = 300, l = 52, b = 34, t = 10, r = 12;
  const X = v => l + Math.log10(v) / 3.6 * (W_ - l - r), Y = v => t + (1 - (Math.log10(clamp(v, 0.03, 300)) + 1.5) / 4) * (H_ - t - b);
  const rho = spearman(pts.map(p => p.POPULATION), pts.map(p => p.Nearest_Site_km));
  return `<div class="viz"><svg class="chart" viewBox="0 0 ${W_} ${H_}">
    ${[0.1, 1, 10, 100].map(v => `<line x1="${l}" x2="${W_ - r}" y1="${Y(v)}" y2="${Y(v)}" stroke="#EEEFEA"/><text x="${l - 8}" y="${Y(v) + 4}" text-anchor="end">${v} km</text>`).join("")}
    ${[1, 10, 100, 1000].map(v => `<text x="${X(v)}" y="${H_ - 12}" text-anchor="middle">${v}</text>`).join("")}
    <text x="${W_ - r}" y="${H_ - 12}" text-anchor="end" style="font-size:10px">people →</text>
    ${pts.map(p => `<circle class="pt" cx="${X(p.POPULATION).toFixed(1)}" cy="${Y(p.Nearest_Site_km).toFixed(1)}" r="4.5" fill="${colourFor(p._n)}" stroke="#fff" data-pick="${p._i}"
      ${tipA(`<b>${esc(p._name)}</b><br>${p.POPULATION} people · nearest tower ${kmText(p.Nearest_Site_km)}`)}/>`).join("")}
    <text x="${W_ - r}" y="${t + 14}" text-anchor="end" style="font-size:12px;fill:#16191B">Bigger places are usually closer to a tower</text></svg>
    <p class="note">Each dot is a place with a known population. Left to right: more people. Bottom to top: further from a tower. (Rank correlation ρ = ${rho.toFixed(2)}.)</p></div>`;
}
function slopeChart() {
  const Q = [["Closest 25% in 2018", "Closest quarter"], ["2nd", "2nd quarter"], ["3rd", "3rd quarter"], ["Furthest 25% in 2018", "Furthest quarter"]];
  const d = Q.map(([k, n], i) => { const g = PLACES.filter(p => p.Need_2018 === k); return { n, a: median(g.map(p => p.Telstra_nearest_2018_km)), b: median(g.map(p => p.Telstra_nearest_2025_km)), c: ["#1E8A5A", "#8FB9A4", "#DB8F42", "#86361C"][i] }; });
  const W_ = 460, H_ = 260, Y = v => 16 + (1 - (Math.log10(clamp(v, 0.1, 100)) + 1) / 3) * (H_ - 44), xa = 170, xb = 340;
  const f = v => v < 1 ? v.toFixed(1) : v.toFixed(1).replace(/\.0$/, "");
  return `<div class="viz"><svg class="chart" viewBox="0 0 ${W_} ${H_}" style="max-width:500px">
    ${[0.1, 1, 10, 100].map(v => `<line x1="${xa}" x2="${xb}" y1="${Y(v)}" y2="${Y(v)}" stroke="#F0F1EC"/><text x="${W_ - 4}" y="${Y(v) + 4}" text-anchor="end" style="font-size:10px">${v} km</text>`).join("")}
    <text x="${xa}" y="${H_ - 6}" text-anchor="middle" style="fill:#16191B;font-size:12px">2018</text><text x="${xb}" y="${H_ - 6}" text-anchor="middle" style="fill:#16191B;font-size:12px">2025</text>
    ${d.map(q => `<g ${tipA(`<b>${q.n}</b> of places by 2018 distance<br>Median nearest tower: ${f(q.a)} km → ${f(q.b)} km`)}>
      <line x1="${xa}" y1="${Y(q.a)}" x2="${xb}" y2="${Y(q.b)}" stroke="${q.c}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${xa}" cy="${Y(q.a)}" r="5.5" fill="${q.c}"/><circle cx="${xb}" cy="${Y(q.b)}" r="5.5" fill="${q.c}"/>
      <text x="${xa - 10}" y="${Y(q.a) + 4}" text-anchor="end" style="fill:${q.c};font-size:11.5px">${q.n} · ${f(q.a)} km</text>
      <text x="${xb + 9}" y="${Y(q.b) + 4}" style="fill:${q.c};font-size:11px">${f(q.b)}</text></g>`).join("")}</svg>
    <p class="note">Median distance to the nearest Telstra tower, grouped by how far places were in 2018 (log scale).</p></div>`;
}
function dumbbell() {
  const rs = Object.values(REG).sort((a, b) => (b.homes - b.land) - (a.homes - a.land));
  return `<div class="viz dumb">${rs.map(r => `<div class="row" data-region="${esc(r.name)}" ${tipA(`<b>${esc(r.name)}</b><br>Homes with 4G: ${r.homes}%<br>Land with 4G: ${r.land}%`)}>
      <span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.name)}</span>
      <div class="area"><span class="ln" style="left:${Math.min(r.land, r.homes)}%;width:${Math.abs(r.homes - r.land)}%"></span>
        <span class="pt" style="left:${r.land}%;background:#8FB3C9"></span><span class="pt" style="left:${r.homes}%;background:#2A6F97"></span></div></div>`).join("")}
    <div class="legend"><span><i style="background:#2A6F97;border-radius:50%"></i>Homes with 4G</span><span><i style="background:#8FB3C9;border-radius:50%"></i>Land with 4G</span><span>0–100% · click a region</span></div></div>`;
}
function probDistRow(list, label) {
  return `<div style="display:grid;grid-template-columns:120px 1fr;gap:10px;align-items:center;margin:7px 0"><span class="small">${label} <span class="faint">(${list.length})</span></span>
    ${stackRow([0, 1, 2, 3, 4].map(n => ({ v: list.filter(p => p._n === n).length, color: PCOL[n], ink: inkOn(n), label: `${label}, ${n} problems` })))}</div>`;
}

/* weights explorer (sensitivity of the gap score) */
const PRESETS = [["Our weights", [35, 25, 20, 20]], ["Towers first", [50, 20, 10, 20]], ["Mobile first", [25, 45, 15, 15]], ["Home internet first", [25, 20, 15, 40]], ["Equal", [25, 25, 25, 25]]];
let wNow = PRESETS[0][1].slice();
const top20 = score => PLACES.map((p, i) => i).sort((a, b) => score[b] - score[a] || a - b).slice(0, 20);
const BASE_SCORE = PLACES.map(p => p._score), BASE_TOP20 = top20(BASE_SCORE);
function renderWeights() {
  const tot = sum(wNow, x => x) || 1;
  const sc = PLACES.map(p => PARTS.reduce((s, pt, k) => s + p[pt.key] * wNow[k] / tot, 0));
  const rho = spearman(BASE_SCORE, sc), t20 = top20(sc), kept = t20.filter(i => BASE_TOP20.includes(i)).length;
  $("#wOut").innerHTML = `
    <div style="display:flex;gap:28px;margin:10px 0 14px;flex-wrap:wrap">
      <div><div style="font:700 30px var(--display)">${rho.toFixed(2)}</div><div class="small soft">rank agreement with our weights<br>(1.00 = same order)</div></div>
      <div><div style="font:700 30px var(--display)">${kept} <span style="font-size:18px" class="soft">of 20</span></div><div class="small soft">top-20 places stay<br>in the top 20</div></div></div>
    <div class="rank" style="grid-template-columns:1fr 1fr">${t20.map((i, k) => { const b = BASE_TOP20.indexOf(i);
      return `<div class="r ${b < 0 ? "new" : ""}" data-pick="${i}" ${tipA(placeTip(PLACES[i]))}><span class="mono faint">${k + 1}</span><span>${esc(PLACES[i]._name)}</span>
        <span class="mv" style="color:${b < 0 ? "#2A6F97" : b > k ? "#1E8A5A" : b < k ? "#B3521F" : "#8C9397"}">${b < 0 ? "new" : b === k ? "=" : (b > k ? "▲" : "▼") + Math.abs(b - k)}</span></div>`; }).join("")}</div>`;
  $$("#wPresets button").forEach(b => b.setAttribute("aria-pressed", PRESETS[+b.dataset.w][1].every((v, k) => v === wNow[k])));
}
function weightsHtml() {
  return `<div class="viz in"><div class="chips" id="wPresets" style="margin-bottom:12px">${PRESETS.map(([n], k) => `<button class="chip" data-w="${k}">${n}</button>`).join("")}</div>
    ${PARTS.map((pt, k) => `<div class="sl"><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:${pt.col};margin-right:6px"></i>${pt.short}</span>
      <input type="range" min="0" max="60" step="5" value="${wNow[k]}" data-wk="${k}" aria-label="Weight for ${pt.name}"><span class="mono small" id="wv${k}">${wNow[k]}%</span></div>`).join("")}
    <div id="wOut"></div></div>`;
}
function bindWeights() {
  $$("[data-wk]").forEach(inp => inp.oninput = () => { wNow[+inp.dataset.wk] = +inp.value; $("#wv" + inp.dataset.wk).textContent = inp.value + "%"; renderWeights(); });
  $$("#wPresets button").forEach(b => b.onclick = () => { wNow = PRESETS[+b.dataset.w][1].slice(); $$("[data-wk]").forEach((inp, k) => { inp.value = wNow[k]; $("#wv" + k).textContent = wNow[k] + "%"; }); renderWeights(); });
  renderWeights();
}

/* your priorities */
const prioOn = new Set([0, 1, 2, 3, 4]);
const BASE_TOP15 = ORDER.slice(0, 15).map(p => p._i);
function renderPrio() {
  const act = PROBLEMS.map((_, k) => prioOn.has(k)), nOn = prioOn.size;
  const score = p => p._probs.filter((v, k) => v && act[k]).length;
  const top = PLACES.slice().sort((a, b) => score(b) - score(a) || (b.Nearest_Site_km || 0) - (a.Nearest_Site_km || 0)).slice(0, 15);
  const newOnes = top.filter(p => !BASE_TOP15.includes(p._i)).length;
  $("#prioOut").innerHTML = !nOn ? `<p class="soft">Tick at least one problem.</p>` : `
    <p class="small soft" style="margin-bottom:10px">${nOn === 5 ? "All five problems count." : newOnes ? `<b style="color:#2A6F97">${newOnes} of these 15</b> were not in the list when all five problems counted.` : "Same 15 places as when all five problems count."}</p>
    <div class="rank">${top.map((p, k) => `<div class="r ${BASE_TOP15.includes(p._i) ? "" : "new"}" data-pick="${p._i}" style="grid-template-columns:24px 1fr auto 52px"><span class="mono faint">${k + 1}</span><span>${esc(p._name)}</span>${strip(p)}<span class="mv">${score(p)} of ${nOn}</span></div>`).join("")}</div>`;
}
function prioHtml() {
  return `<div class="viz in"><div class="chips" style="margin-bottom:14px">${PROBLEMS.map((pr, k) => `<button class="chip" data-pk="${k}" aria-pressed="true">${pr.short}</button>`).join("")}</div><div id="prioOut"></div></div>`;
}
function bindPrio() {
  $$("[data-pk]").forEach(b => b.onclick = () => { const k = +b.dataset.pk; if (prioOn.has(k)) prioOn.delete(k); else prioOn.add(k); b.setAttribute("aria-pressed", prioOn.has(k)); renderPrio(); });
  renderPrio();
}

function buildInsights() {
  const homes = sum(PLACES, p => p.SA2_4G_premises_indicator) / 188, land = sum(PLACES, p => p.SA2_4G_area_indicator) / 188;
  const cOne = S.clinics.filter(p => p._probs[1]).length, sOne = S.schools.filter(p => p._probs[1]).length;
  const typeMed = t => median(PLACES.filter(p => p["SITE TYPE"] === t).map(p => p.Nearest_Site_km));
  const quarters = ["Closest 25% in 2018", "2nd", "3rd", "Furthest 25% in 2018"].map((k, i) => { const g = PLACES.filter(p => p.Need_2018 === k);
    return { n: ["Closest in 2018", "2nd", "3rd", "Furthest in 2018"][i], got: g.filter(p => p.New_Telstra_sites_25km > 0).length / g.length * 100 }; });
  const mapBtn = (key, label) => `<button class="btn sm" data-spot="${key}">${smallIcon("map")}${label || "Show on map"}</button>`;
  // clearest example of the homes-versus-land gap: a region with little land covered but most homes covered
  const ex = Object.values(REG).filter(r => r.land < 10).sort((a, b) => (b.homes - b.land) - (a.homes - a.land))[0];
  const worstCyc = S.oneLink.slice(0, 8), cycMax = Math.max(...worstCyc.map(p => p.Cyclones_100km_30yr));
  // the eight main findings: one number, one sentence, one reason it matters, one chart
  const F = [
    { id: "where", c: "#D23B2E", big: `${S.worst.length} places`, short: `${S.worst.length} places have ${MAXN} of the 5 problems, all in the Top End`,
      title: `have ${MAXN} of the 5 problems, all in the Top End`,
      why: "They are on islands and remote coast, far from towers and exposed to storms.",
      acts: mapBtn("worst"),
      viz: `<div class="viz">${miniMap(S.worst, 300)}</div><p class="note">Every place on one map. Circled: the ${S.worst.length} hardest to connect.</p>` },
    { id: "roads", c: "#2A6F97", big: `${Math.round(homes)}% vs ${Math.round(land)}%`, short: "Phone signal reaches homes, but not the roads between them",
      title: "Phone signal reaches homes, but not the roads between them",
      why: "A breakdown or crash between towns often means no way to call for help.",
      explain: `<div class="kf-explain"><div class="lbl" style="margin-top:0">What the two numbers mean</div>
        <p><b>${Math.round(homes)}%</b> — on average, about ${Math.round(homes / 10)} in every 10 <b>homes and buildings</b> in these regions have 4G mobile signal.</p>
        <p><b>${Math.round(land)}%</b> — but only about ${Math.round(land)} in every 100 square kilometres of <b>land</b> has 4G.</p>
        <p><b>Why so different?</b> Towers are built in towns, where the homes are. Their signal reaches a few kilometres, so the long roads and country between towns are left out.</p>
        <p><b>Example:</b> in the ${esc(ex.name)} region, ${ex.homes}% of homes have 4G, but only ${ex.land}% of the land does.</p>
        <p class="faint small">Source: official 4G coverage figures for each ABS region, averaged over the regions our 188 places are in.</p></div>`,
      acts: mapBtn("lowLand", "Places with little signal on the land"),
      viz: `<div class="viz rings" style="justify-content:center;gap:40px">${ring(homes, "#2A6F97", 140, null, "of <b>homes</b> have 4G")}${ring(land, "#8FB3C9", 140, null, "of the <b>land</b> has 4G")}</div>` },
    { id: "services", c: "#EB7A2E", big: `${S.both.length} places`, short: `${S.both.length} places where the school and the clinic both struggle to connect`,
      title: "where the school and the health clinic both face 3 or more problems",
      why: "Online classes, telehealth and clinic records all depend on this connection.",
      acts: mapBtn("both"),
      viz: `<p class="vt">Share relying on just one phone company</p>${hbars([
        { label: "Health clinics", value: cOne, max: S.clinics.length, color: "#DC2626", text: `${cOne} of ${S.clinics.length}` },
        { label: "Schools", value: sOne, max: S.schools.length, color: "#2563EB", text: `${sOne} of ${S.schools.length}` }], 120)}
        <p class="note">If that one network goes down, the school and clinic lose phone and internet together.</p>` },
    { id: "link", c: "#C2410C", big: `${S.oneLink.length} communities`, short: `${S.oneLink.length} communities rely on one radio link in cyclone country`,
      title: "rely on a single radio link where cyclones pass often",
      why: "One storm-damaged link cuts phones, internet, EFTPOS and telehealth all at once.",
      acts: mapBtn("oneLink"),
      viz: `<p class="vt">Cyclones within 100 km since 1995 (the 8 most exposed)</p>${hbars(worstCyc.map(p => ({ label: esc(p._name), value: p.Cyclones_100km_30yr, max: cycMax,
        color: "#7B4FC9", text: p.Cyclones_100km_30yr, attr: `data-pick="${p._i}"`, tip: placeTip(p) })), 120)}` },
    { id: "towers", c: "#1D6FB8", big: `+${TOWERS.new.length} towers`, short: `New towers since 2018 went mostly to the right places, but ${S.waiting.length} are still waiting`,
      title: `since 2018 went mostly to the places that needed them, but ${S.waiting.length} are still waiting`,
      why: "The places furthest from a tower gained the most. A few far-away places were missed.",
      acts: `<button class="btn sm main" data-act="towers">${ICON.play}Watch it on the map</button>` + mapBtn("waiting", `The ${S.waiting.length} still waiting`),
      viz: `<p class="vt">Places that got a new tower within 25 km, grouped by how far they were in 2018</p>${hbars(quarters.map((q, i) => ({ label: q.n, value: q.got, max: 100,
        color: i === 3 ? "#1D6FB8" : "#9DC0E0", text: Math.round(q.got) + "%" })), 120)}` },
    { id: "served", c: "#B3521F", big: `${typeMed("COMMUNITY").toFixed(1)} km vs ${typeMed("HIGHWAY").toFixed(1)} km`, short: "Communities are further from a tower than roadhouses and tourist stops",
      title: "Communities are further from a tower than roadhouses and tourist stops",
      why: "The places where people live are served worse than places people pass through.",
      viz: `<p class="vt">Typical distance to the nearest phone tower</p>${hbars(["COMMUNITY", "VILLAGE", "TOURISM", "HIGHWAY"].map(t => { const m = typeMed(t);
        return { label: TYPES_PL[t], value: m, max: typeMed("COMMUNITY"), color: t === "COMMUNITY" ? "#B3521F" : "#E4B08C", text: (m < 1 ? m.toFixed(2) : m.toFixed(1)) + " km" }; }), 130)}` },
    { id: "sat", c: "#2A6F97", big: `${S.satHomes.length} of 188`, short: `${S.satHomes.length} of 188 places depend on satellite for home internet`,
      title: "places are in regions where satellite is the only home internet",
      why: "Satellite helps homes and clinics, but it does not bring mobile signal to the roads.",
      acts: mapBtn("satHomes"),
      viz: `<div class="viz rings" style="justify-content:center">${ring(S.satHomes.length / 188 * 100, "#2A6F97", 140, null, "of places rely on satellite for home internet")}</div>` },
    { id: "kinds", c: "#6B5CA5", big: "5 kinds of place", short: "The places fall into 5 kinds, each needing a different fix",
      title: "each needing a different fix",
      why: "A computer grouped the places by their problems, with no labels. Click a kind to see it on the map.",
      viz: `<div class="viz kf-kinds">${GROUPS.map(([g, c], k) => { const m = PLACES.filter(p => p.Group === g);
        return `<button data-act="group:${k}"><span class="sw" style="background:${c}"></span><span><b>${g}</b> <span class="faint">· ${m.length} places</span><span class="fx">${esc(m[0].Group_fix)}</span></span></button>`; }).join("")}</div>` }
  ];
  const card = (o, i) => `<section class="isec kf" id="s-${o.id}" style="--c:${o.c}">
    <div><div class="kf-no">${i + 1}</div><div class="bign">${o.big}</div><h2>${o.title}</h2>
      <p class="lead"><b>Why it matters:</b> ${o.why}</p>${o.explain || ""}<div class="acts">${o.acts || ""}</div></div>
    <div>${o.viz}</div></section>`;
  const trust = [
    ["0.92 – 0.98", "Our ranking holds up", "Changing the weights of the gap score barely changes which places come first."],
    ["52% vs 83%", "Coverage maps measure differently", "Telstra's and Optus's own maps use different methods, so we never rely on one map alone."],
    [`${S.unsure.length} places`, "Need a local check", "Where our data sources disagree, we say so, and suggest asking the community first."]];
  const root = $("#p-insights");
  root.innerHTML = `<div class="wrap">
    <h1 class="pagetitle">Key findings</h1>
    <p class="pagesub">Eight things our analysis of 188 remote places shows. Each one has a number, a sentence and one chart. Click <b>Show on map</b> to see the places.</p>
    <div class="kf-glance"><div class="lbl" style="margin-top:0">At a glance</div>
      <ol>${F.map(o => `<li><button data-jump="${o.id}"><b style="color:${o.c}">${o.big}</b><span>${o.short}</span><span class="go">→</span></button></li>`).join("")}</ol></div>
    ${F.map(card).join("")}
    <h2 class="h2s">Can you trust these findings?</h2>
    <div class="kf-trust">${trust.map(([n, t, d]) => `<div><b>${n}</b><h3>${t}</h3><p>${d}</p></div>`).join("")}</div>
    <details class="box kf-try"><summary>Try it yourself: change the weights or the problems that count</summary>
      <div class="twocol" style="margin-top:16px;align-items:start">
        <div><h3>Gap score weights</h3><p class="small soft" style="margin:4px 0 12px">Move the sliders and see whether the top 20 changes.</p>${weightsHtml()}</div>
        <div><h3>Your priorities</h3><p class="small soft" style="margin:4px 0 12px">Untick problems that matter less to you and watch the top 15 change.</p>${prioHtml()}</div>
      </div></details>
    <p class="note" style="margin-top:18px">Methods, sources and statistical tests are on the <button class="link" data-go="about" style="font-size:inherit">About</button> page.</p></div>`;
  $$("[data-jump]", root).forEach(b => b.onclick = () => $("#s-" + b.dataset.jump).scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" }));
  bindWeights(); bindPrio();
}

/* ========================= actions ========================= */
function buildActions() {
  const oneLinkClinic = S.oneLink.filter(p => p.Clinic_name).sort(byPop);
  const homes = sum(PLACES, p => p.SA2_4G_premises_indicator) / 188, land = sum(PLACES, p => p.SA2_4G_area_indicator) / 188;
  const secondPeople = sum(S.second, p => p.POPULATION || 0), farPeople = sum(S.far, p => p.POPULATION || 0);
  const round = n => n >= 1000 ? (Math.round(n / 500) * 500).toLocaleString() : n;
  const GROUND = [["OneWeb", "Darwin"], ["Starlink", "Darwin and Tennant Creek"], ["Amazon Kuiper", "Katherine and near Alice Springs"]];
  const recs = {
    gov: [
      { act: `Put the ${S.waiting.length} places still waiting at the front of the next funding round`, n: S.waiting.length, fig: "places far from a tower in 2018 with no new one nearby", spot: "waiting",
        why: `Since 2018, new towers went mostly to places that were far from service. These ${S.waiting.length} were among the furthest in 2018 and still have no new tower within 25 km. They include ${S.waiting.slice(0, 2).map(p => p._name).join(" and ")}, which have more connection problems than anywhere else.` },
      { act: `Give the ${S.oneLink.length} communities on a single radio link in cyclone country a second way to connect`, n: oneLinkClinic.length, of: S.oneLink.length, fig: `of these ${S.oneLink.length} have a health clinic`, spot: "oneLink",
        why: `One storm-damaged link cuts off phones, internet, telehealth and school at the same time. Start with the ${oneLinkClinic.length} that have a health clinic: ${oneLinkClinic.slice(0, 4).map(p => p._name).join(", ")} and others. A second radio path, a fibre link or a satellite backup would all remove the single point of failure.` },
      { act: "Fund signal along the roads, not only in towns", n: `${Math.round(land)}%`, pct: land, fig: `of the land has 4G, against ${Math.round(homes)}% of homes`, spot: "lowLand",
        why: `4G reaches ${Math.round(homes)}% of homes in these regions but only ${Math.round(land)}% of the land. People driving between communities are out of reach for most of the trip. Coverage targets that count land as well as homes would change where towers go.` },
      { act: `Check locally before spending in the ${S.unsure.length} places where the data disagrees`, n: S.unsure.length, fig: "places where the data sources disagree", spot: "unsure",
        why: "In these places our sources point different ways. Money spent on the wrong fix is money not spent elsewhere. A short visit or a call, recorded with the field form in each place report, would settle what the data can't." }],
    industry: [
      { act: "Add a second network where a tower already stands", n: S.second.length, fig: "places with a tower nearby but only one company", spot: "second",
        why: `${S.second.length} places are within 10 km of a tower but have only one phone company within 50 km. Sharing an existing tower costs far less than building a new one, and would give these places a backup when one network goes down. Between them they hold about ${round(secondPeople)} recorded people, ${S.second.filter(p => p.Schools).length} places with a school and ${S.second.filter(p => p.Clinic_name).length} with a health clinic.` },
      { act: "Use satellite where towers won't reach", n: S.far.length, fig: `places more than 10 km from a tower, about ${farPeople} people`, spot: "far",
        why: `The ${S.far.length} places more than 10 km from a tower hold only about ${farPeople} recorded people, and almost no schools or clinics. A new tower for each would reach very few people. Low-orbit satellite is the realistic option, and all three companies already have licensed ground stations in the NT: ${GROUND.map(g => g[0] + " in " + g[1]).join("; ")}.` }],
    community: [
      { act: "Record what service is really like, before decisions are made", n: S.sc.length, fig: "places with a school or a clinic to gather notes", spot: "sc",
        why: "Public data shows towers and coverage maps, not what people experience. Every place report has a short form that works with no internet and keeps the notes on the device. Schools and clinics are the natural places to collect them." },
      { act: "Work through the health services communities already run", n: S.cc.length, of: S.clinics.length, fig: `of ${S.clinics.length} clinics are community controlled`, spot: "cc",
        why: `${S.cc.length} of the ${S.clinics.length} clinics we matched are run by Aboriginal community controlled health services. They are trusted locally and already depend on the connection for telehealth, which makes them the right partners for any plan in these places.` },
      { act: "Keep control of your own information", n: "CARE", fig: "principles for Indigenous data governance", spot: null,
        why: "Any records a community gives should stay theirs: they decide who sees them, how they are used, and that they are used for the community's benefit. This follows the CARE principles: collective benefit, authority to control, responsibility and ethics." }]
  };
  const AUD = [["gov", "Governments", "deciding where funding goes"], ["industry", "Phone and internet companies", "deciding where to build and share"], ["community", "Communities, schools and clinics", "the people who live with the result"]];
  let at = "gov";
  const render = () => {
    const a = AUD.find(x => x[0] === at);
    $("#actions").innerHTML = `<h1 class="pagetitle">What should happen next</h1><p class="pagesub">Nine practical steps, based on what we found. First pick who you are, then read the steps for you.</p>
      <div class="seg" style="max-width:660px;margin-bottom:10px">${AUD.map(x => `<button data-a="${x[0]}" aria-pressed="${x[0] === at}">${x[1]}</button>`).join("")}</div>
      <p class="small soft" style="margin-bottom:18px">For ${a[1].toLowerCase()}, ${a[2]}.</p>
      <div class="alist">${recs[at].map(r => { const share = typeof r.n === "number" ? r.n / (r.of || 188) * 100 : r.pct;
        return `<div class="acard"><div class="fig"><b>${r.n}</b><span>${r.fig}</span>${share != null ? `<div class="mini" ${tipA(`${Math.round(share)}% of ${r.of ? r.of : "all 188 places"}`)}><i style="width:${share}%"></i></div>` : ""}</div>
          <div><h3>${r.act}</h3><p>${r.why.split(/(?<=\.)\s/)[0]}</p><details><summary>Why</summary><p style="margin-top:6px">${r.why}</p></details></div>
          <div>${r.spot ? `<button class="btn" data-spot="${r.spot}">${smallIcon("map")}Show on map</button>` : ""}</div></div>`; }).join("")}</div>
      <p class="note" style="margin-top:18px">People counts use recorded population only, so they are lower than the true totals.</p>`;
    $$("#actions [data-a]").forEach(b => b.onclick = () => { at = b.dataset.a; render(); });
  };
  render();
}

/* ========================= places ========================= */
let sortKey = "_n", sortDir = -1, cq = "", placesView = "places";
const COLS = [["_name", "Place"], ["_n", "Problems"], ["Nearest_Site_km", "Nearest tower"], ["Operators_within_50km", "Phone companies"], ["POPULATION", "People"], ["Schools", "School"], ["Clinic_name", "Clinic"]];
function buildPlaces() {
  $("#places").innerHTML = `<h1 class="pagetitle">All places</h1><p class="pagesub">Every place in one list. Click a column name to sort by it. Click a row to open that place's full report, which you can print.</p>
    <div class="iconkey">${PROBLEMS.map(pr => `<span ${tipA(PLAIN[pr.id])}><i>${smallIcon(pr.id, 14)}</i>${pr.short}</span>`).join("")}<span class="faint">Coloured icon = the place has that problem</span></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
      <div class="seg" style="width:260px"><button data-v="places" aria-pressed="true">All 188 places</button><button data-v="regions" aria-pressed="false">By region</button></div>
      <input class="search" id="cq" placeholder="Find a place or region" style="max-width:280px"></div>
    <div id="pv"></div>`;
  $$("#places [data-v]").forEach(b => b.onclick = () => { placesView = b.dataset.v; $$("#places [data-v]").forEach(x => x.setAttribute("aria-pressed", x === b)); $("#cq").style.display = placesView === "places" ? "" : "none"; fillPlaces(); });
  $("#cq").oninput = e => { cq = e.target.value.toLowerCase(); fillPlaces(); };
  fillPlaces();
}
function fillPlaces() {
  const box = $("#pv");
  if (placesView === "regions") {
    const rows = Object.values(REG).sort((a, b) => b.avg - a.avg);
    box.innerHTML = `<p class="small soft" style="margin-bottom:10px">Share of each region's places with each problem. Click a region to open it on the map.</p>
      <div class="tablebox" style="padding:8px"><table class="heat"><tr><th>Region</th><th>Places</th><th>Problems each</th>${PROBLEMS.map(pr => `<th ${tipA(PLAIN[pr.id])}>${smallIcon(pr.id, 16)}<br>${pr.short}</th>`).join("")}</tr>
      ${rows.map(r => `<tr><td class="nm" data-region="${esc(r.name)}">${esc(r.name)}</td><td>${r.n}</td><td style="background:${rampColour(r.avg)};color:${r.avg > 2.2 ? "#fff" : "#16191B"}">${r.avg.toFixed(1)}</td>
        ${PROBLEMS.map((pr, k) => { const s = r.places.filter(p => p._probs[k]).length / r.n; return `<td style="background:${rgbCss(rampRgb(s * 4), .9)};color:${s > .55 ? "#fff" : "#16191B"}">${Math.round(s * 100)}%</td>`; }).join("")}</tr>`).join("")}</table></div>`;
    return;
  }
  const rows = PLACES.filter(p => !cq || p._name.toLowerCase().includes(cq) || (p.SA2_Name || "").toLowerCase().includes(cq));
  rows.sort((a, b) => { const x = a[sortKey], y = b[sortKey];
    if (x == null && y == null) return byNeed(a, b); if (x == null) return 1; if (y == null) return -1;
    return sortDir * (typeof x === "string" ? x.localeCompare(y) : x - y) || byNeed(a, b); });
  const L = v => clamp(Math.log10((v || 0.05) / 0.05) / Math.log10(300 / 0.05) * 100, 2, 100);
  box.innerHTML = `<div class="tablebox"><table class="list"><thead><tr>${COLS.map(c => `<th data-k="${c[0]}" class="${c[0] === sortKey ? "on" : ""}">${c[1]}${c[0] === sortKey ? (sortDir < 0 ? " ↓" : " ↑") : ""}</th>`).join("")}</tr></thead><tbody>
    ${rows.map(p => `<tr class="row" data-report="${p._i}"><td><b>${esc(p._name)}</b><div class="small soft">${p._type} · ${esc(p.SA2_Name || "")}</div></td>
      <td style="white-space:nowrap"><span class="pill" style="background:${colourFor(p._n)};color:${inkOn(p._n)};margin-right:8px">${p._n}</span>${strip(p)}</td>
      <td><div class="kmbar"><span class="track"><span class="fill" style="width:${L(p.Nearest_Site_km)}%"></span></span><span class="small">${kmText(p.Nearest_Site_km)}</span></div></td>
      <td>${p.Operators_within_50km}</td><td>${p.POPULATION == null ? '<span class="faint">unknown</span>' : p.POPULATION}</td>
      <td>${p.Schools ? "Yes" : '<span class="faint">–</span>'}</td><td>${p.Clinic_name ? "Yes" : '<span class="faint">–</span>'}</td></tr>`).join("")}</tbody></table></div>
    <p class="note">${rows.length} places. Coloured icons are the problems each place has. The tower bar is longer when the tower is further away.</p>`;
  $$("#pv th").forEach(th => th.onclick = () => { sortDir = sortKey === th.dataset.k ? -sortDir : th.dataset.k === "_name" ? 1 : -1; sortKey = th.dataset.k; fillPlaces(); });
}

/* ========================= about ========================= */
function buildAbout() {
  const src = [
    ["Phone towers", "Every Telstra, Optus and TPG tower in 2018 and 2025, and Telstra's 2024 letter about its coverage maps.", "ACCC", "https://data.gov.au/data/dataset/accc-mobile-infrastructure-report-data-release"],
    ["Remote places and network links", "The list of remote NT places, and whether each connects by fibre cable or radio link.", "NT Government", "https://data.nt.gov.au/dataset/list-of-remote-communities-with-mobile-coverage"],
    ["Mobile and internet coverage", "How much of each region's homes and land has 4G, and how many homes rely on satellite internet.", "Regional coverage indicators", null],
    ["Radio licences", "Every licensed transmitter, used to check tower details and satellite ground stations.", "ACMA", "https://www.acma.gov.au/radiocomms-licence-data"],
    ["Schools", "Every school in the NT, matched to places by name.", "NT Government, Department of Education", "https://data.nt.gov.au/dataset/school-list"],
    ["Health clinics", "Every remote health clinic, with operator and hours, matched to places by name.", "NT Government, Remote health services", "https://nt.gov.au/wellbeing/remote-health/remote-health-services"],
    ["Digital inclusion surveys", "Resident survey scores and research on how Starlink is used.", "Australian Digital Inclusion Index; Mapping the Digital Gap", "https://digitalinclusionindex.org.au/case-study-mapping-the-digital-gap-digital-inclusion-in-remote-first-nations-communities/"],
    ["Community Wi-Fi programs", "Communities receiving free Wi-Fi, much of it by satellite.", "Department of Infrastructure", "https://www.infrastructure.gov.au/media-communications/first-nations-digital-inclusion"],
    ["Cyclone tracks", "The path of every cyclone since 1995.", "Bureau of Meteorology", "https://www.bom.gov.au/cyclone/tropical-cyclone-knowledge-centre/databases/"],
    ["Regions and boundaries", "The map regions that link everything together.", "ABS", "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3"]];
  const step = (n, t, d) => `<div class="acd" style="flex:1;min-width:190px"><div class="mono small" style="color:var(--accent)">${n}</div><h3>${t}</h3><p class="soft">${d}</p></div>`;
  $("#about").innerHTML = `<h1 class="pagetitle">How it works</h1><p class="pagesub">Public government data only. No personal or household information.</p>
    <h2 class="h2s" style="margin-top:0">Words used on this site</h2>
    <div class="agrid" style="margin-bottom:26px">${[["tower", "tower"], ["company", "company"], ["land", "land"], ["link", "link"], ["cyclone", "cyclone"], ["sliders", "gap"], ["map", "kind"], ["layers", "region"], ["sat", "sat"]]
      .map(([ic, k]) => `<div class="acd gl">${smallIcon(ic, 22)}<div><h3>${WORDS[k][0]}</h3><p class="soft">${WORDS[k][1]}</p></div></div>`).join("")}</div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:stretch">${step("01", "10 public datasets", "Towers, coverage, radio links, cyclones, schools, clinics, surveys and regions.")}
      ${step("02", "Joined to 188 places", "Distances, counts and regional figures for every remote place.")}
      ${step("03", "5 yes/no checks", "Each place is checked for the same five problems. We count the yeses.")}
      ${step("04", "Map, charts, actions", "Findings are tested with statistics and turned into steps for decision makers.")}</div>
    <h2 class="h2s">Where the data comes from</h2>
    <div class="agrid">${src.map(s => `<div class="acd"><h3>${s[0]}</h3><p class="soft">${s[1]}</p><p class="faint small" style="margin-top:4px">${s[2]}</p>${s[3] ? `<a href="${s[3]}" target="_blank" rel="noopener">View the source ↗</a>` : ""}</div>`).join("")}</div>
    <div class="twocol" style="margin-top:30px">
      <div class="box"><h3 style="margin-bottom:8px">What it cannot tell you</h3><p class="soft small">It does not measure the actual signal anyone gets; hills, trees, buildings and busy networks all matter. Coverage figures describe whole regions, so several places share them. The network link list dates from 2019, and some radio links may have been upgraded since. No public data counts Starlink users by place, so none is estimated.</p></div>
      <div class="box"><h3 style="margin-bottom:8px">Respect and fairness</h3><p class="soft small">Places are described by the problems they face, never as "bad" places. The list is a starting point for talking with communities, not a verdict. We follow the CARE principles for Indigenous data. Field notes stay on the device that collected them until a person chooses to export them. Staff names and contacts in the school list were removed.</p></div></div>
    <details class="box" style="margin-top:16px"><summary style="cursor:pointer;font-weight:600">For analysts: the weighted model and the tests</summary>
      <h3 style="margin:16px 0 8px;font-size:15px">Weighted model (gap score)</h3>
      <table class="facts"><tr><td>Infrastructure</td><td>0.4 distance to nearest site + 0.3 fewer sites within 25 km + 0.3 fewer operators within 50 km</td></tr>
        <tr><td>Mobile</td><td>0.4 low 4G share of premises + 0.6 low 4G share of land</td></tr><tr><td>5G</td><td>0.4 low 5G share of premises + 0.6 low 5G share of land</td></tr>
        <tr><td>Broadband</td><td>0.4 low fixed line + 0.3 low fixed wireless + 0.3 high satellite-only</td></tr><tr><td>Overall</td><td>0.35 infrastructure + 0.25 mobile + 0.20 5G + 0.20 broadband</td></tr></table>
      <h3 style="margin:18px 0 8px;font-size:15px">Does the ranking depend on the weights?</h3>
      <table class="facts"><tr><td><b>Alternative weights</b></td><td><b>Rank correlation · top 20 kept</b></td></tr>
        <tr><td>Infrastructure first (50/20/10/20)</td><td>0.95 · 18 of 20</td></tr><tr><td>Mobile first (25/45/15/15)</td><td>0.92 · 15 of 20</td></tr>
        <tr><td>Broadband first (25/20/15/40)</td><td>0.98 · 19 of 20</td></tr><tr><td>Equal weights (25/25/25/25)</td><td>0.97 · 17 of 20</td></tr></table>
      <p class="small soft" style="margin-top:8px">Try any weights yourself in Insights → Gap score.</p>
      <h3 style="margin:18px 0 8px;font-size:15px">Other methods and tests</h3>
      <table class="facts"><tr><td>Distances and buffers</td><td>Australian Albers (EPSG:3577); nearest-neighbour search with k-d trees</td></tr>
        <tr><td>New towers 2018 to 2025</td><td>A 2025 site with no 2018 site within 1 km; NT sites only</td></tr>
        <tr><td>Investment went to need</td><td>2018 distance against improvement, Spearman ρ = 0.79</td></tr>
        <tr><td>Community size and distance</td><td>Spearman ρ = −0.62, p &lt; 0.001</td></tr>
        <tr><td>Place type</td><td>Kruskal–Wallis on scores by place type, p = 0.0008</td></tr>
        <tr><td>Cyclone exposure</td><td>Distinct storms within 100 km since 1995, BoM tracks</td></tr>
        <tr><td>Schools and clinics</td><td>Matched by name and known alternative names, every match checked by hand</td></tr>
        <tr><td>Kinds of place</td><td>k-means, k = 5, silhouette 0.33, stability (ARI, 20 bootstrap refits) 0.84</td></tr>
        <tr><td>Region check</td><td>All 188 places fall in an SA1 whose parent SA2 matches the one assigned</td></tr></table>
      <p class="small soft" style="margin-top:10px">All figures are reproduced by analysis_figures.py from the submitted data files.</p></details>
    <p class="note" style="margin-top:24px">We acknowledge the Traditional Owners of the lands and seas of the Northern Territory, and pay our respects to Elders past and present. Most of the places in this work are Aboriginal communities.
      Based on Australian Communications and Media Authority information. Contains ACCC, NT Government and Bureau of Meteorology data used under their licence terms, and ABS boundaries under CC BY 4.0. Typefaces under the SIL Open Font Licence.</p>`;
}

/* ========================= place report ========================= */
let current = null;
function openReport(i) {
  current = i;
  buildReport(i);
  $("#report").classList.add("open"); $("#report").scrollTop = 0;
}
function closeReport() { $("#report").classList.remove("open"); }
$("#closeReport").onclick = closeReport;
$("#report").addEventListener("click", e => { if (e.target.id === "report") closeReport(); });
function buildReport(i) {
  const p = PLACES[i];
  $("#repHead").innerHTML = `<div class="noprint" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 44px 14px 0">
      <select id="placePick" style="max-width:300px" aria-label="Choose a place">${ORDER.map(x => `<option value="${x._i}" ${x._i === i ? "selected" : ""}>${esc(x._name)} (${x._n} of 5)</option>`).join("")}</select>
      <button class="btn main" id="printBtn">Print or save PDF</button><button class="btn" id="dlBtn">Download</button><button class="btn" data-pick="${i}">Show on map</button>
      <span class="small soft" id="printMsg"></span></div>
    <div class="small soft">Place report · ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</div>
    <h1 style="font-size:32px;margin:2px 0 4px">${esc(p._name)}</h1>
    <p class="soft">${p._type} in the ${esc(p.SA2_Name || "")} region${p.POPULATION != null ? `, about ${p.POPULATION} people` : ""}.</p>`;
  const counts = [0, 1, 2, 3, 4].map(n => PLACES.filter(x => x._n === n).length);
  $("#repBody").innerHTML = `<div class="rgrid">
    <div class="box"><div class="pp-top">${probDonut(p, 100)}<div><div style="font:650 18px var(--display)">${p._n} of 5 connection problems</div><div class="small soft">Ranked ${p._rank} of 188</div></div></div>
      ${PROBLEMS.map((pr, k) => pcheck(p, k, pr.text)).join("")}
      <div class="lbl">Compared with the other 187 places</div>
      ${vcols(counts.map((c, n) => ({ v: c, top: c, color: n === p._n ? "#B3521F" : "#DADCD5", tip: `${c} places with ${n} problems` })), 110, ["0", "1", "2", "3", "4 problems"])}</div>
    <div class="box"><div class="lbl" style="margin-top:0">Gap score <span><b style="color:var(--ink);font-size:18px">${Math.round(p._score)}</b> / 100 · bigger than ${p._pct}% of places</span></div>
      ${partsViz(p)}
      <p class="mono small faint" style="margin-top:8px">${PARTS.map(pt => `${Math.round(p[pt.key])}×${Math.round(pt.w * 100)}%`).join(" + ")} = ${Math.round(p._score)}</p>
      <div class="lbl">What is here</div>
      <table class="facts"><tr><td>Nearest phone tower</td><td>${kmText(p.Nearest_Site_km)}</td></tr><tr><td>Towers within 25 km</td><td>${p.Sites_within_25km}</td></tr>
        <tr><td>Phone companies within 50 km</td><td>${p.Operators_within_50km}</td></tr><tr><td>Network link</td><td>${p.Backhaul === "Microwave radio" ? "Radio link" : p.Backhaul === "Optic fibre" ? "Fibre cable" : "Unknown"}</td></tr>
        <tr><td>Homes in region with only satellite internet</td><td>${p.SA2_NBN_satellite_premises_indicator}%</td></tr>
        <tr><td>Schools</td><td>${p.Schools ? esc(p.School_names) : "None listed"}</td></tr><tr><td>Health clinic</td><td>${p.Clinic_name ? esc(clinicLine(p)) : "None listed"}</td></tr></table>
      ${p.Telstra_nearest_2018_km != null ? `<div class="lbl">Nearest Telstra tower, 2018 → 2025</div>${sinceViz(p)}<p class="small soft" style="margin-top:6px">${sinceHtml(p)}</p>` : ""}
      ${p.Group ? `<div class="nb" style="border-left:4px solid ${groupColour(p.Group)}"><b>Kind of place: ${esc(p.Group)}.</b> ${esc(p.Group_fix)}</div>` : ""}
      ${p.Tower_via_satellite || p.Community_WiFi || p.ADII_2023_score != null ? `<div class="nb"><b>Satellite and other options.</b> ${[p.Tower_via_satellite ? "The nearest mobile tower connects to the network by satellite." : "",
        p.Community_WiFi ? (/Active/.test(p.Community_WiFi) ? "Free community Wi-Fi runs here, delivered by NBN satellite." : "Free community Wi-Fi has been funded here, due by June 2027.") : "",
        p.ADII_2023_score != null ? `Resident survey (2023): digital inclusion ${Number(p.ADII_2023_score).toFixed(1)} of 100, against 73.4 for non-First Nations Australians.` : ""].join(" ")}</div>` : ""}
      <div class="lbl">How sure are we?</div><span class="tag" style="background:${p._sure.bg};color:${p._sure.col};font-weight:600">${p._sure.label}</span>
      <p class="small soft" style="margin-top:6px">${p._sure.why}${p._unknown.length ? ` We don't know ${p._unknown.join(", or ")}.` : ""} This report uses public data about towers and coverage, not measured signal.</p></div></div>
    <div class="noprint" id="fieldForm" style="margin-top:16px"></div>`;
  $$("#repBody .viz").forEach(v => v.classList.add("in"));
  $("#placePick").onchange = e => { current = +e.target.value; buildReport(current); };
  $("#printBtn").onclick = printPlace; $("#dlBtn").onclick = downloadPlace;
  buildForm(p);
}
function reportHtml(autoPrint) {
  const body = document.createElement("div");
  body.appendChild($("#repHead").cloneNode(true)); body.appendChild($("#repBody").cloneNode(true));
  $$(".noprint", body).forEach(n => n.remove());
  const css = $$("style").map(s => s.textContent).join("\n");
  const p = PLACES[current];
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(p._name)}, connectivity report</title>
    <style>${css} body{display:block;overflow:visible;height:auto;background:#fff;padding:26px 30px;max-width:980px;margin:0 auto}.fill,.vcols .col{transform:none!important}@page{margin:14mm}</style></head>
    <body>${body.innerHTML}<p class="note">RemoteConnect NT. Based on Australian Communications and Media Authority information, with ACCC, NT Government, Bureau of Meteorology and ABS data. This file works without internet.</p>
    ${autoPrint ? "<script>window.onload=function(){setTimeout(function(){try{window.print()}catch(e){}},300)}<\/script>" : ""}</body></html>`;
}
function downloadPlace() {
  const p = PLACES[current], msg = $("#printMsg");
  try {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([reportHtml(false)], { type: "text/html" }));
    a.download = p._name.replace(/[^A-Za-z0-9]+/g, "_") + "_connectivity_report.html";
    document.body.appendChild(a); a.click(); a.remove();
    msg.textContent = "Saved as a single file that opens without internet.";
  } catch (e) { msg.textContent = "Downloads are blocked here. Open the saved tool file directly to download."; }
}
function printPlace() {
  const msg = $("#printMsg");
  try { const w = window.open("", "_blank"); if (!w) throw 0; w.document.open(); w.document.write(reportHtml(true)); w.document.close(); msg.textContent = ""; return; } catch (e) {}
  msg.textContent = "Printing is blocked here. Press Ctrl+P, or open the saved file directly.";
}

/* field notes: saved on the device, works with no connection */
const STORE = "rcnt_field_notes";
function loadNotes() { try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { return []; } }
function saveNotes(a) { try { localStorage.setItem(STORE, JSON.stringify(a)); return true; } catch (e) { return false; } }
const ASK = [["signal", "Does mobile signal work here today?", ["Most of the time", "Sometimes", "Hardly ever", "Didn't check"]],
  ["outage", "Longest time without service that people remember", ["Never lost", "A few hours", "A few days", "More than a week", "Didn't check"]]];
function buildForm(p) {
  const all = loadNotes(), mine = all.filter(r => r.id === p.Location_ID), host = $("#fieldForm");
  host.innerHTML = `<div class="box"><h3 style="font-size:18px">Tell us what it's really like</h3>
    <p class="soft small" style="margin:4px 0 8px">Public data can't show what people actually experience. Notes save on this device only and work with no internet. Nothing is sent anywhere unless you export it.</p>
    ${ASK.map(q => `<p style="margin:12px 0 6px;font-weight:600;font-size:14px">${q[1]}</p><div>${q[2].map((o, k) => `<label class="opt"><input type="radio" name="f_${q[0]}" value="${esc(o)}" ${k === q[2].length - 1 ? "checked" : ""}>${o}</label>`).join("")}</div>`).join("")}
    <p style="margin:12px 0 6px;font-weight:600;font-size:14px">Anything else, such as where the signal drops out</p>
    <textarea id="fNote" rows="3" placeholder="For example: no signal inside the clinic, drops out every afternoon"></textarea>
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:10px"><input type="text" id="fWho" placeholder="Your initials or role" style="max-width:220px">
      <label class="small" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="fOk"> The community agreed to share this</label></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:12px"><button class="btn main" id="fSave">Save on this device</button>
      <button class="btn" id="fExport">Export all notes (${all.length})</button><span class="small soft" id="fMsg"></span></div>
    ${mine.length ? `<div class="lbl">Already recorded here</div>${mine.map(r => `<div class="nb"><b>${new Date(r.when).toLocaleDateString("en-AU")}</b>: signal ${esc(r.signal.toLowerCase())}, longest outage ${esc(r.outage.toLowerCase())}. ${r.note ? esc(r.note) : ""}</div>`).join("")}` : ""}
    <div id="fOut"></div></div>`;
  $("#fSave").onclick = () => {
    const val = n => (host.querySelector(`input[name="f_${n}"]:checked`) || {}).value || "Didn't check";
    const a = loadNotes();
    a.push({ id: p.Location_ID, place: p._name, when: new Date().toISOString(), signal: val("signal"), outage: val("outage"), note: $("#fNote").value.trim(),
      by: $("#fWho").value.trim(), agreed: $("#fOk").checked ? "yes" : "not stated", problems_found: p._n });
    const ok = saveNotes(a);
    $("#fMsg").textContent = ok ? "Saved on this device." : "This browser won't let us save. Try opening the file directly.";
    if (ok) setTimeout(() => buildForm(p), 900);
  };
  $("#fExport").onclick = () => {
    const a = loadNotes();
    if (!a.length) { $("#fMsg").textContent = "No notes saved yet."; return; }
    const cols = ["id", "place", "when", "signal", "outage", "note", "by", "agreed", "problems_found"];
    const csv = [cols.join(",")].concat(a.map(r => cols.map(c => `"${String(r[c] == null ? "" : r[c]).replace(/"/g, '""')}"`).join(","))).join("\n");
    $("#fOut").innerHTML = `<p class="small soft" style="margin-top:12px">${a.length} note${a.length === 1 ? "" : "s"}. Use the download, or copy the text.</p>
      <p><a id="fDl" download="field_notes.csv" style="color:var(--accent)">Download the notes</a></p><textarea readonly rows="5" style="font-family:var(--mono);font-size:12.5px">${esc(csv)}</textarea>`;
    try { $("#fDl").href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); } catch (e) { $("#fDl").remove(); }
  };
}

/* ========================= offline notice ========================= */
function toast(text) {
  $$(".toast").forEach(x => x.remove());
  const t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); t.textContent = text;
  document.body.appendChild(t); setTimeout(() => t.remove(), 4200);
}
window.addEventListener("offline", () => toast("Connection lost. Everything here still works, including the map and reports."));
window.addEventListener("online", () => toast("Back online. Nothing needed reloading."));



/* ========================= why these five problems matter (short version) ========================= */
function buildWhy() {
  const pick = n => { const p = PLACES.find(x => x["SITE NAME"] === n); return p ? p._i : null; };
  const cnt = PROBLEMS.map(pr => PLACES.filter(pr.test).length);
  // one sentence on what it means for people, and one real example
  const ROWS = [
    { means: "Signal is weak or missing, so calls drop and phones may not work indoors.",
      label: "Across Australia", ex: "About <b>43% of First Nations communities and homelands</b> have no mobile service at all.",
      src: ["https://www.rmit.edu.au/news/all-news/2023/sep/mapping-digital-gap", "RMIT"] },
    { means: "If that one network breaks, there is no backup, not even for Triple Zero.",
      label: "Real example", place: "WADEYE", ex: "<span class=\"place\">Wadeye, 2026.</span> Its only provider went down after floods. About 2,000 people lost phones and internet for weeks.",
      src: ["https://www.abc.net.au/news/2026-04-07/nt-community-wadeye-experiences-weeks-of-rolling-telstra-outages/106535008", "ABC News"] },
    { means: "After a crash or breakdown on the road, there may be no way to call for help.",
      label: "Real example", ex: "The NT has <b>Australia's highest road death rate</b>: 12.7 per 100,000 people, about twice the next state.",
      src: ["https://datahub.roadsafety.gov.au/reporting/monthly-road-deaths", "Road Safety data hub"] },
    { means: "One damaged link cuts phones, internet, EFTPOS and telehealth all at once.",
      label: "Real example", place: "KINTORE", ex: "<span class=\"place\">Kintore, 2026.</span> Six days cut off, with trouble calling Triple Zero and buying fuel.",
      src: ["https://www.abc.net.au/news/2026-03-27/telstra-outage-in-kintore-nt-impacting-power-fuel-and-triple0/106499742", "ABC News"] },
    { means: "Storms knock out towers and power, and flooded roads keep repair crews out for days.",
      label: "Real example", place: "BORROLOOLA", ex: "<span class=\"place\">Borroloola, 2024.</span> Towers went down after ex-Cyclone Megan. The area could only be reached by helicopter.",
      src: ["https://aapnews.aap.com.au/news/phone-towers-down-as-ex-tropical-cyclone-heads-west", "AAP"] }
  ];
  $("#why").innerHTML = `
    <div class="ov-kick">Why it matters</div>
    <h1 class="wy-h">Why these five problems matter</h1>
    <p class="wy-lead">Each problem is more than a number on a map. Each one has already cut people off in the Northern Territory.</p>

    <div class="wy-band">
      <h2>Out here, the phone is often the only connection</h2>
      <div class="wy-nums">
        <div><b>75%</b><span>of people in remote First Nations communities use only a mobile. Nationally it's 10.5%.</span></div>
        <div><b>94%</b><span>of mobile users there are on prepaid. No credit means no connection.</span></div>
        <div><b>53%</b><span>sometimes go without food or bills to stay connected.</span></div>
      </div>
    </div>

    <div class="wy-rows">${PROBLEMS.map((pr, k) => { const r = ROWS[k], pi = r.place ? pick(r.place) : null; return `
      <div class="wy-row">
        <div class="wy-name"><span class="pic">${ICON[pr.id]}</span><h3>${esc(pr.short)}</h3>
          <span class="cnt"><b>${cnt[k]}</b> of our 188 places</span></div>
        <div><div class="wy-lbl">What it means for people</div><p class="wy-txt">${r.means}</p>
          <div class="wy-go"><button class="btn" data-spot="prob${k}">${smallIcon("map", 15)}See the ${cnt[k]} places</button></div></div>
        <div class="wy-ex"><div class="wy-lbl">${r.label}</div><p class="wy-txt">${r.ex}</p>
          <div class="wy-go">${pi != null ? `<button class="link" data-pick="${pi}">Show ${esc(PLACES[pi]._name)} on the map</button>` : ""}
            <a href="${r.src[0]}" target="_blank" rel="noopener">Source: ${r.src[1]} ↗</a></div></div>
      </div>`; }).join("")}</div>

    <div class="wy-end">
      <p>Every one of these can be measured for all 188 places, has caused real harm, and points to a clear fix.</p>
      <button class="btn main" data-go="actions">See what should happen next</button>
    </div>
    <details class="wy-src"><summary>All sources</summary><ul>
      <li><a href="https://www.telstra.com.au/connected/first-nations/understanding-digital-inclusion-in-remote-first-nations-communities" target="_blank" rel="noopener">Mapping the Digital Gap, 2023 findings</a> (the three numbers above)</li>
      ${ROWS.map((r, k) => `<li>${esc(PROBLEMS[k].short)}: <a href="${r.src[0]}" target="_blank" rel="noopener">${r.src[1]}</a></li>`).join("")}
    </ul></details>`;
}

/* ========================= overview: the front door ========================= */
function buildHome() {
  const pct = n => Math.round(n / PLACES.length * 100);
  const counts = PROBLEMS.map(pr => PLACES.filter(pr.test).length);
  const dist = [0, 1, 2, 3, 4].map(n => PLACES.filter(p => p._n === n).length);
  const homes = PLACES.reduce((a, p) => a + p.SA2_4G_premises_indicator, 0) / PLACES.length;
  const land = PLACES.reduce((a, p) => a + p.SA2_4G_area_indicator, 0) / PLACES.length;
  const WHY = {   // why each problem matters, in one line
    tower: "Signal fades with distance, so calls drop and data crawls.",
    company: "If that one network fails, there is no backup at all.",
    land: "Fine in town, but the roads between places have no way to call for help.",
    link: "One damaged link stops phones, internet, telehealth and school at once.",
    cyclone: "Storms knock out towers and links, often for days."
  };
  // small dot map of the Territory, drawn from the same shapes as the main map
  const bb = bboxOf(GEO.nt), pad = 0.25;
  const vb = `${bb[0] - pad} ${bb[1] - pad} ${bb[2] - bb[0] + 2 * pad} ${bb[3] - bb[1] + 2 * pad}`;
  const ntPath = GEO.nt.map(poly => poly.map(r => { let d = ""; for (let i = 0; i < r.length; i += 2) d += (i ? "L" : "M") + r[i].toFixed(3) + " " + r[i + 1].toFixed(3); return d + "Z"; }).join("")).join("");
  const dots = PLACES.slice().sort((a, b) => a._n - b._n).map(p =>
    `<circle cx="${WX(p.LONGITUDE).toFixed(3)}" cy="${WY(p.LATITUDE).toFixed(3)}" r="${(0.1 + p._n * 0.035).toFixed(3)}" fill="${colourFor(p._n)}" stroke="#fff" stroke-width="0.025"/>`).join("");

  $("#home").innerHTML = `
    <div class="ov-hero">
      <div>
        <div class="ov-kick">CDU IT Code Fair 2026 · Data Innovation Challenge</div>
        <h1 class="ov-h">Where is it hardest to stay connected in the Northern Territory?</h1>
        <p class="ov-lead">We checked <b>188 remote places</b> against <b>five plain problems</b>, using ten public datasets on phone towers,
          coverage, radio links, cyclones, schools and clinics. This site shows where the gaps are, why, and what to do about them.</p>
        <div class="ov-cta">
          <button class="btn main" data-go="map">${ICON.map}Open the map</button>
          <button class="btn" id="ovTour">${ICON.play}Take the 1-minute tour</button>
          <button class="btn" data-go="insights">See the key findings</button>
        </div>
      </div>
      <div class="ov-map" data-go="map" role="button" tabindex="0" aria-label="Open the map">
        <svg viewBox="${vb}" aria-hidden="true"><path d="${ntPath}" fill="#F6F6F2" stroke="#B9BDB6" stroke-width="0.03"/>${dots}</svg>
        <div class="cap"><span>Each dot is a place. Green: no problems. Red: four.</span><span style="color:var(--accent);font-weight:600">Open the map →</span></div>
      </div>
    </div>

    <div class="kpis">
      <div class="kpi" data-spot="worst"><b style="color:${PCOL[4]}">${S.worst.length}</b><span>places have ${MAXN} of the 5 problems, all in the Top End</span></div>
      <div class="kpi" data-spot="both"><b style="color:${PCOL[3]}">${S.both.length}</b><span>places where the school and the clinic both face 3 or more</span></div>
      <div class="kpi" data-spot="oneLink"><b style="color:var(--accent)">${S.oneLink.length}</b><span>communities rely on one radio link in cyclone country</span></div>
      <div class="kpi" data-spot="waiting"><b style="color:var(--info)">${S.waiting.length}</b><span>places far from a tower in 2018 still have no new one</span></div>
    </div>

    <div class="ov-sec">
      <h2>The five problems we found</h2>
      <p class="sub">Every place gets the same five yes-or-no checks. Nothing is weighted or blended: we simply count the yeses.
        Click a problem to see every place that has it, or <button class="link" data-go="why" style="padding:0;font-size:inherit">read why each one matters to people →</button></p>
      <div class="ov-probs">${PROBLEMS.map((pr, k) => `
        <button class="ov-prob" data-spot="prob${k}" aria-label="${esc(pr.short)}: ${counts[k]} places. Show them on the map">
          <span class="num">0${k + 1}</span>
          <span class="pic">${ICON[pr.id]}</span>
          <h3>${esc(pr.short)}</h3>
          <p>${esc(WHY[pr.id])}</p>
          <div class="count"><b>${counts[k]}</b> <span>of 188 places · ${pct(counts[k])}%</span>
            <div class="bar"><i style="width:${pct(counts[k])}%"></i></div></div>
          <span class="go">Show on the map →</span>
        </button>`).join("")}</div>
    </div>

    <div class="ov-sec">
      <h2>How the 188 places add up</h2>
      <p class="sub">Most places have one or two problems. A small group in the Top End has four. Click a colour to see those places.</p>
      <div class="ov-dist">${dist.map((c, n) => `<button data-spot="n${n}" style="flex:${c};background:${PCOL[n]};color:${inkOn(n)}" aria-label="${c} places with ${n} problems">${c}</button>`).join("")}</div>
      <div class="ov-dlab">${dist.map((c, n) => `<div><b><span class="ndot" style="background:${PCOL[n]};width:10px;height:10px;display:inline-block;border-radius:50%;margin-right:6px"></span>${NWORD[n]}</b>${n === 4 ? "4 problems" : NLABEL[n]} · ${c} places</div>`).join("")}</div>
    </div>

    <div class="ov-sec">
      <h2>Three things to remember</h2>
      <p class="sub">The findings judges, governments and communities most need to know.</p>
      <div class="ov-take">
        <button class="ov-t" data-spot="lowLand"><b>${Math.round(homes)}% vs ${Math.round(land)}%</b><h3>Signal reaches homes, not the roads</h3>
          <p>4G covers most homes in these regions, but only a small share of the land people drive through.</p></button>
        <button class="ov-t" data-spot="waiting"><b>${TOWERS.new.length} new towers</b><h3>Went mostly to the right places</h3>
          <p>Since 2018 the furthest places gained most, but ${S.waiting.length} of them are still waiting.</p></button>
        <button class="ov-t" data-go="actions"><b>9 steps</b><h3>What should happen next</h3>
          <p>Clear actions for governments, phone companies and communities, each linked to the places it is about.</p></button>
      </div>
    </div>

    <div class="ov-sec">
      <h2>How we did it</h2>
      <div class="ov-steps">
        <div class="ov-step"><div class="n">01</div><h3>10 public datasets</h3><p>Towers, coverage, radio links, cyclones, schools, clinics, surveys and regions.</p></div>
        <div class="ov-step"><div class="n">02</div><h3>Joined to 188 places</h3><p>Distances, counts and regional figures for every remote place.</p></div>
        <div class="ov-step"><div class="n">03</div><h3>Five yes-or-no checks</h3><p>Each place checked for the same five problems. We count the yeses.</p></div>
        <div class="ov-step"><div class="n">04</div><h3>Map, findings, actions</h3><p>Tested with statistics, then turned into steps for decision-makers.</p></div>
      </div>
      <p style="margin-top:14px"><button class="btn" data-go="about">How the numbers were made</button></p>
    </div>

    <div class="ov-ack">We acknowledge the <b>Traditional Owners</b> of the lands and seas of the Northern Territory, and pay our respects to Elders past and present.
      Most of the places in this work are Aboriginal communities. This site works without internet: save it once and it runs anywhere.</div>`;
  $("#ovTour").onclick = () => { go("map"); setTimeout(() => tourStep(0), 300); };
  $(".ov-map").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go("map"); } });
}

/* ========================= start ========================= */
buildLP();
buildTimeline();
buildInsights();
buildActions();
buildPlaces();
buildAbout();
buildHome();
buildWhy();
show((location.hash || "#home").slice(1));
