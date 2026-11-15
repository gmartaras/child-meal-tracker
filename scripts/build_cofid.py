#!/usr/bin/env python3
"""Convert the CoFID 2021 Excel workbook into the compact JSON the app loads.

Usage:  python3 scripts/build_cofid.py data-source/CoFID_2021.xlsx src/data/cofid.json

Value encoding per nutrient:  number = amount per 100 g,  "T" = trace,
"N" = present in significant quantity but not measured,  null = no value given.
"""
import json, re, sys, collections
import openpyxl

SRC, OUT = sys.argv[1], sys.argv[2]

# app nutrient id -> (sheet, CoFID column code)
COLS = [
    ("energy", "1.3 Proximates", "KCALS"), ("kj", "1.3 Proximates", "KJ"),
    ("protein", "1.3 Proximates", "PROT"), ("fat", "1.3 Proximates", "FAT"),
    ("satfat", "1.3 Proximates", "SATFOD"), ("mufa", "1.3 Proximates", "MONOFOD"),
    ("pufa", "1.3 Proximates", "POLYFOD"), ("n3", "1.3 Proximates", "TOTn3PFOD"),
    ("n6", "1.3 Proximates", "TOTn6PFOD"), ("trans", "1.3 Proximates", "FODTRANS"),
    ("chol", "1.3 Proximates", "CHOL"), ("carb", "1.3 Proximates", "CHO"),
    ("starch", "1.3 Proximates", "STAR"), ("sugars", "1.3 Proximates", "TOTSUG"),
    ("fibre_aoac", "1.3 Proximates", "AOACFIB"), ("fibre_nsp", "1.3 Proximates", "ENGFIB"),
    ("water", "1.3 Proximates", "WATER"),
    ("sodium", "1.4 Inorganics", "NA"), ("potassium", "1.4 Inorganics", "K"),
    ("calcium", "1.4 Inorganics", "CA"), ("magnesium", "1.4 Inorganics", "MG"),
    ("phosphorus", "1.4 Inorganics", "P"), ("iron", "1.4 Inorganics", "FE"),
    ("copper", "1.4 Inorganics", "CU"), ("zinc", "1.4 Inorganics", "ZN"),
    ("chloride", "1.4 Inorganics", "CL"), ("manganese", "1.4 Inorganics", "MN"),
    ("selenium", "1.4 Inorganics", "SE"), ("iodine", "1.4 Inorganics", "I"),
    ("retinol", "1.5 Vitamins", "RET"), ("carotene", "1.5 Vitamins", "CAREQU"),
    ("vita", "1.5 Vitamins", "RETEQU"), ("vitd", "1.5 Vitamins", "VITD"),
    ("vite", "1.5 Vitamins", "VITE"), ("vitk", "1.5 Vitamins", "VITK1"),
    ("thiamin", "1.5 Vitamins", "THIA"), ("riboflavin", "1.5 Vitamins", "RIBO"),
    ("niacin", "1.5 Vitamins", "NIAC"), ("tryp60", "1.5 Vitamins", "TRYP60"),
    ("niaceq", "1.5 Vitamins", "NIACEQU"), ("b6", "1.5 Vitamins", "VITB6"),
    ("b12", "1.5 Vitamins", "VITB12"), ("folate", "1.5 Vitamins", "FOLT"),
    ("panto", "1.5 Vitamins", "PANTO"), ("biotin", "1.5 Vitamins", "BIOT"),
    ("vitc", "1.5 Vitamins", "VITC"),
]

odd = collections.Counter()

def parse(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return None
    if isinstance(v, (int, float)):
        return round(float(v), 4)
    s = str(v).strip()
    if s == "":
        return None
    if s.lower() == "tr":
        return "T"
    if s.upper() == "N":
        return "N"
    m = re.fullmatch(r"[\(\[]?\s*(-?\d+(?:\.\d+)?)\s*[\)\]]?", s)  # bracketed = estimated value
    if m:
        return round(float(m.group(1)), 4)
    odd[s] += 1
    return None

def num(v):
    return 0.0 if v == "T" else v if isinstance(v, float) else None

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
sheets = {}
for name in {c[1] for c in COLS} | {"1.2 Factors"}:
    rows = list(wb[name].iter_rows(values_only=True))
    codes = [str(c).strip() if c is not None else "" for c in rows[1]]
    # Sheets are row-aligned (user guide); key by row position + name because the
    # source repeats food code 13-669 for two different foods.
    data = {}
    for r in rows[3:]:
        if r[0] is None or str(r[0]).strip() == "":
            continue
        data[(len(data), str(r[1]).strip())] = r
    sheets[name] = (codes, rows[0], data)

prox_codes, _, prox = sheets["1.3 Proximates"]
fac_head = [str(c).strip() if c else "" for c in sheets["1.2 Factors"][1]]
fac = sheets["1.2 Factors"][2]
i_edible, i_sg = fac_head.index("Edible proportion"), fac_head.index("Specific gravity")

foods = []
seen = set()
ids = [c[0] for c in COLS]
for key, r in prox.items():
    code = str(r[0]).strip()
    while code in seen:  # make duplicated source codes unique
        code += "b"
    seen.add(code)
    vals = []
    for nid, sheet, col in COLS:
        codes, _, data = sheets[sheet]
        row = data[key]  # KeyError here means the sheets are not aligned
        j = codes.index(col)
        vals.append(parse(row[j]) if row is not None and j < len(row) else None)
    d = dict(zip(ids, vals))
    # fill derived totals where CoFID leaves the total blank/N but gives both parts
    if not isinstance(d["niaceq"], float) and d["niaceq"] != "T":
        a, b = num(d["niacin"]), num(d["tryp60"])
        if a is not None and b is not None:
            d["niaceq"] = round(a + b, 4)
    if not isinstance(d["vita"], float) and d["vita"] != "T":
        a, b = num(d["retinol"]), num(d["carotene"])
        if a is not None and b is not None:
            d["vita"] = round(a + b / 6, 4)
    f = fac.get(key)
    sg = parse(f[i_sg]) if f else None
    ed = parse(f[i_edible]) if f else None
    foods.append([
        code, str(r[1]).strip(), str(r[3]).strip() if r[3] else "",
        sg if isinstance(sg, float) else None,
        ed if isinstance(ed, float) else None,
        [int(v) if isinstance(v, float) and v == int(v) else v for v in (d[i] for i in ids)],
    ])

foods.sort(key=lambda f: f[1].lower())
json.dump({"version": "CoFID 2021", "nutrients": ids, "foods": foods}, open(OUT, "w"),
          ensure_ascii=False, separators=(",", ":"))
print(f"{len(foods)} foods, {len(ids)} nutrients -> {OUT}")
print("unparsed values:", dict(odd.most_common(20)))
for i, nid in enumerate(ids):
    known = sum(1 for f in foods if isinstance(f[5][i], (int, float)) or f[5][i] == "T")
    print(f"  {nid:12s} known {known:5d}  ({100*known/len(foods):.0f}%)")
