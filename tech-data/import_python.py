"""FURNIX TECH DATA - Python reader for local technical JSON libraries.
No dependencies except Python 3.10+. Data are reference-only, not production-certified.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FILES = {
    "materials": "materials.json", "edging": "edgebands.json",
    "hardware": "hardware.json", "production": "manufacturing-profiles.json",
    "sources": "source-registry.json", "modules": "module-pack.json"
}

def load_library(name: str) -> dict:
    if name not in FILES:
        raise ValueError(f"Unsupported FURNIX library: {name}")
    data = json.loads((ROOT / FILES[name]).read_text(encoding="utf-8"))
    if data.get("version") != 1:
        raise ValueError("Unknown library format version")
    return data

def get_records(name: str) -> list[dict]:
    payload = load_library(name)
    return payload["templates"] if name == "modules" else payload["items"]

def production_ready(record: dict) -> bool:
    # Requires external verification / shop-floor signoff. Bundled records are all false.
    return record.get("manufacturingApproved") is True and record.get("reviewStatus") == "production_validated"

if __name__ == "__main__":
    for key in FILES:
        records = get_records(key)
        print(f"{key}: {len(records)} records")
    if any(production_ready(r) for key in ("materials", "edging", "hardware", "production") for r in get_records(key)):
        raise SystemExit("Unexpected manufacturing-approved record; inspect provenance")
    print("Manufacturing data not validated - do not send files for cutting or CNC")
