"""P0 3D test: build, bake and export the stand-in room.

One script, run headless, creates the scene from the Poly Haven downloads,
lights it with one golden-hour sun plus HDRI sky fill, gives every baked mesh a
second UV set ("bake"), bakes combined lighting into a few atlases, denoises
them, and exports GLBs named the way design-system/v2/05-room.md asks:

  room.glb         room_shell, room_furniture, room_props, room_foliage,
                   anchor_today, anchor_journal, anchor_selfcare (meshes),
                   live_window, live_window_left (unlit city views), spot_plant_sofa (empty),
                   cam_overview (empty). Anchor camera transforms ride in the
                   nodes' extras, in glTF (Y-up) coordinates.
  item_a.glb       spot_plant_sofa__a + spot_plant_sofa__a_shadow
  item_b.glb       spot_plant_sofa__b + spot_plant_sofa__b_shadow

The room's main bake is made with the spot empty, so swapping items never
changes it. Each item is baked in place with the room around it, into its own
texture, and ships a multiply decal (its soft shadow on the floor) computed as
the ratio of two baked floor patches, with and without the item, after the
view transform.

Run from the repo root:
  blender --background --factory-startup --python scripts/p0/room/build_room.py -- [options]

Options:
  --quick             16 samples, 512 px atlases (layout checks)
  --previews          also path-trace the anchor views (reference renders)
  --no-bake           build and save the .blend and previews only
  --shell-size N      shell atlas size (default 2048; try 4096)
  --size N            other atlases (default 2048)
  --samples N         bake samples (default 512)
  --out DIR           output folder under .p0 (default .p0/build)
"""

import bmesh
import bpy
import json
import math
import os
import sys
import time

import numpy as np
from mathutils import Matrix, Vector

# --------------------------------------------------------------------------- args

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None, cast=str):
    if name in argv:
        i = argv.index(name)
        return cast(argv[i + 1]) if cast is not bool else True
    return default


QUICK = "--quick" in argv
PREVIEWS = "--previews" in argv
NO_BAKE = "--no-bake" in argv
SIZE = arg("--size", 512 if QUICK else 2048, int)
SHELL_SIZE = arg("--shell-size", 512 if QUICK else 2048, int)
ITEM_SIZE = 256 if QUICK else 1024
DECAL_SIZE = 128 if QUICK else 512
SAMPLES = arg("--samples", 16 if QUICK else 512, int)
PACK_SHAPE = arg("--pack", "CONCAVE")

ROOT = os.getcwd()
DL = os.path.join(ROOT, ".p0", "downloads")
OUT = os.path.join(ROOT, arg("--out", os.path.join(".p0", "build")))
TEX = os.path.join(OUT, "tex")
TMP = os.path.join(OUT, "tmp")
for d in (OUT, TEX, TMP):
    os.makedirs(d, exist_ok=True)

STATS = {"args": argv, "timings_s": {}, "atlases": {}, "meshes": {}, "items": {}}
T0 = time.time()


def lap(name, since):
    STATS["timings_s"][name] = round(time.time() - since, 2)
    print("[time]", name, STATS["timings_s"][name], "s", flush=True)


# --------------------------------------------------------------------------- look

# One golden-hour sun through the back window, from the right, plus the HDRI
# sky with its own sun clamped out. AgX, pushed bright and warm.
SUN_AZIMUTH = 35.0      # degrees from +Y (the window normal) toward +X
SUN_ELEVATION = 24.0
SUN_STRENGTH = 6.0
SUN_COLOR = (1.0, 0.70, 0.43)
SUN_ANGLE = 2.0
SKY_STRENGTH = 1.6
SKY_CLAMP = 8.0
HDRI_ROTATION = 46.8    # the skyline in the back window; the HDRI sun behind the room
EXPOSURE = 1.9
LOOK = "AgX - Base Contrast"
BACKDROP_EXPOSURE = -1.0

# Room: interior x [-2.6, 2.6], y [-3.2, 2.0], z [0, 2.85]. Walls 0.15 thick.
X0, X1, Y0, Y1, ZC, WT = -2.6, 2.6, -3.2, 2.0, 2.85, 0.15
WIN_BACK = (-2.1, 1.3, 0.5, 2.55)      # x0, x1, z0, z1
WIN_LEFT = (-0.2, 1.5, 1.05, 2.55)     # y0, y1, z0, z1
SPOT = Vector((-2.02, 0.95, 0.0))      # the furniture spot beside the sofa

# Anchor cameras, Blender coordinates (Z up). vfov in degrees.
CAMERAS = {
    "overview": {"pos": (0.75, -3.05, 1.58), "target": (-0.15, 1.0, 0.92), "vfov": 54.0},
    "today": {"pos": (0.25, -2.1, 1.3), "target": (-1.05, -0.5, 0.42), "vfov": 44.0},
    "journal": {"pos": (-0.42, -1.38, 0.98), "target": (-1.0, -0.66, 0.40), "vfov": 38.0},
    "selfcare": {"pos": (0.55, -1.3, 1.28), "target": (-2.1, -0.4, 0.62), "vfov": 50.0},
}

# --------------------------------------------------------------------------- setup

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.name = "room"
coll = scene.collection
scene.render.engine = "CYCLES"


def setup_device():
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = "GPU"
                return kind + ": " + gpus[0].name
        except Exception as e:  # noqa: BLE001
            print("device", kind, "unavailable:", e)
    scene.cycles.device = "CPU"
    return "CPU"


STATS["device"] = setup_device()
print("device", STATS["device"])
cy = scene.cycles
cy.samples = SAMPLES
cy.use_denoising = False
cy.max_bounces = 8
cy.diffuse_bounces = 5
cy.glossy_bounces = 2
cy.transmission_bounces = 4
cy.transparent_max_bounces = 16
cy.sample_clamp_indirect = 8.0
cy.caustics_reflective = False
cy.caustics_refractive = False

vs = scene.view_settings
scene.display_settings.display_device = "sRGB"
vs.view_transform = "AgX"
try:
    vs.look = LOOK
except TypeError:
    vs.look = "None"
vs.exposure = EXPOSURE
vs.gamma = 1.0

# --------------------------------------------------------------------------- helpers


def link(obj):
    if obj.name not in coll.objects:
        coll.objects.link(obj)
    return obj


def mat_basic(name, color, rough=0.7, tex=None, tex_scale=None, tint=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    if tex:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = bpy.data.images.load(tex, check_existing=True)
        if tint:
            mix = nt.nodes.new("ShaderNodeMix")
            mix.data_type = "RGBA"
            mix.blend_type = "MULTIPLY"
            mix.inputs["Factor"].default_value = 1.0
            mix.inputs[7].default_value = (*tint, 1.0)
            nt.links.new(t.outputs["Color"], mix.inputs[6])
            nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
        else:
            nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    return m


def box_uv(me, tile=1.0, layer="UVMap"):
    uv = me.uv_layers.get(layer) or me.uv_layers.new(name=layer)
    for poly in me.polygons:
        n = poly.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            u, v = ((co.y, co.z), (co.x, co.z), (co.x, co.y))[ax]
            uv.data[li].uv = (u / tile, v / tile)


def box(name, x0, x1, y0, y1, z0, z1, mat, tile=1.0):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0),
                       (y0 + y1) / 2 + v.co.y * (y1 - y0),
                       (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    box_uv(me, tile)
    return link(bpy.data.objects.new(name, me))


def plane(name, x0, x1, y0, y1, z, mat, tile=1.0, subdiv=0):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1 + subdiv, y_segments=1 + subdiv, size=0.5)
    for v in bm.verts:
        v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), (y0 + y1) / 2 + v.co.y * (y1 - y0), z))
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    box_uv(me, tile)
    return link(bpy.data.objects.new(name, me))


def gltf_path(asset):
    d = os.path.join(DL, asset)
    return os.path.join(d, [f for f in os.listdir(d) if f.endswith(".gltf")][0])


_imported = {}


def import_asset(asset):
    """Import a Poly Haven glTF once; return its mesh objects, hidden templates."""
    if asset in _imported:
        return _imported[asset]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=gltf_path(asset))
    new = [o for o in bpy.data.objects if o not in before]
    meshes = []
    for o in new:
        if o.type == "MESH":
            mw = o.matrix_world.copy()
            o.parent = None
            o.matrix_world = mw
            meshes.append(o)
    for o in new:
        if o.type != "MESH":
            bpy.data.objects.remove(o)
    for o in meshes:
        for c in list(o.users_collection):
            c.objects.unlink(o)
    _imported[asset] = meshes
    return meshes


def bake_world(obj):
    """Apply the object's transform into its own (single-user) mesh."""
    me = obj.data.copy()
    me.transform(obj.matrix_world)
    obj.data = me
    obj.matrix_world = Matrix.Identity(4)
    return obj


def decimate(obj, ratio):
    if ratio >= 1.0:
        return obj
    mod = obj.modifiers.new("dec", "DECIMATE")
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    obj.modifiers.remove(mod)
    obj.data = me
    return obj


def center_bottom(obj):
    vs_ = [v.co for v in obj.data.vertices]
    cx = (min(v.x for v in vs_) + max(v.x for v in vs_)) / 2
    cy_ = (min(v.y for v in vs_) + max(v.y for v in vs_)) / 2
    z0 = min(v.z for v in vs_)
    obj.data.transform(Matrix.Translation((-cx, -cy_, -z0)))


def place(asset, loc, rot_z=0.0, scale=1.0, pick=None, name=None, recenter=False, dec=None, rot_y=0.0):
    """Copy an imported asset's meshes, join them, and put the result in the room."""
    parts = [o for o in import_asset(asset) if pick is None or any(o.name.startswith(p) for p in pick)]
    copies = []
    for o in parts:
        c = o.copy()
        c.data = o.data.copy()
        link(c)
        bake_world(c)
        if dec and o.name in dec:
            decimate(c, dec[o.name])
        elif dec and "*" in dec:
            decimate(c, dec["*"])
        copies.append(c)
    obj = join(copies, name or asset)
    if recenter:
        center_bottom(obj)
    sc = scale if isinstance(scale, tuple) else (scale, scale, scale)
    obj.data.transform(Matrix.Rotation(math.radians(rot_z), 4, "Z") @ Matrix.Rotation(math.radians(rot_y), 4, "Y")
                       @ Matrix.Diagonal((*sc, 1.0)))
    if recenter:
        center_bottom(obj)
    obj.data.transform(Matrix.Translation(loc))
    return obj


def join(objs, name):
    objs = [o for o in objs if o]
    if len(objs) == 1:
        objs[0].name = name
        return objs[0]
    with bpy.context.temp_override(active_object=objs[0], selected_editable_objects=objs, selected_objects=objs):
        bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def tris(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def top_z(obj):
    return max(v.co.z for v in obj.data.vertices)


# --------------------------------------------------------------------------- world and sun


def setup_world():
    w = bpy.data.worlds.new("golden_hour")
    scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    nt.nodes.clear()
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Rotation"].default_value = (0, 0, math.radians(HDRI_ROTATION))
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(os.path.join(DL, "shanghai_riverside", "shanghai_riverside_4k.hdr"))
    nt.links.new(tc.outputs["Generated"], mp.inputs["Vector"])
    nt.links.new(mp.outputs["Vector"], env.inputs["Vector"])
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    comb = nt.nodes.new("ShaderNodeCombineColor")
    nt.links.new(env.outputs["Color"], sep.inputs["Color"])
    for i in range(3):
        mn = nt.nodes.new("ShaderNodeMath")
        mn.operation = "MINIMUM"
        mn.inputs[1].default_value = SKY_CLAMP
        nt.links.new(sep.outputs[i], mn.inputs[0])
        nt.links.new(mn.outputs[0], comb.inputs[i])
    bg_light = nt.nodes.new("ShaderNodeBackground")
    bg_light.inputs["Strength"].default_value = SKY_STRENGTH
    nt.links.new(comb.outputs["Color"], bg_light.inputs["Color"])
    bg_cam = nt.nodes.new("ShaderNodeBackground")
    bg_cam.inputs["Strength"].default_value = 1.0
    nt.links.new(env.outputs["Color"], bg_cam.inputs["Color"])
    lp = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    nt.links.new(bg_light.outputs["Background"], mix.inputs[1])
    nt.links.new(bg_cam.outputs["Background"], mix.inputs[2])
    out = nt.nodes.new("ShaderNodeOutputWorld")
    nt.links.new(mix.outputs["Shader"], out.inputs["Surface"])

    sun = bpy.data.lights.new("sun", "SUN")
    sun.energy = SUN_STRENGTH
    sun.color = SUN_COLOR
    sun.angle = math.radians(SUN_ANGLE)
    so = link(bpy.data.objects.new("sun", sun))
    az, el = math.radians(SUN_AZIMUTH), math.radians(SUN_ELEVATION)
    s = Vector((math.cos(el) * math.sin(az), math.cos(el) * math.cos(az), math.sin(el)))
    so.rotation_mode = "QUATERNION"
    so.rotation_quaternion = s.to_track_quat("Z", "Y")
    return so


# --------------------------------------------------------------------------- the room

t = time.time()
setup_world()

floor_m = mat_basic("floor", None, 0.45, os.path.join(DL, "laminate_floor_02", "laminate_floor_02_diff_2k.jpg"),
                    tint=(1.0, 0.86, 0.68))
wall_m = mat_basic("wall", None, 0.9, os.path.join(DL, "beige_wall_001", "beige_wall_001_diff_1k.jpg"),
                   tint=(1.25, 1.2, 1.1))
frame_m = mat_basic("window_frame", (0.82, 0.78, 0.70), 0.5)
bench_m = mat_basic("bench", (0.62, 0.45, 0.30), 0.5)
ceiling_m = mat_basic("ceiling", (0.85, 0.82, 0.77), 0.9)

shell = []
# floor and ceiling
shell.append(plane("floor", X0, X1, Y0, Y1, 0.0, floor_m, tile=1.6))
ceiling = box("ceiling", X0 - WT, X1 + WT, Y0 - WT, Y1 + WT, ZC, ZC + WT, ceiling_m, 2.0)
shell.append(ceiling)  # the overview sees it
# back wall with the big window
bx0, bx1, bz0, bz1 = WIN_BACK
shell += [
    box("wall_back_lo", X0 - WT, X1 + WT, Y1, Y1 + WT, 0.0, bz0, wall_m, 2.0),
    box("wall_back_hi", X0 - WT, X1 + WT, Y1, Y1 + WT, bz1, ZC + WT, wall_m, 2.0),
    box("wall_back_l", X0 - WT, bx0, Y1, Y1 + WT, bz0, bz1, wall_m, 2.0),
    box("wall_back_r", bx1, X1 + WT, Y1, Y1 + WT, bz0, bz1, wall_m, 2.0),
]
# left wall with a second window over the sofa
ly0, ly1, lz0, lz1 = WIN_LEFT
shell += [
    box("wall_left_lo", X0 - WT, X0, Y0 - WT, Y1 + WT, 0.0, lz0, wall_m, 2.0),
    box("wall_left_hi", X0 - WT, X0, Y0 - WT, Y1 + WT, lz1, ZC + WT, wall_m, 2.0),
    box("wall_left_f", X0 - WT, X0, Y0 - WT, ly0, lz0, lz1, wall_m, 2.0),
    box("wall_left_b", X0 - WT, X0, ly1, Y1 + WT, lz0, lz1, wall_m, 2.0),
]
shell.append(box("wall_right", X1, X1 + WT, Y0 - WT, Y1 + WT, 0.0, ZC + WT, wall_m, 2.0))
front_wall = box("wall_front", X0 - WT, X1 + WT, Y0 - WT, Y0, 0.0, ZC + WT, wall_m, 2.0)
# window frames: back window, three panes and a transom
fy0, fy1 = Y1 + 0.03, Y1 + 0.11
fw = 0.06
mull = [bx0 + (bx1 - bx0) * k / 3 for k in (1, 2)]
frames = [
    box("frame_b_l", bx0, bx0 + fw, fy0, fy1, bz0, bz1, frame_m, 1.0),
    box("frame_b_r", bx1 - fw, bx1, fy0, fy1, bz0, bz1, frame_m, 1.0),
    box("frame_b_t", bx0, bx1, fy0, fy1, bz1 - fw, bz1, frame_m, 1.0),
    box("frame_b_b", bx0, bx1, fy0, fy1, bz0, bz0 + fw, frame_m, 1.0),
    box("frame_b_tr", bx0, bx1, fy0, fy1, 2.05, 2.05 + fw * 0.8, frame_m, 1.0),
]
frames += [box("frame_b_m%d" % i, x - fw / 2, x + fw / 2, fy0, fy1, bz0, bz1, frame_m, 1.0) for i, x in enumerate(mull)]
fx0, fx1 = X0 - 0.11, X0 - 0.03
frames += [
    box("frame_l_f", fx0, fx1, ly0, ly0 + fw, lz0, lz1, frame_m, 1.0),
    box("frame_l_b", fx0, fx1, ly1 - fw, ly1, lz0, lz1, frame_m, 1.0),
    box("frame_l_t", fx0, fx1, ly0, ly1, lz1 - fw, lz1, frame_m, 1.0),
    box("frame_l_lo", fx0, fx1, ly0, ly1, lz0, lz0 + fw, frame_m, 1.0),
    box("frame_l_m", fx0, fx1, (ly0 + ly1) / 2 - fw / 2, (ly0 + ly1) / 2 + fw / 2, lz0, lz1, frame_m, 1.0),
]
shell += frames
# a built-in window bench under the back window
shell.append(box("bench", bx0, bx1, Y1 - 0.34, Y1 - 0.005, 0.0, bz0, bench_m, 1.0))
# skirting
skirt_m = mat_basic("skirting", (0.80, 0.76, 0.68), 0.6)
shell += [
    box("skirt_r", X1 - 0.015, X1, Y0, Y1, 0.0, 0.09, skirt_m, 1.0),
    box("skirt_l", X0, X0 + 0.015, Y0, Y1, 0.0, 0.09, skirt_m, 1.0),
]


def strip_outer_faces(obj):
    """Delete faces nobody inside the room can see, so they take no atlas space."""
    lo = Vector((X0 - WT - 1e-4, Y0 - WT - 1e-4, -1e-4))
    hi = Vector((X1 + WT + 1e-4, Y1 + WT + 1e-4, ZC + WT + 1e-4))
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    dead = []
    for f in bm.faces:
        p = f.calc_center_median() + f.normal * 0.01
        if not all(lo[i] <= p[i] <= hi[i] for i in range(3)):
            dead.append(f)
        elif p.z > ZC + 1e-3:  # inside the ceiling slab
            dead.append(f)
    bmesh.ops.delete(bm, geom=dead, context="FACES")
    bm.to_mesh(obj.data)
    bm.free()


for o in shell:
    strip_outer_faces(o)

# rug: a sage and cream check, like homescreen.jpg
rug_m = bpy.data.materials.new("rug")
rug_m.use_nodes = True
nt = rug_m.node_tree
chk = nt.nodes.new("ShaderNodeTexChecker")
chk.inputs["Scale"].default_value = 14.0
chk.inputs["Color1"].default_value = (0.42, 0.52, 0.40, 1)
chk.inputs["Color2"].default_value = (0.86, 0.81, 0.68, 1)
tcn = nt.nodes.new("ShaderNodeTexCoord")
nt.links.new(tcn.outputs["UV"], chk.inputs["Vector"])
nt.links.new(chk.outputs["Color"], nt.nodes["Principled BSDF"].inputs["Base Color"])
nt.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.95
rug = box("rug", -2.0, -0.2, -1.85, 0.75, 0.0, 0.008, rug_m, 2.6)

# --------------------------------------------------------------------------- furniture

sofa = place("sofa_02", (-2.17, -0.55, 0.0), 90)
seat_z = 0.42
pillows = place("throw_pillows_01", (-2.30, -0.50, seat_z - 0.02), 90, 0.85)
coffee = place("modern_coffee_table_01", (-1.05, -0.55, 0.008), 0)
table_top = top_z(coffee)
armchair = place("modern_arm_chair_01", (0.55, 1.0, 0.0), -45)
side_table = place("side_table_01", (1.45, 1.42, 0.0), -10)
desk = place("small_wooden_table_01", (2.29, -0.15, 0.0), -90, (1.35, 1.3, 1.42))
desk_top = top_z(desk)
chair = place("gallinera_chair", (1.72, -0.12, 0.0), 90)
shelf = place("Shelf_01", (X1 - 0.01, 1.32, 0.0), -90)  # its origin is at the back
frame1 = place("hanging_picture_frame_02", (X1 - 0.02, -0.55, 1.55), -90,
               pick=["hanging_picture_frame_02"])
frame2 = place("fancy_picture_frame_01", (X1 - 0.015, 0.30, 1.62), -90)


# drop the frame's glass (alpha blend): the bake would see through it anyway
def drop_material_faces(obj, prefix):
    idx = [i for i, m in enumerate(obj.data.materials) if m and m.name.startswith(prefix)]
    if not idx:
        return
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in idx], context="FACES")
    bm.to_mesh(obj.data)
    bm.free()


drop_material_faces(frame1, "hanging_picture_frame_02_glass")

# --------------------------------------------------------------------------- props

BOOKS = ["book_encyclopedia_set_01_book%02d" % i for i in range(1, 21)]
book_dec = {"*": 0.3}


def book(i, loc, rot_z, lying=False, s=1.0):
    return place("book_encyclopedia_set_01", loc, rot_z, s, pick=[BOOKS[i % 20]], name="book",
                 recenter=True, dec=book_dec, rot_y=90.0 if lying else 0.0)


# coffee table: Today and Journal
mug_m = mat_basic("mug", (0.36, 0.52, 0.44), 0.35)


def mug(loc):
    me = bpy.data.meshes.new("mug")
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.042, radius2=0.045, depth=0.095)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 0.0475))
    bm.to_mesh(me)
    bm.free()
    o = link(bpy.data.objects.new("mug", me))
    me.materials.append(mug_m)
    box_uv(me, 0.2)
    h = bpy.data.meshes.new("mug_handle")
    bmh = bmesh.new()
    bmesh.ops.create_cube(bmh, size=1.0)
    for v in bmh.verts:
        v.co = Vector((0.06 + v.co.x * 0.03, v.co.y * 0.012, 0.05 + v.co.z * 0.05))
    bmh.to_mesh(h)
    bmh.free()
    ho = link(bpy.data.objects.new("mug_handle", h))
    h.materials.append(mug_m)
    box_uv(h, 0.2)
    m = join([o, ho], "mug")
    m.matrix_world = Matrix.Translation(loc) @ Matrix.Rotation(math.radians(-40), 4, "Z")
    return bake_world(m)


def notebook(loc, rot_z):
    """An open notebook: two curved pages on a cover, lines on the paper."""
    paper = bpy.data.materials.new("paper")
    paper.use_nodes = True
    nt_ = paper.node_tree
    wave = nt_.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "BANDS"
    wave.bands_direction = "Y"
    wave.inputs["Scale"].default_value = 22.0
    wave.inputs["Distortion"].default_value = 0.0
    ramp = nt_.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.25, 0.27, 0.32, 1)
    ramp.color_ramp.elements[1].position = 0.12
    ramp.color_ramp.elements[1].color = (0.93, 0.90, 0.82, 1)
    tc_ = nt_.nodes.new("ShaderNodeTexCoord")
    nt_.links.new(tc_.outputs["UV"], wave.inputs["Vector"])
    nt_.links.new(wave.outputs["Fac"], ramp.inputs["Fac"])
    nt_.links.new(ramp.outputs["Color"], nt_.nodes["Principled BSDF"].inputs["Base Color"])
    cover_m = mat_basic("notebook_cover", (0.55, 0.30, 0.20), 0.6)
    w, d = 0.15, 0.21
    me = bpy.data.meshes.new("pages")
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new("UVMap")
    nx, ny = 16, 8
    grid = {}
    for side in (-1, 1):
        for i in range(nx + 1):
            for j in range(ny + 1):
                u = i / nx
                x = side * u * w
                z = 0.012 + 0.018 * math.sin(math.pi * min(u * 1.6, 1.0)) * (1 - u * 0.6)
                grid[(side, i, j)] = bm.verts.new((x, (j / ny - 0.5) * d, z))
        for i in range(nx):
            for j in range(ny):
                vs4 = [grid[(side, i, j)], grid[(side, i + 1, j)], grid[(side, i + 1, j + 1)], grid[(side, i, j + 1)]]
                if side < 0:
                    vs4.reverse()
                f = bm.faces.new(vs4)
                for lp in f.loops:
                    lp[uvl].uv = (lp.vert.co.x / w * 0.5 + 0.5, lp.vert.co.y / d + 0.5)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(paper)
    pages = link(bpy.data.objects.new("pages", me))
    cover = box("cover", -w - 0.008, w + 0.008, -d / 2 - 0.006, d / 2 + 0.006, 0.0, 0.008, cover_m, 0.3)
    nb = join([pages, cover], "notebook")
    nb.matrix_world = Matrix.Translation(loc) @ Matrix.Rotation(math.radians(rot_z), 4, "Z")
    return bake_world(nb)


today_parts = [
    coffee,
    mug((-0.86, -0.98, table_top)),
    place("Camera_01", (-1.18, -0.12, table_top), 25, dec={"*": 0.35}),
    place("potted_plant_04", (-0.88, -0.12, table_top), 0, 1.0),
    book(2, (-1.16, -1.02, table_top), 82, lying=True),
    book(7, (-1.14, -1.00, table_top + 0.03), 76, lying=True),
]
journal_parts = [notebook((-0.98, -0.60, table_top), 96)]

# desk: books, a plant in a clay pot, the lamp
desk_parts = [
    place("desk_lamp_arm_01", (2.42, 0.32, desk_top), -120, dec={"*": 0.4}),
    place("planter_pot_clay", (2.36, -0.60, desk_top), 0, 0.75, name="desk_pot"),
]
for k in range(6):
    desk_parts.append(book(k + 3, (2.47, -0.32 + k * 0.03, desk_top), -90))
desk_parts += [book(11, (2.22, 0.06, desk_top), -84, lying=True), book(12, (2.22, 0.05, desk_top + 0.03), -96, lying=True)]

# shelves: find the boards by casting down through the shelf
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
boards = []
z = 2.3
sv = [v.co for v in shelf.data.vertices]
shelf_c = Vector(((min(v.x for v in sv) + max(v.x for v in sv)) / 2, (min(v.y for v in sv) + max(v.y for v in sv)) / 2))
STATS["shelf_bbox"] = [round(min(v.x for v in sv), 3), round(max(v.x for v in sv), 3), round(min(v.y for v in sv), 3),
                       round(max(v.y for v in sv), 3), round(max(v.z for v in sv), 3)]
while z > 0.05:
    hit, loc, nrm, _i, ob, _m = scene.ray_cast(dg, Vector((shelf_c.x, shelf_c.y, z)), Vector((0, 0, -1)))
    if not hit:
        break
    if ob is not None and ob.name == shelf.name and nrm.z > 0.9:
        boards.append(loc.z)
    z = loc.z - 0.02
boards = [b for b in boards if 0.3 < b < 1.95]
STATS["shelf_boards_z"] = [round(b, 3) for b in boards]
shelf_parts = []
for r, bz in enumerate(boards[:4]):
    y = 0.92 + 0.04 * (r % 2)
    k = 0
    while y < 1.6 - r * 0.08:
        shelf_parts.append(book(r * 5 + k, (shelf_c.x + 0.02, y, bz), -90))
        y += 0.034
        k += 1

# window bench props
bench_top = bz0
sill_parts = [
    place("ceramic_vase_01", (0.95, Y1 - 0.17, bench_top), 0, 0.9),
    book(14, (-1.75, Y1 - 0.18, bench_top), 8, lying=True),
    book(15, (-1.73, Y1 - 0.18, bench_top + 0.03), -4, lying=True),
    book(16, (-1.72, Y1 - 0.17, bench_top + 0.06), 12, lying=True),
]

# plants that stay put
big_plant = place("potted_plant_01", (-0.75, 1.45, 0.0), 30, 1.0,
                  dec={"potted_plant_01_pebbles": 0.05, "potted_plant_01_leaves": 0.4})
calathea = place("calathea_orbifolia_01", (2.36, -0.60, desk_top + 0.12), 0, 0.55,
                 pick=["calathea_orbifolia_01_b"], name="calathea", recenter=True)
side_plant = place("calathea_orbifolia_01", (1.45, 1.42, top_z(side_table) + 0.0), 40, 0.6,
                   pick=["calathea_orbifolia_01_e"], name="side_plant", recenter=True)


def split_by_material(obj, prefixes, name):
    """Separate the faces whose material starts with one of prefixes into a new object."""
    idx = {i for i, m in enumerate(obj.data.materials) if m and any(m.name.startswith(p) for p in prefixes)}
    if not idx:
        return None
    new = obj.copy()
    new.data = obj.data.copy()
    link(new)
    for o, keep in ((obj, False), (new, True)):
        bm = bmesh.new()
        bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.material_index in idx) != keep], context="FACES")
        bm.to_mesh(o.data)
        bm.free()
    new.name = name
    return new


plant_leaves = split_by_material(big_plant, ["potted_plant_01_leaves"], "big_plant_leaves")

# --------------------------------------------------------------------------- the spot's two items

item_a = place("potted_plant_02", SPOT, 15, 1.3, name="spot_plant_sofa__a",
               dec={"potted_plant_02_dirt": 0.04})
pot_b = place("planter_pot_clay", SPOT, 0, 2.2, name="pot_b")
pot_h = top_z(pot_b)
plant_b = place("pachira_aquatica_01", SPOT + Vector((0, 0, pot_h * 0.55)), -20, 1.05,
                pick=["pachira_aquatica_01_bark_c", "pachira_aquatica_01_leaves_c"], name="plant_b", recenter=True)
item_b = join([pot_b, plant_b], "spot_plant_sofa__b")
ITEMS = {"a": item_a, "b": item_b}

# spot marker and the decal patch
spot_empty = link(bpy.data.objects.new("spot_plant_sofa", None))
spot_empty.location = SPOT
spot_empty["spot"] = {"kind": "plant", "surface": "floor"}
# the patch: 1.4 m around the spot, clipped to the room's floor
PATCH = 1.4
PX0, PX1 = max(SPOT.x - PATCH / 2, X0 + 0.005), SPOT.x + PATCH / 2
PY0, PY1 = SPOT.y - PATCH / 2, min(SPOT.y + PATCH / 2, Y1 - 0.005)
patch = plane("patch", PX0, PX1, PY0, PY1, 0.003, floor_m.copy(), tile=1.6, subdiv=0)
puv = patch.data.uv_layers.new(name="bake")
for poly in patch.data.polygons:
    for li in poly.loop_indices:
        co = patch.data.vertices[patch.data.loops[li].vertex_index].co
        puv.data[li].uv = ((co.x - PX0) / (PX1 - PX0), (co.y - PY0) / (PY1 - PY0))

# --------------------------------------------------------------------------- the window's city view (live)

# Each window gets a plane well outside it, textured with a render of the unclamped
# HDRI from a camera at the window. Never in a bake; unlit in three.js.
LIVE = {
    # name: camera origin, forward, plane distance, width, horizon shift (fraction of width)
    "live_window": {"origin": Vector((0.0, Y1, -0.3)), "forward": Vector((0, 1, 0)), "dist": 6.0, "width": 16.0,
                    "shift": 0.2},
    "live_window_left": {"origin": Vector((X0, (WIN_LEFT[0] + WIN_LEFT[1]) / 2, 1.0)), "forward": Vector((-1, 0, 0)),
                         "dist": 6.0, "width": 26.0, "shift": 0.05},
}
LIVE_OBJS = {}
for lname, L in LIVE.items():
    up = Vector((0, 0, 1))
    right = L["forward"].cross(up)
    w, h = L["width"], L["width"] * 9 / 16
    c = L["origin"] + L["forward"] * L["dist"] + up * (L["shift"] * w)
    lme = bpy.data.meshes.new(lname)
    lme.from_pydata([c - right * w / 2 - up * h / 2, c + right * w / 2 - up * h / 2,
                     c + right * w / 2 + up * h / 2, c - right * w / 2 + up * h / 2], [], [(0, 1, 2, 3)])
    luv = lme.uv_layers.new(name="UVMap")
    for li, uv in zip(range(4), ((0, 0), (1, 0), (1, 1), (0, 1))):
        luv.data[li].uv = uv
    lm = bpy.data.materials.new(lname)
    lm.use_nodes = True
    lme.materials.append(lm)
    LIVE_OBJS[lname] = link(bpy.data.objects.new(lname, lme))

lap("build", t)

# --------------------------------------------------------------------------- groups and atlases

# export mesh name -> (atlas, parts)
GROUPS = {
    "room_shell": ("shell", shell),
    "anchor_selfcare": ("furniture", [sofa, pillows]),
    "room_furniture": ("furniture", [armchair, side_table, desk, chair, shelf, frame1, frame2, rug]),
    "anchor_today": ("props", today_parts),
    "anchor_journal": ("props", journal_parts),
    "room_props": ("props", desk_parts + shelf_parts + sill_parts + [big_plant, calathea, side_plant]),
    "room_foliage": ("foliage", [plant_leaves]),
}
ATLAS_SIZE = {"shell": SHELL_SIZE, "furniture": SIZE, "props": SIZE, "foliage": SIZE}
ALPHA_ATLASES = {"foliage"}

# calathea and side plant leaves are alpha-tested: move them into the foliage atlas
for o in (calathea, side_plant):
    GROUPS["room_props"][1].remove(o)
    GROUPS["room_foliage"][1].append(o)

t = time.time()
EXPORT = {}
for name, (atlas, parts) in GROUPS.items():
    EXPORT[name] = (atlas, join(parts, name))
OCCLUDERS = [front_wall]  # baked as a blocker, never exported: no anchor sees it

# unique materials per atlas, so one material never needs two bake targets
_mcache = {}


def own_materials(obj, atlas):
    for slot in obj.material_slots:
        m = slot.material
        if m is None:
            continue
        key = (atlas, m.name)
        if key not in _mcache:
            _mcache[key] = m.copy()
            _mcache[key].name = atlas + "__" + m.name
        slot.material = _mcache[key]


for name, (atlas, obj) in EXPORT.items():
    own_materials(obj, atlas)
for key, obj in ITEMS.items():
    own_materials(obj, "item_" + key)
patch.data.materials[0] = patch.data.materials[0]


def uv_coverage(objs):
    """Fraction of the atlas covered by UV triangles (packing efficiency)."""
    total = 0.0
    for o in objs:
        me = o.data
        me.calc_loop_triangles()
        uv = me.uv_layers["bake"]
        a = np.empty(len(uv.data) * 2, np.float32)
        uv.data.foreach_get("uv", a)
        a = a.reshape(-1, 2)
        lt = np.empty(len(me.loop_triangles) * 3, np.int32)
        me.loop_triangles.foreach_get("loops", lt)
        lt = lt.reshape(-1, 3)
        p0, p1, p2 = a[lt[:, 0]], a[lt[:, 1]], a[lt[:, 2]]
        total += float(np.abs((p1[:, 0] - p0[:, 0]) * (p2[:, 1] - p0[:, 1])
                              - (p2[:, 0] - p0[:, 0]) * (p1[:, 1] - p0[:, 1])).sum() / 2)
    return round(total, 3)


def mark_degenerate_uv(o):
    """Select the faces of o whose bake UVs have (almost) no area; return how many."""
    me = o.data
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    uv = me.uv_layers["bake"]
    a = np.empty(len(uv.data) * 2, np.float32)
    uv.data.foreach_get("uv", a)
    a = a.reshape(-1, 2)
    co = np.empty(len(me.vertices) * 3, np.float32)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    lt = np.empty(n * 3, np.int32)
    me.loop_triangles.foreach_get("loops", lt)
    lt = lt.reshape(-1, 3)
    vt = np.empty(n * 3, np.int32)
    me.loop_triangles.foreach_get("vertices", vt)
    vt = vt.reshape(-1, 3)
    pi = np.empty(n, np.int32)
    me.loop_triangles.foreach_get("polygon_index", pi)
    p0, p1, p2 = a[lt[:, 0]], a[lt[:, 1]], a[lt[:, 2]]
    uva = 0.5 * np.abs((p1[:, 0] - p0[:, 0]) * (p2[:, 1] - p0[:, 1]) - (p2[:, 0] - p0[:, 0]) * (p1[:, 1] - p0[:, 1]))
    a3 = 0.5 * np.linalg.norm(np.cross(co[vt[:, 1]] - co[vt[:, 0]], co[vt[:, 2]] - co[vt[:, 0]]), axis=1)
    puv = np.zeros(len(me.polygons))
    p3 = np.zeros(len(me.polygons))
    np.add.at(puv, pi, uva)
    np.add.at(p3, pi, a3)
    ratio = puv / np.maximum(p3, 1e-12)
    med = np.median(ratio[p3 > 1e-10]) if (p3 > 1e-10).any() else 1.0
    bad = (p3 > 1e-10) & (ratio < med * 1e-3)
    me.polygons.foreach_set("select", bad)
    return int(bad.sum())


def unwrap(objs, margin):
    for o in objs:
        o.data.update()  # transformed and joined meshes carry stale normals; smart_project needs real ones
        if "bake" not in o.data.uv_layers:
            o.data.uv_layers.new(name="bake")
        o.data.uv_layers.active = o.data.uv_layers["bake"]
        for uv in o.data.uv_layers:
            uv.active_render = uv.name == "UVMap"
    # faces whose own UVs are degenerate (book page edges map to a line) would blow up
    # when islands are rescaled to their 3D area: give those a fresh projection
    reproject = 0
    for o in objs:
        reproject += mark_degenerate_uv(o)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.mode_set(mode="EDIT")
    if reproject:
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.0, area_weight=0.0,
                                 correct_aspect=False, scale_to_bounds=False)
    bpy.ops.mesh.select_all(action="SELECT")
    # The bake set starts as a copy of each asset's own UVs (Poly Haven unwraps are clean
    # and non-overlapping; ours are box projections). Islands are rescaled to their 3D
    # area, so texel density is even across the atlas, then packed together.
    scene.tool_settings.use_uv_select_sync = True
    bpy.ops.uv.select_all(action="SELECT")
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.pack_islands(udim_source="CLOSEST_UDIM", rotate=True, rotate_method="ANY", scale=True,
                            merge_overlap=False, margin_method="FRACTION", margin=margin, pin=False,
                            shape_method=PACK_SHAPE)
    bpy.ops.object.mode_set(mode="OBJECT")
    # headless, pack_islands leaves the layout at its 3D scale (it can run past 1.0):
    # fit the whole atlas into the unit square with one uniform scale
    arrs = []
    for o in objs:
        uv = o.data.uv_layers["bake"]
        a = np.empty(len(uv.data) * 2, np.float32)
        uv.data.foreach_get("uv", a)
        arrs.append(a.reshape(-1, 2))
    allp = np.concatenate(arrs)
    lo, hi = allp.min(0), allp.max(0)
    k = (1.0 - 2 * margin) / float((hi - lo).max())
    for o, a in zip(objs, arrs):
        o.data.uv_layers["bake"].data.foreach_set("uv", ((a - lo) * k + margin).ravel())
    return round(float(k), 4)


by_atlas = {}
for name, (atlas, obj) in EXPORT.items():
    by_atlas.setdefault(atlas, []).append(obj)
for atlas, objs in by_atlas.items():
    STATS["atlases"].setdefault(atlas, {})["uv_scale"] = unwrap(objs, 1.0 / 1024)
for key, obj in ITEMS.items():
    unwrap([obj], 1.0 / 512)
lap("unwrap", t)

for name, (atlas, obj) in EXPORT.items():
    STATS["meshes"][name] = {"atlas": atlas, "triangles": tris(obj)}
for key, obj in ITEMS.items():
    STATS["items"][key] = {"triangles": tris(obj)}
STATS["triangles_room"] = sum(m["triangles"] for m in STATS["meshes"].values())
print("triangles", STATS["triangles_room"], STATS["meshes"], STATS["items"], flush=True)

# --------------------------------------------------------------------------- cameras


def to_gltf(v):
    return [round(v[0], 4), round(v[2], 4), round(-v[1], 4)]


def make_camera(name, spec, aspect=16 / 9):
    cam = bpy.data.cameras.new("view_" + name)
    cam.sensor_fit = "VERTICAL"
    cam.angle_y = math.radians(spec["vfov"])
    cam.clip_start = 0.05
    co = link(bpy.data.objects.new("view_" + name, cam))
    co.location = spec["pos"]
    d = Vector(spec["target"]) - Vector(spec["pos"])
    co.rotation_mode = "QUATERNION"
    co.rotation_quaternion = d.to_track_quat("-Z", "Y")
    return co


ANCHORS = {}
for name, spec in CAMERAS.items():
    make_camera(name, spec)
    ANCHORS[name] = {"position": to_gltf(spec["pos"]), "target": to_gltf(spec["target"]), "fov": spec["vfov"]}
for name in ("today", "journal", "selfcare"):
    EXPORT["anchor_" + name][1]["camera"] = ANCHORS[name]
cam_empty = link(bpy.data.objects.new("cam_overview", None))
cam_empty["camera"] = ANCHORS["overview"]
spot_empty["camera_hint"] = "selfcare"

# --------------------------------------------------------------------------- render helpers


def set_visible(objs, visible):
    for o in objs:
        o.hide_render = not visible


def render_view(cam_name, path, w=1280, h=720, samples=64):
    scene.camera = bpy.data.objects["view_" + cam_name]
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    cy.samples = samples
    cy.use_denoising = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    cy.use_denoising = False
    cy.samples = SAMPLES


def render_backdrop(L, path):
    """A window's city view: the unclamped HDRI as a camera at the window sees it."""
    hidden = [o for o in scene.objects if o.type == "MESH" and not o.hide_render]
    set_visible(hidden, False)
    cam = bpy.data.cameras.new("backdrop")
    cam.sensor_fit = "HORIZONTAL"
    cam.angle_x = 2 * math.atan((L["width"] / 2) / L["dist"])
    cam.shift_y = L["shift"]
    co = link(bpy.data.objects.new("backdrop", cam))
    co.location = L["origin"]
    co.rotation_mode = "QUATERNION"
    co.rotation_quaternion = L["forward"].to_track_quat("-Z", "Y")
    scene.camera = co
    old_exp = vs.exposure
    vs.exposure = BACKDROP_EXPOSURE
    scene.render.resolution_x, scene.render.resolution_y = (1024, 576) if QUICK else (2048, 1152)
    cy.samples = 8
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    vs.exposure = old_exp
    cy.samples = SAMPLES
    set_visible(hidden, True)


ITEM_OBJS = list(ITEMS.values())
set_visible(ITEM_OBJS + [patch], False)
LIVE_PNG = {}
t = time.time()
for lname, L in LIVE.items():
    LIVE_PNG[lname] = os.path.join(TEX, lname + ".png")
    render_backdrop(L, LIVE_PNG[lname])
lap("backdrop", t)
set_visible(LIVE_OBJS.values(), False)  # never in a bake

if PREVIEWS:
    t = time.time()
    # the backdrops are shown through the windows by the live planes, emissive here and seen
    # by camera rays only (they pass through AgX a second time, so the windows read brighter)
    for lname, lo in LIVE_OBJS.items():
        lo.hide_render = False
        nt = lo.data.materials[0].node_tree
        nt.nodes.clear()
        em = nt.nodes.new("ShaderNodeEmission")
        tx = nt.nodes.new("ShaderNodeTexImage")
        tx.image = bpy.data.images.load(LIVE_PNG[lname])
        o_ = nt.nodes.new("ShaderNodeOutputMaterial")
        nt.links.new(tx.outputs["Color"], em.inputs["Color"])
        nt.links.new(em.outputs["Emission"], o_.inputs["Surface"])
        lo.visible_diffuse = False
        lo.visible_glossy = False
        lo.visible_shadow = False
        lo.visible_transmission = False
    for k, show in (("a", item_a), (None, None)):
        set_visible(ITEM_OBJS, False)
        if show:
            show.hide_render = False
        for cname in (CAMERAS if k else ["overview"]):
            render_view(cname, os.path.join(OUT, "preview_%s%s.png" % (cname, "_a" if k else "_empty")),
                        960 if QUICK else 1280, 540 if QUICK else 720, 32 if QUICK else 128)
    set_visible(ITEM_OBJS, False)
    set_visible(LIVE_OBJS.values(), False)
    lap("previews", t)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "room.blend"))

if NO_BAKE:
    with open(os.path.join(OUT, "build-stats.json"), "w") as f:
        json.dump(STATS, f, indent=2)
    print("done (no bake)")
    sys.exit(0)

# --------------------------------------------------------------------------- bake

sb = scene.render.bake
sb.use_pass_direct = True
sb.use_pass_indirect = True
sb.use_pass_diffuse = True
sb.use_pass_glossy = False
sb.use_pass_transmission = True
sb.use_pass_emit = True
sb.target = "IMAGE_TEXTURES"
sb.margin_type = "EXTEND"
sb.use_clear = True


def attach_target(objs, img):
    for o in objs:
        for slot in o.material_slots:
            m = slot.material
            nt_ = m.node_tree
            n = nt_.nodes.get("BAKE_TARGET") or nt_.nodes.new("ShaderNodeTexImage")
            n.name = "BAKE_TARGET"
            n.image = img
            for other in nt_.nodes:
                other.select = False
            n.select = True
            nt_.nodes.active = n


def bake(objs, img, kind="COMBINED", margin=8):
    attach_target(objs, img)
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    sb.margin = margin
    bpy.ops.object.bake(type=kind, uv_layer="bake", margin=margin, use_clear=True)


def alpha_bake(objs, img, margin):
    """Bake each material's alpha as emission, to cut the leaves out of the atlas."""
    saved = []
    for o in objs:
        for slot in o.material_slots:
            nt_ = slot.material.node_tree
            out = next(n for n in nt_.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output)
            prev = out.inputs["Surface"].links[0].from_socket if out.inputs["Surface"].links else None
            em = nt_.nodes.new("ShaderNodeEmission")
            em.name = "ALPHA_EMIT"
            bsdf = next((n for n in nt_.nodes if n.type == "BSDF_PRINCIPLED"), None)
            a_in = bsdf.inputs["Alpha"] if bsdf else None
            if a_in is not None and a_in.links:
                nt_.links.new(a_in.links[0].from_socket, em.inputs["Color"])
            else:
                a = a_in.default_value if a_in is not None else 1.0
                em.inputs["Color"].default_value = (a, a, a, 1)
            nt_.links.new(em.outputs["Emission"], out.inputs["Surface"])
            saved.append((nt_, out, prev, em))
    bake(objs, img, "EMIT", margin)
    for nt_, out, prev, em in saved:
        nt_.nodes.remove(em)
        if prev is not None:
            nt_.links.new(prev, out.inputs["Surface"])


# compositor scene for OIDN denoising and the view transform
dn = bpy.data.scenes.new("denoise")
dn.render.engine = "BLENDER_WORKBENCH"
dn.display_settings.display_device = "sRGB"
dn.view_settings.view_transform = vs.view_transform
dn.view_settings.look = vs.look
dn.view_settings.exposure = vs.exposure
dn.use_nodes = True
dn.render.use_compositing = True
dn.render.resolution_percentage = 100
dcam = bpy.data.objects.new("dn_cam", bpy.data.cameras.new("dn_cam"))
dn.collection.objects.link(dcam)
dn.camera = dcam
ntc = dn.node_tree
ntc.nodes.clear()
c_img = ntc.nodes.new("CompositorNodeImage")
c_dn = ntc.nodes.new("CompositorNodeDenoise")
c_dn.use_hdr = True
c_dn.prefilter = "ACCURATE"
if hasattr(c_dn, "quality"):
    c_dn.quality = "HIGH"
c_out = ntc.nodes.new("CompositorNodeComposite")
ntc.links.new(c_img.outputs["Image"], c_dn.inputs["Image"])
ntc.links.new(c_dn.outputs["Image"], c_out.inputs["Image"])


def finish(img, path, depth="8", denoise=True):
    """Denoise a float bake and write it through the view transform."""
    w, h = img.size
    dn.render.resolution_x, dn.render.resolution_y = w, h
    c_img.image = img
    if denoise:
        ntc.links.new(c_dn.outputs["Image"], c_out.inputs["Image"])
    else:
        ntc.links.new(c_img.outputs["Image"], c_out.inputs["Image"])
    dn.render.image_settings.file_format = "PNG"
    dn.render.image_settings.color_mode = "RGB"
    dn.render.image_settings.color_depth = depth
    dn.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=dn.name)
    return path


def load_raw(path):
    im = bpy.data.images.load(path, check_existing=False)
    im.colorspace_settings.name = "Non-Color"
    w, h = im.size
    a = np.empty(w * h * 4, np.float32)
    im.pixels.foreach_get(a)
    bpy.data.images.remove(im)
    return a.reshape(h, w, 4)


def save_raw(arr, path, alpha=False):
    h, w = arr.shape[:2]
    im = bpy.data.images.new(os.path.basename(path), w, h, alpha=alpha)
    im.colorspace_settings.name = "Non-Color"
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :arr.shape[2]] = arr
    im.pixels.foreach_set(rgba.ravel())
    im.filepath_raw = path
    im.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA" if alpha else "RGB"
    im.save()
    bpy.data.images.remove(im)
    return path


def new_float(name, size):
    im = bpy.data.images.new(name, size, size, alpha=True, float_buffer=True)
    im.generated_color = (0, 0, 0, 1)
    return im


ATLAS_PNG = {}
for atlas, objs in by_atlas.items():
    t = time.time()
    size = ATLAS_SIZE[atlas]
    img = new_float("bake_" + atlas, size)
    margin = max(4, size // 256)
    bake(objs, img, "COMBINED", margin)
    lap("bake_" + atlas, t)
    _px = np.empty(size * size * 4, np.float32)
    img.pixels.foreach_get(_px)
    print("bake mean", atlas, float(_px.reshape(-1, 4)[:, :3].mean()), flush=True)
    t = time.time()
    png = finish(img, os.path.join(TMP, atlas + "_rgb.png"))
    out_png = os.path.join(TEX, atlas + ".png")
    rgb = load_raw(png)[..., :3]
    if atlas in ALPHA_ATLASES:
        aimg = new_float("alpha_" + atlas, size)
        alpha_bake(objs, aimg, margin)
        a = np.empty(size * size * 4, np.float32)
        aimg.pixels.foreach_get(a)
        a = (a.reshape(size, size, 4)[..., :1] > 0.5).astype(np.float32)
        save_raw(np.concatenate([rgb, a], axis=2), out_png, alpha=True)
    else:
        save_raw(rgb, out_png)
    ATLAS_PNG[atlas] = out_png
    STATS["atlases"][atlas].update({"size": size, "alpha": atlas in ALPHA_ATLASES, "samples": SAMPLES,
                                    "meshes": [o.name for o in objs], "uv_coverage": uv_coverage(objs)})
    lap("finish_" + atlas, t)

def needs_alpha(obj):
    """True when any of the object's materials cuts out (its Alpha is textured or below 1)."""
    for slot in obj.material_slots:
        bsdf = next((n for n in slot.material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if bsdf and (bsdf.inputs["Alpha"].links or bsdf.inputs["Alpha"].default_value < 1.0):
            return True
    return False


# items: baked in place, the room around them, one at a time
patch.hide_render = True
for key, obj in ITEMS.items():
    t = time.time()
    set_visible(ITEM_OBJS, False)
    obj.hide_render = False
    img = new_float("bake_item_" + key, ITEM_SIZE)
    bake([obj], img, "COMBINED", 4)
    rgb = load_raw(finish(img, os.path.join(TMP, "item_%s_rgb.png" % key)))[..., :3]
    aimg = new_float("alpha_item_" + key, ITEM_SIZE)
    alpha_bake([obj], aimg, 4)
    a = np.empty(ITEM_SIZE * ITEM_SIZE * 4, np.float32)
    aimg.pixels.foreach_get(a)
    a = (a.reshape(ITEM_SIZE, ITEM_SIZE, 4)[..., :1] > 0.5).astype(np.float32)
    has_alpha = needs_alpha(obj)  # texels outside the islands are 0 anyway; ask the materials
    ATLAS_PNG["item_" + key] = save_raw(np.concatenate([rgb, a], axis=2) if has_alpha else rgb,
                                        os.path.join(TEX, "item_%s.png" % key), alpha=has_alpha)
    STATS["items"][key].update({"size": ITEM_SIZE, "alpha": has_alpha})
    lap("bake_item_" + key, t)

# decals: the floor patch with and without each item, ratio after the view transform
t = time.time()
patch.hide_render = False
set_visible(ITEM_OBJS, False)
pimg = new_float("patch_empty", DECAL_SIZE)
bake([patch], pimg, "COMBINED", 2)
empty = load_raw(finish(pimg, os.path.join(TMP, "patch_empty.png"), "16"))[..., :3]
yy, xx = np.mgrid[0:DECAL_SIZE, 0:DECAL_SIZE] / (DECAL_SIZE - 1)
edge = np.minimum.reduce([xx, 1 - xx, yy, 1 - yy])
fade = np.clip(edge / 0.12, 0, 1)[..., None]
fade = fade * fade * (3 - 2 * fade)
for key, obj in ITEMS.items():
    obj.hide_render = False
    pimg = new_float("patch_" + key, DECAL_SIZE)
    bake([patch], pimg, "COMBINED", 2)
    withi = load_raw(finish(pimg, os.path.join(TMP, "patch_%s.png" % key), "16"))[..., :3]
    obj.hide_render = True
    # under the sofa both bakes are near black and the ratio is noise: leave it at 1
    lit = empty.mean(axis=2, keepdims=True) > 0.03
    ratio = np.where(lit, np.clip(withi / np.maximum(empty, 1e-3), 0, 1), 1.0)
    shade = np.clip((1 - ratio) - 0.015, 0, 1) / 0.985
    ratio = 1 - shade * fade
    ATLAS_PNG["item_%s_shadow" % key] = save_raw(ratio, os.path.join(TEX, "item_%s_shadow.png" % key))
    STATS["items"][key]["shadow_min"] = round(float(ratio.min()), 3)
patch.hide_render = True
lap("decals", t)

# --------------------------------------------------------------------------- export


def atlas_material(name, png, alpha=False, multiply=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt_ = m.node_tree
    bsdf = nt_.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 1.0
    tx = nt_.nodes.new("ShaderNodeTexImage")
    tx.image = bpy.data.images.load(png, check_existing=True)
    nt_.links.new(tx.outputs["Color"], bsdf.inputs["Base Color"])
    if alpha:
        rnd = nt_.nodes.new("ShaderNodeMath")
        rnd.operation = "ROUND"
        nt_.links.new(tx.outputs["Alpha"], rnd.inputs[0])
        nt_.links.new(rnd.outputs[0], bsdf.inputs["Alpha"])
        m.use_backface_culling = False
    else:
        m.use_backface_culling = False
    if multiply:
        m["decal"] = "multiply"
    return m


def finalize(obj, mat):
    me = obj.data
    for uv in list(me.uv_layers):
        if uv.name != "bake":
            me.uv_layers.remove(uv)
    me.uv_layers["bake"].name = "UVMap"
    me.materials.clear()
    me.materials.append(mat)
    for p in me.polygons:
        p.material_index = 0


mats = {a: atlas_material("atlas_" + a, p, alpha=a in ALPHA_ATLASES) for a, p in ATLAS_PNG.items()
        if a in ATLAS_SIZE}
for name, (atlas, obj) in EXPORT.items():
    finalize(obj, mats[atlas])
for lname, lo in LIVE_OBJS.items():
    lo.data.materials.clear()
    lo.data.materials.append(atlas_material(lname, LIVE_PNG[lname]))


def export(path, objs):
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.hide_render = False
        o.hide_set(False)
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.export_scene.gltf(filepath=path, export_format="GLB", use_selection=True, export_extras=True,
                              export_yup=True, export_normals=False, export_tangents=False,
                              export_cameras=False, export_lights=False, export_animations=False,
                              export_skins=False, export_morph=False, export_texcoords=True,
                              export_materials="EXPORT", export_image_format="AUTO")
    return os.path.getsize(path)


room_objs = [o for _a, o in EXPORT.values()] + list(LIVE_OBJS.values()) + [spot_empty, cam_empty]
STATS["room_glb_bytes_png"] = export(os.path.join(OUT, "room.glb"), room_objs)

for key, obj in ITEMS.items():
    finalize(obj, atlas_material("item_" + key, ATLAS_PNG["item_" + key], alpha=STATS["items"][key]["alpha"]))
    dec_me = bpy.data.meshes.new("shadow_" + key)
    dec_me.from_pydata([(PX0, PY0, 0.003), (PX1, PY0, 0.003), (PX1, PY1, 0.003), (PX0, PY1, 0.003)],
                       [], [(0, 1, 2, 3)])
    uvd = dec_me.uv_layers.new(name="UVMap")
    for li, uv in zip(range(4), ((0, 0), (1, 0), (1, 1), (0, 1))):
        uvd.data[li].uv = uv
    dec = link(bpy.data.objects.new("spot_plant_sofa__%s_shadow" % key, dec_me))
    dec_me.materials.append(atlas_material("shadow_" + key, ATLAS_PNG["item_%s_shadow" % key], multiply=True))
    dec["decal"] = "multiply"
    obj["spot"] = "spot_plant_sofa"
    STATS["items"][key]["glb_bytes_png"] = export(os.path.join(OUT, "item_%s.glb" % key), [obj, dec])

with open(os.path.join(OUT, "anchors.json"), "w") as f:
    json.dump({"space": "glTF, Y up, metres", "anchors": ANCHORS,
               "spot": {"name": "spot_plant_sofa", "position": to_gltf(SPOT)}}, f, indent=2)
STATS["anchors"] = ANCHORS
STATS["total_s"] = round(time.time() - T0, 1)
with open(os.path.join(OUT, "build-stats.json"), "w") as f:
    json.dump(STATS, f, indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "room_baked.blend"))
print("done", STATS["total_s"], "s")
