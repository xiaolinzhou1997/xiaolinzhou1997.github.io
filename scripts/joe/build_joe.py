#!/usr/bin/env python3
"""Turn an AEA JOE listings export into the data file behind the /jobs/ map.

Usage:
    pip install -r scripts/joe/requirements.txt
    python scripts/joe/build_joe.py path/to/joe_resultset.xlsx

Writes static/data/joe-postings.json and prints any location it could only
place approximately. Fix those by adding an entry to scripts/joe/overrides.json.

Only basic fields are published (title, institution, location, deadline, JEL
codes); every posting links back to its JOE page for the full ad.
"""
import argparse
import datetime as dt
import json
import pathlib
import re
import statistics
import sys
import unicodedata
from collections import defaultdict

import geonamescache
import openpyxl

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "static" / "data" / "joe-postings.json"
OVERRIDES = pathlib.Path(__file__).with_name("overrides.json")
LISTING_URL = "https://www.aeaweb.org/joe/listing.php?JOE_ID={issue}_{id}"

# JOE country names that differ from GeoNames country names.
COUNTRY_ALIASES = {
    "UNITED STATES": "US",
    "KOREA, REPUBLIC OF": "KR",
    "MACAO": "MO",
    "MACAU": "MO",
    "TURKEY": "TR",
    "RUSSIA": "RU",
    "RUSSIAN FEDERATION": "RU",
    "VIET NAM": "VN",
    "CZECH REPUBLIC": "CZ",
    "IRAN, ISLAMIC REPUBLIC OF": "IR",
    "TAIWAN, PROVINCE OF CHINA": "TW",
    "UNITED KINGDOM": "GB",
}

GROUPS = {
    "academic-tt": "Academic: tenure-track or tenured",
    "academic-other": "Academic: visiting, temporary or adjunct",
    "nonacademic": "Nonacademic",
}


def norm(text):
    """Lowercase ASCII words: 'Montréal' -> 'montreal', 'Winston-Salem' -> 'winston salem'."""
    text = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    words = re.sub(r"[^a-z0-9]+", " ", text.lower()).split()
    return " ".join("st" if w == "saint" else w for w in words)


def group_of(section):
    if "Nonacademic" in section:
        return "nonacademic"
    if "Full-Time Academic" in section:
        return "academic-tt"
    return "academic-other"


def iso_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, (dt.date, dt.datetime)):
        return value.strftime("%Y-%m-%d")
    match = re.match(r"(\d{4}-\d{2}-\d{2})", str(value))
    return match.group(1) if match else None


class Gazetteer:
    def __init__(self):
        gc = geonamescache.GeonamesCache(min_city_population=500)
        self.countries = gc.get_countries()
        self.us_states = {norm(s["name"]): code for code, s in gc.get_us_states().items()}
        self.us_states["district of columbia"] = "DC"
        self.country_by_name = {}
        for iso, c in self.countries.items():
            name = c["name"].upper()
            self.country_by_name[name] = iso
            self.country_by_name[re.sub(r"^THE ", "", name)] = iso  # "The Netherlands"
        self.country_by_name.update(COUNTRY_ALIASES)
        # (country, normalized name) -> cities; official names and alternate names kept apart
        self.primary, self.alternate = defaultdict(list), defaultdict(list)
        coords = defaultdict(list)  # country or country/admin1 -> [(lat, lon)]
        for city in gc.get_cities().values():
            cc = city["countrycode"]
            name = norm(city["name"])
            self.primary[(cc, name)].append(city)
            for alt in {norm(n) for n in city.get("alternatenames", []) if n} - {name}:
                self.alternate[(cc, alt)].append(city)
            point = (city["latitude"], city["longitude"])
            coords[cc].append(point)
            coords[f"{cc}/{city['admin1code']}"].append(point)
        # Median of a region's towns: a stable "somewhere in X" point.
        self.centroids = {
            key: (statistics.median(p[0] for p in pts), statistics.median(p[1] for p in pts))
            for key, pts in coords.items()
        }

    def split_country(self, line):
        upper = line.upper()
        for name in sorted(self.country_by_name, key=len, reverse=True):
            if upper == name or upper.startswith(name + " "):
                return self.country_by_name[name], line[len(name):].strip()
        return None, line

    def best_city(self, cc, words, state=None):
        """Most populous city named by any run of words, official names before alternates.

        With a US state, only cities in that state count, except a big city named by the
        whole text (catches entries like "California New Orleans").
        """
        spans = [" ".join(words[i:j]) for i in range(len(words)) for j in range(i + 1, len(words) + 1)]
        spans = [s for s in spans if len(s) > 2]  # skip "dc", "ny", "c"
        whole = " ".join(words)
        for index in (self.primary, self.alternate):
            found = [c for span in spans for c in index.get((cc, span), [])
                     if not state or c["admin1code"] == state]
            if found:
                return max(found, key=lambda c: c["population"])
        if state:  # nothing in the stated state: trust a big city named by the whole text
            found = [c for c in self.primary.get((cc, whole), []) if c["population"] >= 100_000]
            if found:
                return max(found, key=lambda c: c["population"])
        return None

def place(line, gaz, overrides):
    """One JOE location line -> dict(lat, lon, label, precision) or None."""
    line = re.sub(r"\s+", " ", line).strip()
    if not line:
        return None
    if line in overrides:
        return dict(overrides[line], precision="city")
    cc, rest = gaz.split_country(line)
    if not cc:
        return None
    country = gaz.countries[cc]["name"]

    info = gaz.countries[cc]
    if not rest and (info.get("areakm2") or 1e9) < 5000:  # city-states: Singapore, Hong Kong, Macao
        lat, lon = gaz.centroids[cc]
        return dict(lat=lat, lon=lon, label=country, precision="city")
    if re.search(r"\bremote\b", rest, re.I):
        lat, lon = gaz.centroids[cc]
        return dict(lat=lat, lon=lon, label=f"Remote ({country})", precision="country")

    state = None
    words = norm(rest).split()
    if cc == "US":
        for k in range(len(words), 0, -1):
            code = gaz.us_states.get(" ".join(words[:k]))
            if code:
                state, words = code, words[k:]
                break

    city = gaz.best_city(cc, words, state) if words else None
    if city:
        region = city["admin1code"] if cc == "US" else country
        return dict(lat=city["latitude"], lon=city["longitude"],
                    label=f"{city['name']}, {region}", precision="city")
    if state and f"US/{state}" in gaz.centroids:
        lat, lon = gaz.centroids[f"US/{state}"]
        return dict(lat=lat, lon=lon, label=f"{state} (no city given)", precision="region")
    lat, lon = gaz.centroids[cc]
    return dict(lat=lat, lon=lon, label=f"{country} (no city given)", precision="country")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("export", type=pathlib.Path, help="JOE listings export (.xlsx)")
    parser.add_argument("-o", "--out", type=pathlib.Path, default=OUT)
    args = parser.parse_args()

    overrides = json.loads(OVERRIDES.read_text()) if OVERRIDES.exists() else {}
    overrides = {k: v for k, v in overrides.items() if not k.startswith("_")}
    gaz = Gazetteer()

    sheet = openpyxl.load_workbook(args.export, read_only=True).worksheets[0]
    rows = sheet.iter_rows(values_only=True)
    header = next(rows)
    postings, jel_names, approximate, issues = [], {}, defaultdict(int), set()
    for values in rows:
        r = dict(zip(header, values))
        if not r.get("jp_id"):
            continue
        jel = []
        for item in str(r.get("JEL_Classifications") or "").splitlines():
            code, _, name = item.partition(" - ")
            if code.strip():
                jel.append(code.strip())
                jel_names[code.strip()] = name.strip()
        locs = []
        for line in str(r.get("locations") or "").splitlines():
            loc = place(line, gaz, overrides)
            if loc is None or loc["precision"] != "city":
                approximate[line.strip()] += 1
            if loc:
                locs.append({k: round(v, 4) if isinstance(v, float) else v for k, v in loc.items()})
        issue = str(r["joe_issue_ID"])
        issues.add(issue)
        postings.append({
            "id": r["jp_id"],
            "url": LISTING_URL.format(issue=issue, id=r["jp_id"]),
            "title": (r.get("jp_title") or "").strip(),
            "institution": (r.get("jp_institution") or "").strip(),
            "unit": ", ".join(x.strip() for x in (r.get("jp_department"), r.get("jp_division")) if x),
            "section": r.get("jp_section") or "",
            "group": group_of(r.get("jp_section") or ""),
            "jel": sorted(set(jel)),
            "deadline": iso_date(r.get("Application_deadline")),
            "posted": iso_date(r.get("Date_Active")),
            "locations": locs,
        })

    data = {
        "source": "AEA Job Openings for Economists (JOE) listings export",
        "issues": sorted(issues),
        "generated": dt.date.today().isoformat(),
        "latest_posting": max((p["posted"] for p in postings if p["posted"]), default=None),
        "groups": GROUPS,
        "jel": dict(sorted(jel_names.items())),
        "postings": postings,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")

    placed = sum(1 for p in postings if p["locations"])
    print(f"Wrote {len(postings)} postings ({placed} with a location) to {args.out}")
    if approximate:
        print("\nPlaced at region/country level (add to overrides.json to pin a city):")
        for line, n in sorted(approximate.items()):
            print(f"  {n:3d}  {line!r}")


if __name__ == "__main__":
    sys.exit(main())
