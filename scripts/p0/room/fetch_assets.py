"""P0 3D test: fetch the stand-in room's CC0 assets from Poly Haven.

Downloads glTF models (1k textures), a few PBR textures and one HDRI from
https://polyhaven.com, each into its own folder under .p0/downloads/<asset>/,
checks every file's md5 against the API, and records name, page URL, download
URLs, authors and licence in captures/p0/room/assets.json.

Everything downloaded is data (glTF, .bin, .jpg, .hdr). Nothing is executed.

Run with Blender's bundled Python in isolated mode, from the repo root:
  <blender>/4.5/python/bin/python.exe -I scripts/p0/room/fetch_assets.py
"""

import hashlib
import json
import os
import sys
import urllib.request

ROOT = os.getcwd()
DL = os.path.join(ROOT, ".p0", "downloads")
OUT_JSON = os.path.join(ROOT, "captures", "p0", "room", "assets.json")
API = "https://api.polyhaven.com"
UA = {"User-Agent": "bbe-p0-room-test/1.0 (stand-in room for a perf test)"}

# id -> what it stands in for. Models come as glTF at 1k.
MODELS = {
    "sofa_02": "sofa (Self Care anchor)",
    "modern_arm_chair_01": "armchair by the window",
    "modern_coffee_table_01": "coffee table (Today and Journal anchors)",
    "small_wooden_table_01": "desk on the right wall (scaled to desk height)",
    "gallinera_chair": "desk chair",
    "side_table_01": "side table by the armchair",
    "Shelf_01": "bookcase on the right wall",
    "potted_plant_01": "large plant by the window",
    "potted_plant_02": "furniture spot, item A",
    "pachira_aquatica_01": "furniture spot, item B (one variant)",
    "planter_pot_clay": "pot for item B",
    "potted_plant_04": "small succulent on the coffee table",
    "calathea_orbifolia_01": "plant on the desk (one variant)",
    "book_encyclopedia_set_01": "books on the desk, bookcase and coffee table",
    "Camera_01": "camera on the coffee table",
    "throw_pillows_01": "cushions on the sofa",
    "ceramic_vase_01": "vase on the window sill",
    "hanging_picture_frame_02": "wall art, right wall",
    "fancy_picture_frame_01": "wall art, right wall",
    "desk_lamp_arm_01": "desk lamp (unlit prop)",
}
# id -> (maps wanted, resolution)
TEXTURES = {
    "laminate_floor_02": (["Diffuse", "Rough"], "2k"),
    "beige_wall_001": (["Diffuse"], "1k"),
}
HDRIS = {"shanghai_riverside": "4k"}


def get_json(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return json.load(r)


def safe_join(base, rel):
    rel = rel.replace("\\", "/")
    if rel.startswith("/") or ".." in rel.split("/"):
        raise ValueError("unsafe path in API response: " + rel)
    path = os.path.normpath(os.path.join(base, rel))
    if not path.startswith(os.path.normpath(base) + os.sep):
        raise ValueError("path escapes its folder: " + rel)
    return path


def fetch(url, dest, md5, size):
    if os.path.exists(dest) and os.path.getsize(dest) == size:
        with open(dest, "rb") as f:
            if hashlib.md5(f.read()).hexdigest() == md5:
                return False
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
        data = r.read()
    if hashlib.md5(data).hexdigest() != md5:
        raise RuntimeError("md5 mismatch for " + url)
    with open(dest, "wb") as f:
        f.write(data)
    return True


def main():
    os.makedirs(DL, exist_ok=True)
    records = []

    def record(asset_id, kind, role, files):
        info = get_json(API + "/info/" + asset_id)
        records.append({
            "id": asset_id,
            "name": info.get("name", asset_id),
            "kind": kind,
            "role": role,
            "url": "https://polyhaven.com/a/" + asset_id,
            "authors": sorted(info.get("authors", {}).keys()),
            "licence": "CC0",
            "licence_url": "https://polyhaven.com/license",
            "polycount_source": info.get("polycount"),
            "files": files,
        })

    for asset_id, role in MODELS.items():
        files = get_json(API + "/files/" + asset_id)
        entry = files["gltf"]["1k"]["gltf"]
        base = os.path.join(DL, asset_id)
        got = []
        dest = safe_join(base, os.path.basename(entry["url"]))
        fetch(entry["url"], dest, entry["md5"], entry["size"])
        got.append({"url": entry["url"], "bytes": entry["size"]})
        for rel, inc in entry.get("include", {}).items():
            fetch(inc["url"], safe_join(base, rel), inc["md5"], inc["size"])
            got.append({"url": inc["url"], "bytes": inc["size"]})
        record(asset_id, "model (glTF, 1k textures)", role, got)
        print("model", asset_id, sum(g["bytes"] for g in got))

    for asset_id, (maps, res) in TEXTURES.items():
        files = get_json(API + "/files/" + asset_id)
        base = os.path.join(DL, asset_id)
        got = []
        for m in maps:
            entry = files[m][res]["jpg"]
            fetch(entry["url"], safe_join(base, os.path.basename(entry["url"])), entry["md5"], entry["size"])
            got.append({"url": entry["url"], "bytes": entry["size"]})
        record(asset_id, "texture (" + res + " jpg)", "room surface", got)
        print("texture", asset_id)

    for asset_id, res in HDRIS.items():
        files = get_json(API + "/files/" + asset_id)
        entry = files["hdri"][res]["hdr"]
        base = os.path.join(DL, asset_id)
        fetch(entry["url"], safe_join(base, os.path.basename(entry["url"])), entry["md5"], entry["size"])
        record(asset_id, "HDRI (" + res + " hdr)", "golden-hour sky fill and the window's city view",
               [{"url": entry["url"], "bytes": entry["size"]}])
        print("hdri", asset_id)

    os.makedirs(os.path.dirname(OUT_JSON), exist_ok=True)
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump({
            "source": "Poly Haven (https://polyhaven.com), all assets CC0",
            "note": "Downloaded for the P0 stand-in room only; stored under .p0/downloads (ignored by git).",
            "assets": records,
        }, f, indent=2)
    print("wrote", OUT_JSON, len(records), "assets")


if __name__ == "__main__":
    sys.exit(main())
