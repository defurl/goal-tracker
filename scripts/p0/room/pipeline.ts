/**
 * P0 3D test — the asset pipeline (design-system/v2/05-room.md, "Pipeline").
 *
 * Takes the GLBs build_room.py baked (.p0/build, or another folder) and writes
 * three variants under .p0/out/<variant>/, all with meshopt geometry:
 *
 *   png   textures as baked (the "source PNGs" the design team would hand over)
 *   webp  every texture WebP
 *   jpeg  opaque textures JPEG; textures with alpha (the foliage atlas, item A)
 *         stay WebP, because JPEG has no alpha channel
 *
 * KTX2 is not here: KTX-Software is not approved for this test (see report).
 *
 * Then it reads every output GLB's JSON chunk and records each texture's bytes,
 * format and size, the GLB's raw, gzip and brotli bytes, and each lossy
 * texture's PSNR against its PNG source (ffmpeg). Writes .p0/out/pipeline.json.
 *
 * Usage: node scripts/p0/room/pipeline.ts [--in .p0/build] [--suffix ""] [--quality 85]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = argv.indexOf(name);
  return i >= 0 ? (argv[i + 1] ?? def) : def;
};
const IN = join(ROOT, opt('--in', '.p0/build'));
const SUFFIX = opt('--suffix', '');
const QUALITY = opt('--quality', '85');
const OUT = join(ROOT, '.p0', 'out');
const TMP = join(OUT, 'tmp');
const CLI = ['dlx', '@gltf-transform/cli@4.5.1'];

/** Opaque baked textures (no alpha): these may go to JPEG. */
const OPAQUE = '{shell,furniture,props,live_window,item_b,item_a_shadow,item_b_shadow}';
const ALPHA = '{foliage,item_a}';

const KTX_BIN = process.env.KTX_BIN ?? 'C:/Users/Admin/tools/ktx/bin';
const VARIANTS = ['png', 'webp', 'jpeg', 'etc1s', 'uastc'];

function gt(args: string[]): void {
  execFileSync('pnpm', [...CLI, ...args], {
    stdio: ['ignore', 'ignore', 'inherit'],
    shell: process.platform === 'win32',
    cwd: TMP,
    // KTX-Software (ktx / toktx) for the etc1s and uastc commands, on PATH for this process only
    env: { ...process.env, PATH: `${KTX_BIN}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}` },
  });
}

export interface TextureRecord {
  name: string;
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
  psnrVsPng?: number;
}

export interface GlbRecord {
  file: string;
  bytes: number;
  gzipBytes: number;
  brotliBytes: number;
  geometryBytes: number;
  textures: TextureRecord[];
  meshes: string[];
}

interface GltfJson {
  images?: { name?: string; mimeType?: string; bufferView?: number }[];
  bufferViews?: { byteLength: number }[];
  nodes?: { name?: string; mesh?: number }[];
}

/** Width and height from a PNG, JPEG or WebP header. */
function imageSize(b: Buffer, mime: string): { width: number; height: number } {
  if (mime === 'image/png') return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (mime === 'image/ktx2') return { width: b.readUInt32LE(20), height: b.readUInt32LE(24) };
  if (mime === 'image/webp') {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
    if (kind === 'VP8L') {
      const bits = b.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  }
  let i = 2;
  while (i < b.length) {
    const marker = b.readUInt16BE(i);
    const len = b.readUInt16BE(i + 2);
    if (marker >= 0xffc0 && marker <= 0xffc3) return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
    i += 2 + len;
  }
  return { width: 0, height: 0 };
}

export function readGlb(file: string): { json: GltfJson; images: { name: string; mime: string; data: Buffer }[] } {
  const b = readFileSync(file);
  const jsonLen = b.readUInt32LE(12);
  const json = JSON.parse(b.toString('utf8', 20, 20 + jsonLen)) as GltfJson & {
    bufferViews?: { byteOffset?: number; byteLength: number }[];
  };
  const binStart = 20 + jsonLen + 8;
  const images = (json.images ?? []).map((img, i) => {
    const bv = json.bufferViews?.[img.bufferView ?? -1];
    const off = binStart + (bv?.byteOffset ?? 0);
    return { name: img.name ?? `image${i}`, mime: img.mimeType ?? '', data: b.subarray(off, off + (bv?.byteLength ?? 0)) };
  });
  return { json, images };
}

function psnr(a: string, b: string): number | undefined {
  try {
    const out = execFileSync('ffmpeg', ['-v', 'info', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-'], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const m = /average:([0-9.]+|inf)/.exec(out.toString());
    return m?.[1] ? (m[1] === 'inf' ? 99 : +m[1]) : undefined;
  } catch (e) {
    const s = String((e as { stderr?: Buffer }).stderr ?? '');
    const m = /average:([0-9.]+|inf)/.exec(s);
    return m?.[1] ? +m[1] : undefined;
  }
}

function record(file: string, pngImages?: Map<string, string>): GlbRecord {
  const raw = readFileSync(file);
  const { json, images } = readGlb(file);
  const texBytes = images.reduce((s, i) => s + i.data.length, 0);
  const textures: TextureRecord[] = images.map((img) => {
    const rec: TextureRecord = { name: img.name, mimeType: img.mime, bytes: img.data.length, ...imageSize(img.data, img.mime) };
    const src = pngImages?.get(img.name);
    if (src && (img.mime === 'image/webp' || img.mime === 'image/jpeg')) {
      const ext = img.mime === 'image/webp' ? 'webp' : 'jpg';
      const tmp = join(TMP, `psnr_${img.name}.${ext}`);
      writeFileSync(tmp, img.data);
      rec.psnrVsPng = psnr(src, tmp);
    }
    return rec;
  });
  return {
    file: file.slice(ROOT.length + 1).replace(/\\/g, '/'),
    bytes: raw.length,
    gzipBytes: gzipSync(raw, { level: 9 }).length,
    brotliBytes: brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length,
    geometryBytes: raw.length - texBytes,
    textures,
    meshes: (json.nodes ?? []).filter((n) => n.mesh !== undefined).map((n) => n.name ?? ''),
  };
}

function main(): void {
  for (const d of VARIANTS) mkdirSync(join(OUT, d), { recursive: true });
  rmSync(TMP, { recursive: true, force: true });
  mkdirSync(TMP, { recursive: true });
  const results: Record<string, Record<string, GlbRecord>> = { png: {}, webp: {}, jpeg: {}, etc1s: {}, uastc: {}, source: {} };
  const names = readdirSync(IN).filter((f) => f.endsWith('.glb')).map((f) => f.replace(/\.glb$/, ''));
  for (const name of names) {
    const src = join(IN, `${name}.glb`);
    const outName = name === 'room' ? `room${SUFFIX}` : name;
    if (SUFFIX && name !== 'room') continue; // a room-only variant (e.g. the 4096 shell)
    // textures first, meshopt last: re-writing a meshopt file without its encoder drops the compression
    const pngMap = new Map<string, string>();
    for (const img of readGlb(src).images) {
      const p = join(TMP, `src_${outName}_${img.name}.png`);
      writeFileSync(p, img.data);
      pngMap.set(img.name, p);
    }
    const mo = ['--level', 'high', '--quantize-texcoord', '14'];
    console.log('png', name);
    gt(['meshopt', src, join(OUT, 'png', `${outName}.glb`), ...mo]);
    console.log('webp', name);
    const w = join(TMP, `${outName}_w.glb`);
    // item A needs q75 to fit the 300 KB item budget; everything else stays at QUALITY
    gt(['webp', src, w, '--formats', 'png', '--quality', name === 'item_a' ? '75' : QUALITY]);
    gt(['meshopt', w, join(OUT, 'webp', `${outName}.glb`), ...mo]);
    console.log('jpeg', name);
    const j1 = join(TMP, `${outName}_j1.glb`);
    const j2 = join(TMP, `${outName}_j2.glb`);
    gt(['jpeg', src, j1, '--formats', 'png', '--pattern', OPAQUE, '--quality', QUALITY]);
    gt(['webp', j1, j2, '--formats', 'png', '--pattern', ALPHA, '--quality', QUALITY]);
    gt(['meshopt', j2, join(OUT, 'jpeg', `${outName}.glb`), ...mo]);
    // KTX2: ETC1S everywhere; and a comparison with the shell atlas in UASTC, the rest ETC1S
    console.log('etc1s', name);
    const k1 = join(TMP, `${outName}_k1.glb`);
    gt(['etc1s', src, k1]);
    gt(['meshopt', k1, join(OUT, 'etc1s', `${outName}.glb`), ...mo]);
    console.log('uastc', name);
    const u1 = join(TMP, `${outName}_u1.glb`);
    const u2 = join(TMP, `${outName}_u2.glb`);
    if (name === 'room') {
      gt(['uastc', src, u1, '--pattern', 'shell', '--level', '2', '--rdo', '--zstd', '18']);
      gt(['etc1s', u1, u2, '--pattern', '{furniture,props,foliage,live_window,live_window_left}']);
    } else {
      gt(['etc1s', src, u2]);
    }
    gt(['meshopt', u2, join(OUT, 'uastc', `${outName}.glb`), ...mo]);
    results.source![outName] = record(src);
    for (const v of VARIANTS) results[v]![outName] = record(join(OUT, v, `${outName}.glb`), pngMap);
  }
  // what it would take for a catalogue item to fit 300 KB: lower WebP quality, or a 768 texture
  const itemProbe: Record<string, number> = {};
  if (!SUFFIX && existsSync(join(IN, 'item_a.glb'))) {
    mkdirSync(join(OUT, 'probe'), { recursive: true });
    for (const [label, steps] of [
      ['webp_q75', [['webp', '--formats', 'png', '--quality', '75']]],
      ['resize768_webp_q85', [['resize', '--width', '768', '--height', '768'], ['webp', '--formats', 'png', '--quality', QUALITY]]],
    ] as const) {
      let cur = join(IN, 'item_a.glb');
      steps.forEach((step, i) => {
        const next = join(TMP, `item_a_${label}_${i}.glb`);
        const [cmd, ...rest] = step;
        gt([cmd, cur, next, ...rest]);
        cur = next;
      });
      const out = join(OUT, 'probe', `item_a_${label}.glb`);
      gt(['meshopt', cur, out, '--level', 'high', '--quantize-texcoord', '14']);
      itemProbe[label] = readFileSync(out).length;
    }
  }
  const file = join(OUT, `pipeline${SUFFIX}.json`);
  const prev = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as object) : {};
  writeFileSync(file, JSON.stringify({ ...prev, quality: +QUALITY, input: IN.slice(ROOT.length + 1), results, itemProbe }, null, 2));
  for (const v of ['png', 'webp', 'jpeg']) {
    for (const [n, r] of Object.entries(results[v] ?? {})) {
      console.log(v.padEnd(5), n.padEnd(10), String(r.bytes).padStart(9), 'B; textures', r.textures.map((t) => `${t.name}:${t.bytes}`).join(' '));
    }
  }
}

main();
