// 3.6 — the bonsai. D-11 (LOCKED), design-system/12 §3.2, spec/02 F2, spec/05 §3–4.
//
// On the desk at [-0.8, 0, 0.1], capped at 0.35 m so it never occludes
// monitor 1. Primitives only: a shallow pot, a tapered S-curve trunk, four
// branch pads. Leaves are ONE InstancedMesh of MAX_LEAVES (lib/growth.ts) —
// one draw call — and `points.leafCount` decides how many are grown.
//
// Growth, and only growth (11-anti-patterns.md: never shrink, wilt or drop):
//   - a new leaf is announced by the one sharp motion the room allows, a
//     GLOW_COOL droplet falling into the pot over --dur-tick (180 ms), then
//     the leaf grows from nothing over --dur-reveal (900 ms). No spring.
//   - leaves already earned when the room loads are simply there.
//   - under reduced motion there is no droplet and a new leaf is there at once.
//   - the count falls only when the store resets to the default room (sign
//     out); that is a different room, not a tree losing leaves, so it snaps.
//
// Eight BASE leaves are always there, on top of the earned ones. PROPOSED: a
// new user's bonsai with no leaves at all reads as a dead tree, which is the
// wilting plant the anti-patterns forbid. With them it reads as a young tree,
// and every earned leaf is still one per unit of `leafCount` (spec/05 §3).
//
// Colours are all derived from tokens, no new ones: leaves are DATA_GREEN at
// LEAF_TONE (spec/02 F2 — a leaf IS live data), bark is LAMP_WARM at 0.09, a dark
// warm brown. Nothing here is emissive except the brief droplet.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Object3D, Quaternion, Vector3, type InstancedMesh, type Mesh } from 'three';

import { MAX_LEAVES } from '../../lib/growth';
import { useAppStore } from '../../lib/stores/app';
import { useSceneStore } from '../../lib/stores/scene';
import { BG_VOID, DATA_GREEN, GLOW_COOL, INK_GHOST, LAMP_WARM } from '../../lib/style/colors';

export const BONSAI_POSITION: [number, number, number] = [-0.8, 0, 0.1];

const POT = { w: 0.15, h: 0.045, d: 0.1 };

type P = [number, number, number];

/** Trunk joints, pot surface upward — a gentle S, as bonsai are trained. */
const TRUNK: P[] = [
  [0, POT.h, 0],
  [-0.016, 0.1, 0.006],
  [0.012, 0.16, 0],
  [-0.006, 0.22, -0.006],
  [0.004, 0.27, 0],
];
const TRUNK_RADII = [0.011, 0.009, 0.0075, 0.006, 0.0045];

/** Foliage pads: where each branch ends and its leaves cluster. Top pad stays under 0.35 m. */
const PADS: { centre: P; from: number; radius: P }[] = [
  { centre: [0.065, 0.17, 0.012], from: 2, radius: [0.045, 0.016, 0.034] },
  { centre: [-0.07, 0.205, -0.004], from: 3, radius: [0.042, 0.016, 0.032] },
  { centre: [0.04, 0.262, -0.012], from: 4, radius: [0.036, 0.014, 0.028] },
  { centre: [-0.012, 0.305, 0.008], from: 4, radius: [0.032, 0.013, 0.026] },
];

const LEAF_SIZE = 0.011;
/**
 * DATA_GREEN's scalar. The spec's 0.35 is the portfolio plant's, which never
 * sat under a bulb; here the top pad is ~12 cm from it and at 0.35 its leaves
 * clipped to a lime-white, the hottest pixels in the lamp pool. PROPOSED.
 */
const LEAF_TONE = 0.25;
/** The whole tree, so the canopy sits further below the bulb. Top pad ≈ 0.29 m. */
const TREE_SCALE = 0.88;
/** Flattened, so leaves read as foliage pads rather than beads. */
const LEAF_SHAPE: P = [1.5, 0.55, 1.15];
const BASE_LEAVES = 8;
const TOTAL = BASE_LEAVES + MAX_LEAVES;
const DROP_MS = 180; // --dur-tick
const REVEAL_MS = 900; // --dur-reveal
const DROP_FROM = 0.36;

/** A small deterministic PRNG, so every visit grows the same tree. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Leaf {
  position: Vector3;
  rotation: Quaternion;
  scale: number;
}

/**
 * Base leaves first, close to each pad's core; then the earned ones, filling
 * the pads in turn and further out, so growth spreads across the tree.
 */
function layoutLeaves(): Leaf[] {
  const random = mulberry32(0xb0 + 0x5a1);
  const spin = new Object3D();
  return Array.from({ length: TOTAL }, (_, i) => {
    const pad = PADS[i % PADS.length]!;
    // A point inside the pad's ellipsoid: base leaves near the core, earned
    // leaves weighted toward the surface.
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const r = i < BASE_LEAVES ? 0.35 * random() : 0.55 + 0.45 * Math.cbrt(random());
    // Mostly level, as a trained pad is, with a little tilt.
    spin.rotation.set(random() * 0.5 - 0.25, random() * Math.PI * 2, random() * 0.5 - 0.25);
    return {
      position: new Vector3(
        pad.centre[0] + pad.radius[0] * r * Math.sin(phi) * Math.cos(theta),
        pad.centre[1] + pad.radius[1] * r * Math.cos(phi),
        pad.centre[2] + pad.radius[2] * r * Math.sin(phi) * Math.sin(theta),
      ),
      rotation: spin.quaternion.clone(),
      scale: 0.8 + random() * 0.4,
    };
  });
}

/** A tapered cylinder from `a` to `b`. */
function Limb({ a, b, r0, r1, color }: { a: P; b: P; r0: number; r1: number; color: Color }) {
  const { position, quaternion, length } = useMemo(() => {
    const from = new Vector3(...a);
    const to = new Vector3(...b);
    const dir = to.clone().sub(from);
    return {
      position: from.clone().add(to).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir.clone().normalize()),
      length: dir.length(),
    };
  }, [a, b]);
  return (
    <>
      <mesh position={position} quaternion={quaternion} castShadow>
        <cylinderGeometry args={[r1, r0, length, 8]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
      </mesh>
      {/* A knuckle at the far joint, so segments of different radii meet
          without a visible step. */}
      <mesh position={b}>
        <sphereGeometry args={[r1, 8, 6]} />
        <meshStandardMaterial color={color} roughness={0.9} metalness={0} />
      </mesh>
    </>
  );
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export function Bonsai() {
  const leavesRef = useRef<InstancedMesh>(null);
  const dropRef = useRef<Mesh>(null);

  const leaves = useMemo(layoutLeaves, []);
  const bark = useMemo(() => new Color(LAMP_WARM).multiplyScalar(0.09), []);
  const leafColor = useMemo(() => new Color(DATA_GREEN).multiplyScalar(LEAF_TONE), []);

  // Growth state, all frame-loop owned. `grown` is how many leaves the tree
  // currently shows; progress[i] runs 0 → 1 over a leaf's reveal.
  const grown = useRef<number | null>(null);
  // Indexed by EARNED leaf; the base leaves are always fully grown.
  const progress = useMemo(() => new Float32Array(MAX_LEAVES), []);
  const revealAt = useMemo(() => new Float32Array(MAX_LEAVES), []);
  const dropStart = useRef<number | null>(null);
  const dirty = useRef(true);
  const dummy = useMemo(() => new Object3D(), []);

  // Imperative reads only (spec/05 §1); idle unless a leaf or the drop moves.
  useFrame(({ clock }) => {
    const mesh = leavesRef.current;
    if (!mesh) return;
    const { hydrated, points } = useAppStore.getState();
    const target = Math.min(points.leafCount, MAX_LEAVES);
    const now = clock.elapsedTime * 1000;
    const reduced = useSceneStore.getState().prefersReducedMotion;

    if (grown.current === null) {
      // Wait for the first real load, then show what was already earned. The
      // matrices are still written below meanwhile, so the base leaves are in
      // place from the first frame (an InstancedMesh starts as identities).
      if (hydrated) {
        for (let i = 0; i < target; i++) progress[i] = 1;
        grown.current = target;
        dirty.current = true;
      }
    } else if (target > grown.current) {
      for (let i = grown.current; i < target; i++) {
        progress[i] = reduced ? 1 : 0;
        revealAt[i] = now + DROP_MS;
      }
      if (!reduced) dropStart.current = now;
      grown.current = target;
      dirty.current = true;
    } else if (target < grown.current) {
      // The store reset to the default room. Not a loss of growth — snap.
      for (let i = target; i < grown.current; i++) progress[i] = 0;
      grown.current = target;
      dirty.current = true;
    }

    for (let i = 0; i < (grown.current ?? 0); i++) {
      if (progress[i]! >= 1 || now < revealAt[i]!) continue;
      progress[i] = Math.min(1, (now - revealAt[i]!) / REVEAL_MS);
      dirty.current = true;
    }

    const drop = dropRef.current;
    if (drop) {
      const start = dropStart.current;
      const t = start === null ? 1 : (now - start) / DROP_MS;
      drop.visible = t < 1;
      // Falling, so it accelerates: y follows t².
      if (t < 1) drop.position.y = DROP_FROM - (DROP_FROM - POT.h) * t * t;
      else dropStart.current = null;
    }

    if (!dirty.current) return;
    for (let i = 0; i < TOTAL; i++) {
      const leaf = leaves[i]!;
      const grownBy = i < BASE_LEAVES ? 1 : easeOutCubic(progress[i - BASE_LEAVES]!);
      dummy.position.copy(leaf.position);
      dummy.quaternion.copy(leaf.rotation);
      dummy.scale.set(
        LEAF_SHAPE[0] * leaf.scale * grownBy,
        LEAF_SHAPE[1] * leaf.scale * grownBy,
        LEAF_SHAPE[2] * leaf.scale * grownBy,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    dirty.current = false;
  });

  return (
    <group position={BONSAI_POSITION} rotation={[0, 0.35, 0]} scale={TREE_SCALE}>
      {/* Pot and soil */}
      {/* Matte: unglazed stoneware. A glossy pot this close to the bulb put a
          highlight in the lamp pool brighter than the pool itself. */}
      <mesh position={[0, POT.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[POT.w, POT.h, POT.d]} />
        <meshStandardMaterial color={INK_GHOST} roughness={0.92} metalness={0} />
      </mesh>
      <mesh position={[0, POT.h + 0.001, 0]} receiveShadow>
        <boxGeometry args={[POT.w - 0.012, 0.002, POT.d - 0.012]} />
        <meshStandardMaterial color={BG_VOID} roughness={1} metalness={0} />
      </mesh>

      {/* Trunk */}
      {TRUNK.slice(1).map((joint, i) => (
        <Limb key={`trunk-${i}`} a={TRUNK[i]!} b={joint} r0={TRUNK_RADII[i]!} r1={TRUNK_RADII[i + 1]!} color={bark} />
      ))}
      {/* Branches, from a trunk joint out to each pad */}
      {PADS.map((pad, i) => (
        <Limb key={`branch-${i}`} a={TRUNK[pad.from]!} b={pad.centre} r0={0.004} r1={0.0025} color={bark} />
      ))}

      {/* Leaves — base and earned, one draw call. Frustum culling is off:
          ungrown leaves sit at zero scale, so the bounding sphere would lie. */}
      <instancedMesh ref={leavesRef} args={[undefined, undefined, TOTAL]} castShadow frustumCulled={false}>
        <icosahedronGeometry args={[LEAF_SIZE, 0]} />
        <meshStandardMaterial color={leafColor} roughness={0.9} metalness={0} flatShading />
      </instancedMesh>

      {/* The watering droplet — the room's one sharp motion (03-motion.md). */}
      <mesh ref={dropRef} position={[0.01, DROP_FROM, 0]} visible={false} scale={[1, 1.5, 1]}>
        <sphereGeometry args={[0.005, 10, 8]} />
        <meshBasicMaterial color={GLOW_COOL} />
      </mesh>
    </group>
  );
}
