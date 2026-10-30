"""P0 3D test: a first draft of design-system/v2/05-room.md's acceptance test.

Reads the screenshots measure.ts took (PNG, decoded with ffmpeg) and computes
what can be computed without hotspots, a menu or real boards:

  2. clipped highlights: share of pixels at full white, effects (blur) off and on
  3. bought items match the bake: the item's pixels against a path-traced Cycles
     render of the same camera, and the floor around it darker with the item's
     shadow decal than without (a partial check, not the criterion)
  4. board text contrast: --ink on the card's --surface at 92% over each anchor's
     blurred view, per pixel under the card; and the card as actually rendered
  5. reduced motion: the card over the still (the travel part is in measure.ts)

Colours are computed here, in Python, from the v2 contract; the scanned
TypeScript files never hold a hex literal. Prints one JSON object to stdout.

Usage: <blender>/4.5/python/bin/python.exe -I scripts/p0/room/acceptance.py <input.json>
"""

import json
import math
import re
import subprocess
import sys

import numpy as np

INK_EXPECTED = (0x26, 0x39, 0x2F)  # --ink, "dark botanical"


def load(path):
    probe = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                            "stream=width,height", "-of", "csv=p=0", path], capture_output=True, text=True, check=True)
    w, h = (int(x) for x in probe.stdout.strip().split(",")[:2])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)


def token(doc, name):
    m = re.search(r"`--" + name + r"`\s*\|\s*`#([0-9A-Fa-f]{6})`", doc)
    h = m.group(1)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def lin(c):
    c = np.asarray(c, np.float64) / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def luminance(rgb):
    v = lin(rgb)
    return v[..., 0] * 0.2126 + v[..., 1] * 0.7152 + v[..., 2] * 0.0722


def contrast(l1, l2):
    hi, lo = np.maximum(l1, l2), np.minimum(l1, l2)
    return (hi + 0.05) / (lo + 0.05)


def clipped(img):
    white = np.all(img == 255, axis=2)
    near = np.all(img >= 250, axis=2)
    return {"fullWhitePct": round(float(white.mean() * 100), 4), "at250PlusPct": round(float(near.mean() * 100), 4),
            "pass": bool(white.mean() < 0.005)}


def rect(r, img, inset=0):
    h, w = img.shape[:2]
    x0, y0 = max(0, int(math.floor(r["x"])) + inset), max(0, int(math.floor(r["y"])) + inset)
    x1, y1 = min(w, int(math.ceil(r["x"] + r["width"])) - inset), min(h, int(math.ceil(r["y"] + r["height"])) - inset)
    return img[y0:y1, x0:x1]


def card_contrast(bg_region, surface, ink, opacity):
    # the browser composites in sRGB 8-bit: card = surface * a + background * (1 - a)
    comp = np.asarray(surface, np.float64) * opacity + bg_region.astype(np.float64) * (1 - opacity)
    comp = np.round(comp)
    c = contrast(luminance(comp), float(luminance(np.array(ink))))
    return {"min": round(float(c.min()), 2), "p1": round(float(np.percentile(c, 1)), 2),
            "mean": round(float(c.mean()), 2), "pass": bool(c.min() >= 4.5)}


def rendered_card(img, r, ink):
    # the card's top padding band (24 px, no text) as the browser actually drew it
    band = img[int(r["y"]) + 3:int(r["y"]) + 18, int(r["x"]) + 16:int(r["x"] + r["width"]) - 16]
    c = contrast(luminance(band.astype(np.float64)), float(luminance(np.array(ink))))
    return {"min": round(float(c.min()), 2), "mean": round(float(c.mean()), 2), "pass": bool(c.min() >= 4.5)}


def project(p, cam, w, h):
    pos, tgt = np.array(cam["position"], float), np.array(cam["target"], float)
    f = tgt - pos
    f /= np.linalg.norm(f)
    r = np.cross(f, [0, 1, 0])
    r /= np.linalg.norm(r)
    u = np.cross(r, f)
    d = np.array(p, float) - pos
    xc, yc, zc = d @ r, d @ u, d @ f
    t = math.tan(math.radians(cam["fov"]) / 2)
    return ((xc / (zc * t * w / h)) + 1) / 2 * w, (1 - yc / (zc * t)) / 2 * h


def main():
    cfg = json.load(open(sys.argv[1], encoding="utf-8"))
    doc = open(cfg["colorDoc"], encoding="utf-8").read()
    surface, ink = token(doc, "surface"), token(doc, "ink")
    out = {"tokens": {"inkMatchesBrief": ink == INK_EXPECTED, "inkOnSurface": round(float(
        contrast(luminance(np.array(surface, float)), luminance(np.array(ink, float)))), 2)}}

    # 2. clipping
    clip = {"overview": clipped(load(cfg["overview"]))}
    for k, p in cfg["sharp"].items():
        clip[k + "_sharp"] = clipped(load(p))
    for k, p in cfg["blur"].items():
        clip[k + "_blurred"] = clipped(load(p))
    out["2_clippedHighlights"] = {"threshold": "< 0.5% of pixels at full white (255,255,255)", "images": clip,
                                  "pass": all(v["pass"] for v in clip.values())}

    # 4. contrast over each anchor's blurred view
    con = {}
    for k, p in cfg["blur"].items():
        img = load(p)
        con[k] = card_contrast(rect(cfg["cards"][k], img).reshape(-1, 3), surface, ink, cfg["cardOpacity"])
    out["4_boardTextContrast"] = {"rule": "--ink on --surface at 92% over the blurred anchor view, every pixel under the card",
                                  "anchors": con,
                                  "todayCardAsRendered": rendered_card(load(cfg["todayCard"]), cfg["cards"]["today"], ink),
                                  "pass": all(v["pass"] for v in con.values())}

    # 5. reduced motion: the card as rendered over the AVIF still
    red = load(cfg["reduced"])
    out["5_reducedMotion"] = {"cardOverStill": rendered_card(red, cfg["reducedCard"], ink),
                              "clipping": clipped(red)}

    # 3. items against the bake (partial)
    item = {}
    spot = json.load(open(cfg["reference"]["overview"].replace("preview_overview_a.png", "anchors.json")))["spot"]["position"]
    cam = cfg["spot"]["selfcare"]
    a, b, none = load(cfg["swap"]["a"]), load(cfg["swap"]["b"]), load(cfg["swap"]["none"])
    h, w = a.shape[:2]
    base = project(spot, cam, w, h)
    top = project([spot[0], spot[1] + 1.1, spot[2]], cam, w, h)
    left = project([spot[0], spot[1], spot[2] - 0.45], cam, w, h)
    right = project([spot[0], spot[1], spot[2] + 0.45], cam, w, h)
    xs = sorted([base[0], top[0], left[0], right[0]])
    x0, x1 = int(max(0, xs[0] - 20)), int(min(w, xs[-1] + 20))
    y0, y1 = int(max(0, top[1])), int(min(h, base[1] + 10))
    item["itemBoxPx"] = [x0, y0, x1, y1]
    # shadow: the floor band just around the pot's base, with the decal vs. without any item
    fy0, fy1 = int(min(h - 1, base[1] - 6)), int(min(h, base[1] + 40))
    fx0, fx1 = int(max(0, base[0] - 160)), int(min(w, base[0] + 160))
    la, ln = luminance(a[fy0:fy1, fx0:fx1]).mean(), luminance(none[fy0:fy1, fx0:fx1]).mean()
    item["floorAroundBase"] = {"luminanceWithA": round(float(la), 4), "luminanceEmpty": round(float(ln), 4),
                               "darkerWithItem": bool(la < ln)}
    ref = load(cfg["reference"]["selfcare"])
    if ref.shape == a.shape:
        ra = luminance(ref[y0:y1, x0:x1]).mean()
        wa = luminance(a[y0:y1, x0:x1]).mean()
        item["itemVsCycles"] = {"luminanceWebGL": round(float(wa), 4), "luminanceCycles": round(float(ra), 4),
                                "relativeDiff": round(float(abs(wa - ra) / max(ra, 1e-6)), 3)}
    out["3_itemsMatchBake_partial"] = item

    # bake fidelity: WebGL (unlit, baked) against a path-traced Cycles render of the same camera
    fid = {}
    for k in ("overview", "selfcare", "today"):
        r_, g_ = load(cfg["reference"][k]), load(cfg["webgl"][k])
        if r_.shape == g_.shape:
            diff = np.abs(r_.astype(np.int16) - g_.astype(np.int16))
            fid[k] = {"meanAbsDiff8bit": round(float(diff.mean()), 2),
                      "luminanceWebGL": round(float(luminance(g_).mean()), 4),
                      "luminanceCycles": round(float(luminance(r_).mean()), 4)}
    out["bakeFidelityVsCycles"] = {"note": "Cycles reference includes glossy reflections and full-res geometry; the bake is diffuse only, so some difference is expected",
                                   "views": fid}
    print(json.dumps(out))


if __name__ == "__main__":
    main()
