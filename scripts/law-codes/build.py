"""
Builds packages/shared/src/law-codes/data.json: which section of the new criminal laws replaced
which section of the old ones (BNS <- IPC, BNSS <- CrPC, BSA <- Indian Evidence Act).

Source: the correspondence tables prepared by the Central Academy for Police Training (CAPT),
Bhopal, published by Kerala Prisons:
  https://keralaprisons.gov.in/userfiles/act-and-rules/comparison_summary_BNS_to_IPC.pdf
  https://keralaprisons.gov.in/userfiles/act-and-rules/comparison_summary_BNSS_to_CrPC.pdf
  https://keralaprisons.gov.in/userfiles/act-and-rules/comparison_summary_BSA_to_IEA.pdf
Only the section numbers and headings (the Acts' own words) are kept; the tables' comparison
summaries are not copied.

Run (needs pdfplumber: pip install pdfplumber):
  python3 scripts/law-codes/build.py <folder with the three PDFs>
"""
import json, re, sys, pdfplumber

def clean(s): return re.sub(r"\s+", " ", (s or "").replace("\n", " ")).strip()

def extract(src, order):
    cols = order.split(",")
    rows = []
    pn = 0
    def take(cells):
        cells = [clean(c) for c in cells]
        while len(cells) < 4: cells.append("")
        d = dict(zip(cols, cells[:3]))
        first = d["new"]
        if first.lower().startswith(("bns", "bsa", "section", "subsecti", "ons")) or d.get("title", "").lower() == "subject": return
        if not first:
            if rows:
                rows[-1]["title"] = clean(rows[-1]["title"] + " " + d["title"])
                rows[-1]["old"] = clean(rows[-1]["old"] + " " + d["old"])
            return
        rows.append({"new": first, "title": d["title"], "old": d["old"], "page": pn + 1})
    with pdfplumber.open(src) as pdf:
        for pn, p in enumerate(pdf.pages):
            tables = p.find_tables()
            if not tables: continue
            t = tables[0]
            xs = sorted({round(c[0], 1) for c in t.cells} | {round(c[2], 1) for c in t.cells})
            # Rows above the first ruled line of the page are missed by the line finder: read them with the same columns.
            if t.bbox[1] > 60:
                inner = xs[1:-1]
                words = [w for w in p.crop((0, 40, p.width, t.bbox[1] + 1)).extract_words() if w["top"] < t.bbox[1]]
                lines = {}
                for w in words:
                    lines.setdefault(round(w["top"] / 3), []).append(w)
                merged = []
                for k in sorted(lines):
                    cells = [""] * (len(inner) + 1)
                    for w in sorted(lines[k], key=lambda w: w["x0"]):
                        i = sum(1 for b in inner if w["x0"] >= b - 1)
                        cells[i] = (cells[i] + " " + w["text"]).strip()
                    text = " ".join(cells)
                    if "©" in text or "CORRESPONDENCE" in text.upper() or "SANHITA" in text.upper() or "ADHINIYAM" in text.upper(): continue
                    if merged and not cells[0]: merged[-1] = [(a + " " + b).strip() for a, b in zip(merged[-1], cells)]
                    else: merged.append(cells)
                for r in merged: take(r)
            for tt in tables:
                raw = tt.extract()
                n = max(len(r) for r in raw)
                raw = [list(r) + [None] * (n - len(r)) for r in raw]
                if n == 1:
                    continue  # stray summary text boxes
                # Keep the columns that hold data in rows starting with a section; spacer and header-only columns go.
                data = [r for r in raw if clean(r[0])]
                keep = [i for i in range(n) if i == 0 or any(clean(r[i]) for r in data if not clean(r[0]).lower().startswith(("bns", "bsa", "section")))]
                for r in raw: take([r[i] for i in keep])

    return rows

NEWOK = re.compile(r"^(\d+[A-Z]?(\(\d+\))*(\([a-z]+\)|[a-z])*([/,&]\(\d+\))*|(First |Second )?[Pp]roviso to section \d+[A-Z]?|Explanation to section \d+[A-Z]?)$")
def nospace(s): return re.sub(r"\s+", "", s)
def fixwords(s):
    s = re.sub(r"\s+", " ", s).strip()
    for a, b in [("Explanati on", "Explanation"), ("Explanat ion", "Explanation"), ("sub- section", "sub-section"), ("Cross- examination", "Cross-examination"), ("T he", "The"), ("Interpret ation", "Interpretation")]:
        s = s.replace(a, b)
    return s
def expand(old):
    """Old section numbers named in a cell, with "230 to 232" spelled out. Sub-sections, clauses and paragraphs are dropped."""
    old = re.sub(r"\([^)]*\)", "", old)
    old = re.sub(r"(para|clause)[\s-]*\d+", "", old, flags=re.I)
    out = []
    for m in re.finditer(r"(\d+[A-Z]*)(?:\s*(?:to|-)\s*(\d+[A-Z]*))?", old):
        a, b = m.group(1), m.group(2)
        if b and a.isdigit() and b.isdigit() and 0 < int(b) - int(a) < 30: out += [str(i) for i in range(int(a), int(b) + 1)]
        else: out += [x for x in (a, b) if x]
    seen = []
    for x in out:
        if x not in seen: seen.append(x)
    return seen

def build(folder):
    result = {}
    for name, key, order in [("BNS_to_IPC", "bns", "new,title,old"), ("BNSS_to_CrPC", "bnss", "new,title,old"), ("BSA_to_IEA", "bsa", "new,old,title")]:
        raw = extract(f"{folder}/comparison_summary_{name}.pdf", order)
        rows, dropped = [], []
        for r in raw:
            new = fixwords(r["new"])
            compact = nospace(new) if re.match(r"^[\d&/,]", new) else new
            if re.match(r"^[&/,]\(", compact) and rows:
                rows[-1]["section"] += compact
                continue
            if not NEWOK.match(compact):
                dropped.append(new[:40])
                continue
            compact = re.sub(r"\)([a-z])$", r")(\1)", compact)
            old = fixwords(r["old"])
            isnew = old.lower() in ("", "-") or old.lower().startswith("new")
            if key == "bsa": old = re.sub(r"^IEA\s*", "", old)
            old = re.sub(r"\(\s*([a-z0-9]+)\s*\)", r"(\1)", old)
            rows.append({"section": compact, "title": fixwords(r["title"]), "old": None if isnew else old, "oldSections": [] if isnew else expand(old)})
        result[key] = rows
        print(f"{key}: {len(rows)} rows; dropped (not a section): {dropped}", file=sys.stderr)
    return result

if __name__ == "__main__":
    data = build(sys.argv[1])
    out = "packages/shared/src/law-codes/data.json"
    with open(out, "w") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print(f"wrote {out}", file=sys.stderr)
