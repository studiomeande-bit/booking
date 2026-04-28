#!/usr/bin/env python3

import datetime as dt
import json
import pathlib
import re
import sys
import unicodedata

ROOT_FOLDER_ID = "1OPRMHbnh6ctci8jmLjlOb7dlHMReG1jT"
FOLDERS = {
    "15K1jTxDEqRBAvJEgFV4c2wQXw4g1_C-b": ("가족사진", "family", "Family"),
    "1YE5NfObgc_8FFOBcdAgfAziUOLLuk8V6": ("만삭", "maternity", "Maternity"),
    "1WuXFBBepxPLbr0L0eBVX4Y5ysRb8mq3N": ("스냅", "snap", "Snap"),
    "1xtUATMeWyZi47wf5zgT25459urlnU_hi": ("웨딩", "wedding", "Wedding"),
    "1kOF4NvB887x7bXbngcyPE-64NL3vLmiT": ("키즈", "kids", "Kids"),
    "17Lcj2wb107iLpvn1UMEu_wb0gJiv0lws": ("프로필", "portrait", "Portrait"),
}


def decode_ivd(text: str):
    match = re.search(r"_DRIVE_ivd'\] = '(.+?)';", text)
    if not match:
        return []
    raw = match.group(1)
    decoded = (
        raw.encode("utf-8")
        .decode("unicode_escape")
        .encode("latin1", "ignore")
        .decode("utf-8", "ignore")
    )
    data = json.loads(decoded)
    if not data:
        return []
    items = data[0] if isinstance(data[0], list) else data
    return items if isinstance(items, list) else []


def build_payload(source_dir: pathlib.Path):
    raw_photos = []
    for folder_id, (folder_name, slug, label) in FOLDERS.items():
        html_path = source_dir / f"{folder_id}.html"
        if not html_path.exists():
            continue
        items = decode_ivd(html_path.read_text("utf-8", errors="ignore"))
        for item in items:
            if not isinstance(item, list) or len(item) < 10:
                continue
            file_id = str(item[0] or "").strip()
            file_name = str(item[2] or "").strip()
            mime = str(item[3] or "").strip()
            timestamp = int(item[9] or 0)
            if not file_id or not mime.startswith("image/"):
                continue
            if not file_name or file_name.startswith(".") or file_name.startswith("\\"):
                continue
            raw_photos.append(
                {
                    "id": file_id,
                    "name": file_name,
                    "category": slug,
                    "categoryLabel": label,
                    "folderId": folder_id,
                    "folderName": folder_name,
                    "timestamp": timestamp,
                }
            )

    photos = dedupe_photos(raw_photos)
    photos.sort(key=lambda item: (item["timestamp"], item["name"]), reverse=True)
    return {
        "generatedAt": dt.datetime.now(dt.timezone.utc).isoformat(),
        "sourceFolder": ROOT_FOLDER_ID,
        "total": len(photos),
        "dedupedRemoved": max(0, len(raw_photos) - len(photos)),
        "categories": [
            {"slug": "all", "label": "All"},
            {"slug": "portrait", "label": "Portrait"},
            {"slug": "family", "label": "Family"},
            {"slug": "kids", "label": "Kids"},
            {"slug": "maternity", "label": "Maternity"},
            {"slug": "wedding", "label": "Wedding"},
            {"slug": "snap", "label": "Snap"},
        ],
        "photos": photos,
    }


def normalize_name_for_dedupe(file_name: str) -> str:
    stem = pathlib.Path(file_name).stem
    stem = unicodedata.normalize("NFKC", stem).lower()
    stem = stem.replace("_", " ").replace("-", " ")
    stem = re.sub(r"\s+", " ", stem).strip()
    stem = re.sub(r"\s*\(\d+\)$", "", stem)
    stem = re.sub(r"\s*copy(?: \d+)?$", "", stem)
    stem = re.sub(r"\s*final(?: \d+)?$", "", stem)
    stem = re.sub(r"\s*edited?$", "", stem)
    stem = re.sub(r"\s+", " ", stem).strip()
    return stem


def dedupe_photos(photos):
    deduped = {}
    sorted_photos = sorted(photos, key=lambda item: (item["timestamp"], item["name"]), reverse=True)
    for photo in sorted_photos:
        key = (photo["category"], normalize_name_for_dedupe(photo["name"]))
        deduped.setdefault(key, photo)
    return list(deduped.values())


def main():
    if len(sys.argv) != 3:
        print("usage: generate-portfolio-data.py <html_dir> <output_json>", file=sys.stderr)
        raise SystemExit(1)

    source_dir = pathlib.Path(sys.argv[1])
    output_path = pathlib.Path(sys.argv[2])
    payload = build_payload(source_dir)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"wrote {output_path} ({payload['total']} photos)")


if __name__ == "__main__":
    main()
