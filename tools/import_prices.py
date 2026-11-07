"""Convert supplier price lists (xlsx) into FURNIX price catalog JSON files.

Usage:
    python tools/import_prices.py "<folder with xlsx price lists>" [--supplier KRONAS] [--currency UAH]

Expected sheet layout (KRONAS price lists, October 2026): a "Источник:" row followed by the
source URL, a header row starting with "Артикул" (article, name, price, unit), then group
title rows (only the name cell filled) and item rows. Rows without an article are skipped. Missing units and zero prices are kept as
missing values; nothing is guessed. Output: prices/index.json and prices/<supplier>/<n>.json.
"""
import argparse
import datetime
import json
import os
import re
import sys

import openpyxl

SCHEMA_VERSION = 1
BOARD_SIZE = re.compile(r"(\d{3,4})\s*[xх×]\s*(\d{3,4})\s*[xх×]\s*(\d{1,2}(?:[.,]\d+)?)", re.IGNORECASE)
EDGE_SIZE = re.compile(r"(\d{1,3}(?:[.,]\d+)?)\s*[xх×]\s*(\d{1,2}(?:[.,]\d+)?)", re.IGNORECASE)


def number(text):
    return float(str(text).replace(",", "."))


def clean(value):
    if value is None:
        return ""
    text = str(value).strip()
    return re.sub(r"\s+", " ", text)


def parse_price(value):
    if value is None or value == "":
        return None
    try:
        price = float(str(value).replace(" ", "").replace(",", "."))
    except ValueError:
        return None
    return price if price > 0 else None


def attributes(category, name):
    lowered = name.lower()
    if category.startswith("Плитные"):
        match = BOARD_SIZE.search(name)
        if match:
            first, second, thickness = number(match.group(1)), number(match.group(2)), number(match.group(3))
            return {"kind": "board", "sheetWidth": max(first, second), "sheetLength": min(first, second), "thickness": thickness}
    if category.startswith("Кромочные") and lowered.startswith("кромка"):
        match = EDGE_SIZE.search(name)
        if match:
            return {"kind": "edge", "width": number(match.group(1)), "thickness": number(match.group(2))}
    return None


def convert(path, supplier, currency):
    book = openpyxl.load_workbook(path, read_only=True, data_only=True)
    sheet = book.worksheets[0]
    file_name = os.path.basename(path)
    category = re.sub(r"\s+Прайс.*$", "", os.path.splitext(file_name)[0]).strip()
    source_url = ""
    header_seen = False
    group = ""
    items = []
    skipped = 0
    for row in sheet.iter_rows(values_only=True):
        cells = [clean(value) for value in (list(row) + [None] * 4)[:4]]
        if not any(cells):
            continue
        if not header_seen:
            if cells[0].startswith("http"):
                source_url = cells[0]
            if cells[0].lower().startswith("артикул"):
                header_seen = True
            continue
        article, name, price_text, unit = cells
        if article and name:
            items.append({
                "article": article,
                "name": name,
                "price": parse_price(row[2] if len(row) > 2 else None),
                "unit": unit or None,
                "group": group,
                "attributes": attributes(category, name),
            })
        elif not article and name and not price_text and not unit:
            # Group titles sit in the name column with empty article and price.
            group = name
        else:
            # Rows without an article (e.g. design codes with price 0) are not purchasable items.
            skipped += 1
    file_date = datetime.date.fromtimestamp(os.path.getmtime(path)).isoformat()
    return {
        "schemaVersion": SCHEMA_VERSION,
        "supplier": supplier,
        "currency": currency,
        "category": category,
        "sourceFile": file_name,
        "sourceUrl": source_url,
        "fileDate": file_date,
        "importedAt": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
        "priceStatus": "needs-review",
        "stats": {
            "items": len(items),
            "withoutUnit": sum(1 for item in items if not item["unit"]),
            "withoutPrice": sum(1 for item in items if item["price"] is None),
            "skippedRows": skipped,
        },
        "items": items,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder")
    parser.add_argument("--supplier", default="KRONAS")
    parser.add_argument("--currency", default="UAH")
    parser.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "prices"))
    args = parser.parse_args()
    files = sorted(name for name in os.listdir(args.folder) if name.lower().endswith(".xlsx") and not name.startswith("~$"))
    if not files:
        sys.exit("В папке нет файлов .xlsx")
    supplier_dir = os.path.join(args.out, args.supplier.lower())
    os.makedirs(supplier_dir, exist_ok=True)
    index_path = os.path.join(args.out, "index.json")
    index = {"schemaVersion": SCHEMA_VERSION, "lists": []}
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8") as handle:
            index = json.load(handle)
    index["lists"] = [entry for entry in index.get("lists", []) if entry.get("supplier") != args.supplier]
    for number_, name in enumerate(files, start=1):
        data = convert(os.path.join(args.folder, name), args.supplier, args.currency)
        relative = f"{args.supplier.lower()}/{number_:02d}.json"
        with open(os.path.join(args.out, relative), "w", encoding="utf-8", newline="\n") as handle:
            json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
        index["lists"].append({key: data[key] for key in
                               ("supplier", "currency", "category", "sourceFile", "sourceUrl", "fileDate", "importedAt", "priceStatus", "stats")}
                              | {"path": relative})
        stats = data["stats"]
        print(f"{data['category']}: позиций {stats['items']}, без единицы {stats['withoutUnit']}, "
              f"без цены {stats['withoutPrice']}, пропущено строк {stats['skippedRows']}")
    with open(index_path, "w", encoding="utf-8", newline="\n") as handle:
        json.dump(index, handle, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
