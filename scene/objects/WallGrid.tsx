// 3.5 — the wall tracker. design-system/12 §3.3, spec/02 F2, spec/05 §3.
//
// 365 days on the back-wall panel behind the monitors, framed by the Ando
// joints rather than straddling one: centred on the panel centre
// [-0.75, 0.493], between its two rows of tie-rod holes (y 0.268 / 0.718).
//
// Layout, PROPOSED. The spec asks for ~4 cm cells "a week per row", but 365
// cells at 4 cm fit one 1.5 x 0.833 m panel in neither orientation (53 weeks
// x 4 cm = 2.1 m). So weeks run as COLUMNS, 53 x 7, at a 2.5 cm pitch — a
// 1.33 x 0.175 m band that fills the panel's width. Day i (oldest first) sits
// at column floor(i / 7), row i % 7; today is the last cell.
//
// Two instanced layers, one draw call each:
//   base  every cell, INK_GHOST, lit and non-emissive — at rest it reads as
//         more concrete detail, like the tie-rods (the 5 % rule).
//   glow  additive, unlit, toneMapped off: black adds nothing, so a cell glows
//         only where the store says. filled = SIGNAL_DIM x 0.1 (L 0.011) ·
//         today = SIGNAL x 0.9 (L 0.43) — the only cell bloom catches, which is
//         what keeps a full row from breaking the rig. Lerped per cell at
//         k = 0.05; snapped under reduced motion.
//
// Filled is 0.1, not the spec's "~0.5", PROPOSED: measured with 70 % of a
// year filled, 0.5 made every kept day countable from the rest pose and 0.2
// was still mottled — the
// exact failure spec/05 §3 names ("the emissive values are too high"). The
// cells also nearly fill their pitch, so at rest the gaps vanish and the band
// reads as a mottled panel, resolving into days only on approach.
//
// It never writes a store; it reads `dayGrid` in the frame loop.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, InstancedBufferAttribute, Object3D, type InstancedMesh } from 'three';

import { useAppStore } from '../../lib/stores/app';
import { useInteractionStore } from '../../lib/stores/interaction';
import { useSceneStore } from '../../lib/stores/scene';
import { INK_GHOST, SIGNAL, SIGNAL_DIM } from '../../lib/style/colors';

export const GRID_CENTRE: [number, number, number] = [-0.75, 0.493, -1.2];

const DAYS = 365;
const ROWS = 7;
const COLUMNS = Math.ceil(DAYS / ROWS);
const PITCH = 0.025;
const CELL = 0.022;
/** Proud of the wall by the same 2 mm the joint lines are. */
const BASE_Z = 0.002;
const GLOW_Z = 0.0025;

const FILLED_INTENSITY = 0.1;
const TODAY_INTENSITY = 0.9;
const LERP = 0.05; // spec/05 §3
const HOVER_LIFT = 1.2; // 08-interaction-grammar.md §2

export const GRID_WIDTH = COLUMNS * PITCH;
export const GRID_HEIGHT = ROWS * PITCH;

function cellPosition(i: number): [number, number] {
  const column = Math.floor(i / ROWS);
  const row = i % ROWS;
  return [(column + 0.5) * PITCH - GRID_WIDTH / 2, GRID_HEIGHT / 2 - (row + 0.5) * PITCH];
}

/** Matrices never change, so they are written once, when the mesh mounts. */
function placeCells(mesh: InstancedMesh, z: number): void {
  const dummy = new Object3D();
  for (let i = 0; i < DAYS; i++) {
    const [x, y] = cellPosition(i);
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}

export function WallGrid() {
  const glowRef = useRef<InstancedMesh | null>(null);

  // Linear-space targets for the two lit states, and a running level per cell.
  const targets = useMemo(
    () => ({
      filled: new Color(SIGNAL_DIM).multiplyScalar(FILLED_INTENSITY),
      today: new Color(SIGNAL).multiplyScalar(TODAY_INTENSITY),
    }),
    [],
  );
  const current = useMemo(() => new Float32Array(DAYS * 3), []);
  const settled = useRef(false);
  const lastGrid = useRef<unknown>(null);
  const lastHover = useRef(false);

  const setBase = (mesh: InstancedMesh | null) => {
    if (mesh) placeCells(mesh, BASE_Z);
  };

  const setGlow = (mesh: InstancedMesh | null) => {
    glowRef.current = mesh;
    if (!mesh) return;
    placeCells(mesh, GLOW_Z);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(DAYS * 3), 3);
  };

  // Imperative reads only (spec/05 §1). Once every cell has reached its
  // target the loop stops touching the buffer until the store or hover moves.
  useFrame(() => {
    const colors = glowRef.current?.instanceColor;
    if (!colors) return;
    const grid = useAppStore.getState().dayGrid;
    const hovered = useInteractionStore.getState().hovered === 'wallGrid';
    if (grid !== lastGrid.current || hovered !== lastHover.current) settled.current = false;
    lastGrid.current = grid;
    lastHover.current = hovered;
    if (settled.current) return;

    const k = useSceneStore.getState().prefersReducedMotion ? 1 : LERP;
    const lift = hovered ? HOVER_LIFT : 1;
    // The store is oldest first and may be shorter than a year (signed out it
    // is empty); align its last entry with the last cell, so today is final.
    const offset = DAYS - grid.length;
    const array = colors.array as Float32Array;
    let moving = false;

    for (let i = 0; i < DAYS; i++) {
      const state = i >= offset ? grid[i - offset] : 0;
      const target = state === 2 ? targets.today : state === 1 ? targets.filled : null;
      const goal = [target ? target.r * lift : 0, target ? target.g * lift : 0, target ? target.b * lift : 0];
      for (let c = 0; c < 3; c++) {
        const j = i * 3 + c;
        const next = current[j]! + (goal[c]! - current[j]!) * k;
        if (Math.abs(goal[c]! - next) > 1e-4) moving = true;
        current[j] = next;
        array[j] = next;
      }
    }
    colors.needsUpdate = true;
    settled.current = !moving;
  });

  return (
    <group position={GRID_CENTRE}>
      <instancedMesh ref={setBase} args={[undefined, undefined, DAYS]} raycast={() => null} receiveShadow>
        <planeGeometry args={[CELL, CELL]} />
        <meshStandardMaterial color={INK_GHOST} roughness={1} metalness={0} />
      </instancedMesh>

      <instancedMesh ref={setGlow} args={[undefined, undefined, DAYS]} raycast={() => null}>
        <planeGeometry args={[CELL, CELL]} />
        <meshBasicMaterial transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>

      {/* One flat target for the pointer: the cells are small and the gaps
          between them would make hover flicker. Invisible, still raycast. */}
      <mesh position={[0, 0, GLOW_Z]}>
        <planeGeometry args={[GRID_WIDTH + PITCH, GRID_HEIGHT + PITCH]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
