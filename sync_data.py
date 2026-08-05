"""Sync CSV -> data/programmes.json for the static site."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT.parent / "funds with KU support - v4.csv"
OUT = ROOT / "data" / "programmes.json"


def main() -> None:
    with SRC.open(encoding="utf-8-sig", newline="") as f:
        rows = [{k: (v or "").strip() for k, v in r.items()} for r in csv.DictReader(f, delimiter=";")]

    # PPT notes are internal only — omit from the public site payload.
    for row in rows:
        row.pop("PPT notes", None)

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
