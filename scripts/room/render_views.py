"""Render the six 2.5D room views from the stand-in Blender scene.

Placeholders for the design team's art (design-system/v2/05-room.md, "Stand-ins"):
the same master scene, one Home camera and five focus cameras, path-traced at
2560 x 1440 so every view shows the same props, positions and light.

    blender --background .p0/build/room.blend --python scripts/room/render_views.py -- \
        [--out .p0/renders] [--samples 128] [--size 2560x1440] [--only today,home]

Build the scene first with scripts/p0/room/build_room.py. Encode into
public/room/sunny/ (AVIF about 25-55 KB, WebP about 70-130 KB per view):

    for v in home today journal growth skills selfcare; do
      ffmpeg -i .p0/renders/$v.png -c:v libaom-av1 -still-picture 1 -crf 32 -pix_fmt yuv420p public/room/sunny/$v.avif
      ffmpeg -i .p0/renders/$v.png -c:v libwebp -quality 76 public/room/sunny/$v.webp
    done
"""

import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv else default


OUT = os.path.abspath(arg("--out", ".p0/renders"))
SAMPLES = int(arg("--samples", "128"))
W, H = (int(v) for v in arg("--size", "2560x1440").split("x"))
ONLY = set(filter(None, arg("--only", "").split(",")))

# Blender coordinates, Z up, metres. Home, Today, Journal and Self Care are the
# P0 anchors; Growth Map and Skills are new: the back window's tall plant and
# the right-hand desk with the bookshelf.
VIEWS = {
    "home": {"pos": (0.75, -3.05, 1.58), "target": (-0.15, 1.0, 0.92), "vfov": 54.0},
    "today": {"pos": (0.25, -2.1, 1.3), "target": (-1.05, -0.5, 0.42), "vfov": 44.0},
    "journal": {"pos": (-0.42, -1.38, 0.98), "target": (-1.0, -0.66, 0.40), "vfov": 38.0},
    "growth": {"pos": (0.55, -1.15, 1.4), "target": (-0.7, 1.45, 0.95), "vfov": 48.0},
    "skills": {"pos": (0.15, -1.05, 1.38), "target": (2.45, 0.75, 1.0), "vfov": 50.0},
    "selfcare": {"pos": (0.55, -1.3, 1.28), "target": (-2.1, -0.4, 0.62), "vfov": 50.0},
}

scene = bpy.context.scene
scene.render.engine = "CYCLES"
prefs = bpy.context.preferences.addons["cycles"].preferences
for kind in ("OPTIX", "CUDA"):
    try:
        prefs.compute_device_type = kind
        prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == kind
            scene.cycles.device = "GPU"
            break
    except TypeError:
        continue

scene.cycles.samples = SAMPLES
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = W, H
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.color_depth = "8"

os.makedirs(OUT, exist_ok=True)
for name, spec in VIEWS.items():
    if ONLY and name not in ONLY:
        continue
    cam_data = bpy.data.cameras.new("render_" + name)
    cam_data.sensor_fit = "VERTICAL"
    cam_data.angle_y = spec["vfov"] * 3.14159265 / 180
    cam = bpy.data.objects.new("render_" + name, cam_data)
    scene.collection.objects.link(cam)
    cam.location = Vector(spec["pos"])
    cam.rotation_euler = (Vector(spec["target"]) - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    scene.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    print(f"rendered {name} -> {scene.render.filepath}", flush=True)
