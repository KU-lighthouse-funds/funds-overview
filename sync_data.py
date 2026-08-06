"""Sync CSV -> data/programmes.json for the static site."""
import csv
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "funds with KU support - v4.csv"
OUT = ROOT / "data" / "programmes.json"

# Internal routing/source notes must stay in the repo CSV only (e.g. PPT notes column).
_PRIMARY_PER_PPT = re.compile(r"\s*\(primary per ppt joint list\)", re.I)
_PPT_PAREN = re.compile(r"\s*\([^)]*\bPPT\b[^)]*\)", re.I)
_PPT_CLAUSE = re.compile(r"\s*\.?\s*PPT lists under[^.]*\.?", re.I)
_PPT_SENTENCE = re.compile(
    r"\.\s*Not listed as a KU Preaward/Lighthouse-managed programme in the KU LH PPT[^.]*\.",
    re.I,
)


def sanitize_public_text(value: str) -> str:
    """Remove internal document references from fields exported to the site."""
    if not value:
        return value
    text = value.strip()
    text = _PRIMARY_PER_PPT.sub("", text)
    text = _PPT_PAREN.sub("", text)
    text = _PPT_CLAUSE.sub(".", text)
    text = _PPT_SENTENCE.sub(".", text)
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\.\s*\.", ".", text)
    text = re.sub(r"\s+\.", ".", text)
    return text.strip()


def main() -> None:
    with SRC.open(encoding="utf-8-sig", newline="") as f:
        rows = [{k: (v or "").strip() for k, v in r.items()} for r in csv.DictReader(f, delimiter=";")]

    for row in rows:
        row.pop("PPT notes", None)
        for key, value in list(row.items()):
            row[key] = sanitize_public_text(value)

    programmes_json = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
    version = hashlib.sha256(programmes_json.encode()).hexdigest()[:16]
    payload = {"version": version, "programmes": rows}

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {len(rows)} programmes (version {version}) -> {OUT}")


if __name__ == "__main__":
    main()
