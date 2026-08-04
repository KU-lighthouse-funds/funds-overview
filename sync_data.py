"""Sync CSV -> data/programmes.json for the static site."""
import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "funds with KU support - v2.csv"
OUT = ROOT / "data" / "programmes.json"

def main() -> None:
    with SRC.open(encoding="utf-8-sig", newline="") as f:
        rows = [{k: (v or "").strip() for k, v in r.items()} for r in csv.DictReader(f, delimiter=";")]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(rows)} programmes -> {OUT}")

if __name__ == "__main__":
    main()
