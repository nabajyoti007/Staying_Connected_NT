"""
Satellite and alternative connectivity: small, cited reference tables used by enrich.py.
There is no public dataset of Starlink users by community, so nothing here estimates it.
"""
# Australian Digital Inclusion Index, "Case study: Mapping the Digital Gap" (2023 scores from resident surveys).
# https://digitalinclusionindex.org.au/case-study-mapping-the-digital-gap-digital-inclusion-in-remote-first-nations-communities/
ADII_2023 = {  # community: (index score, access score)
    "GALIWINKU": (46.0, 26.6),
    "WADEYE": (39.0, 28.6),
    "YUELAMU": (45.2, 29.4),
    "GANGAN": (39.0, 25.3),
    "TENNANT CREEK": (46.6, 29.2),
}
ADII_2023_NATIONAL_NON_FIRST_NATIONS = 73.4

# NBN Co Community Wi-Fi Program (Sky Muster Plus Premium satellite). All 23 communities activated.
# NT communities named in the Minister's release, 10 Dec 2024:
# https://minister.infrastructure.gov.au/rowland/media-release/free-public-wi-fi-remote-communities
WIFI_ACTIVE = ["AMPILATWATJA", "AREYONGA", "AREWERR", "GALIWINKU", "MUNGKARTA"]

# First Nations Community Wi-Fi Program: 37 NT communities funded (release 8 Apr 2026), due by 30 June 2027.
# Only communities named in public reporting are listed; the full list is on infrastructure.gov.au.
# https://ministers.pmc.gov.au/mccarthy/connecting-more-remote-first-nations-communities
WIFI_FUNDED = ["WURRUMIYANGA"]
