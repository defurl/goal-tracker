// The history wall (design-system/13 §4, owner decisions §9): one line of cells
// per habit, a year long, oldest at the left and today at the right, active
// habits first and archived ones after them, treated the same.
//
// The room's wall grid, stretched into lines (scene/objects/WallGrid.tsx):
//   base  every cell a recess, INK_GHOST, lit and non-emissive — at rest the
//         band reads as detail in the concrete, not as data (spec/05 §3).
//   glow  additive, unlit, toneMapped off, so a cell glows only where the store
//         says: kept SIGNAL_DIM × 0.1, the longest run × 0.2 (the one emphasis,
//         never a label), kept today SIGNAL × 0.9. A day not kept is the bare
//         recess. Nothing marks a miss (11-anti-patterns, D-09).
// Two draw calls for the whole wall. Lerped per cell at k = 0.05; snapped under
// reduced motion. It reads `history` in the frame loop and writes nothing.
//
// At most MAX_LINES lines fit the wall; the history panel lists every habit.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, InstancedBufferAttribute, Object3D, type InstancedMesh } from 'three';

import { HISTORY_DAYS } from '../../lib/history';
import { useAppStore } from '../../lib/stores/app';
import { useInteractionStore } from '../../lib/stores/interaction';
import { useSceneStore } from '../../lib/stores/scene';
import { INK_GHOST, SIGNAL, SIGNAL_DIM } from '../../lib/style/colors';
import { HALL_WALL_Z } from './HallShell';

export const MAX_LINES = 24;
const PITCH = 0.015;
const CELL = 0.012;
const LINE_GAP = 0.04;
/** The top line's height: eye height from the arrival pose. */
export const BAND_TOP = 1.5;
export const BAND_WIDTH = HISTORY_DAYS * PITCH;
const BASE_Z = HALL_WALL_Z + 0.002;
const GLOW_Z = HALL_WALL_Z + 0.0025;
const CELLS = MAX_LINES * HISTORY_DAYS;

const KEPT = 0.1;
const LONGEST = 0.2; // PROPOSED (13 §4)
const TODAY = 0.9;
const LERP = 0.05; // spec/05 §3
const HOVER_LIFT = 1.2; // 08-interaction-grammar.md §2

function cellPosition(i: number): [number, number] {
  const line = Math.floor(i / HISTORY_DAYS);
  const day = i % HISTORY_DAYS;
  return [(day + 0.5) * PITCH - BAND_WIDTH / 2, BAND_TOP - line * LINE_GAP];
}

function placeCells(mesh: InstancedMesh, z: number): void {
  const dummy = new Object3D();
  for (let i = 0; i < CELLS; i++) {
    const [x, y] = cellPosition(i);
    dummy.position.set(x, y, z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.count = 0;
}

export function HistoryWall() {
  const baseRef = useRef<InstancedMesh | null>(null);
  const glowRef = useRef<InstancedMesh | null>(null);
  const targets = useMemo(
    () => ({
      kept: new Color(SIGNAL_DIM).multiplyScalar(KEPT),
      longest: new Color(SIGNAL_DIM).multiplyScalar(LONGEST),
      today: new Color(SIGNAL).multiplyScalar(TODAY),
    }),
    [],
  );
  const current = useMemo(() => new Float32Array(CELLS * 3), []);
  const settled = useRef(false);
  const lastHistory = useRef<unknown>(undefined);
  const lastHover = useRef(false);

  const setBase = (mesh: InstancedMesh | null) => {
    baseRef.current = mesh;
    if (mesh) placeCells(mesh, BASE_Z);
  };
  const setGlow = (mesh: InstancedMesh | null) => {
    glowRef.current = mesh;
    if (!mesh) return;
    placeCells(mesh, GLOW_Z);
    mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(CELLS * 3), 3);
  };

  // Imperative reads only (spec/05 §1); idle once every cell has arrived.
  useFrame(() => {
    const base = baseRef.current;
    const glow = glowRef.current;
    const colors = glow?.instanceColor;
    if (!base || !glow || !colors) return;
    const history = useAppStore.getState().history ?? [];
    const hovered = useInteractionStore.getState().hovered === 'hallWall';
    if (history !== lastHistory.current || hovered !== lastHover.current) settled.current = false;
    lastHistory.current = history;
    lastHover.current = hovered;
    if (settled.current) return;

    const lines = Math.min(history.length, MAX_LINES);
    base.count = lines * HISTORY_DAYS;
    glow.count = lines * HISTORY_DAYS;

    const k = useSceneStore.getState().prefersReducedMotion ? 1 : LERP;
    const lift = hovered ? HOVER_LIFT : 1;
    const array = colors.array as Float32Array;
    let moving = false;
    for (let line = 0; line < lines; line++) {
      const row = history[line]!;
      const run = row.longestRun;
      for (let day = 0; day < HISTORY_DAYS; day++) {
        const state = row.days[day] ?? 0;
        const target =
          state === 2 ? targets.today : state === 1 ? (run && day >= run.from && day <= run.to ? targets.longest : targets.kept) : null;
        const i = line * HISTORY_DAYS + day;
        for (let c = 0; c < 3; c++) {
          const goal = target ? (c === 0 ? target.r : c === 1 ? target.g : target.b) * lift : 0;
          const j = i * 3 + c;
          const next = current[j]! + (goal - current[j]!) * k;
          if (Math.abs(goal - next) > 1e-4) moving = true;
          current[j] = next;
          array[j] = next;
        }
      }
    }
    colors.needsUpdate = true;
    settled.current = !moving;
  });

  const bandHeight = (MAX_LINES - 1) * LINE_GAP + CELL;

  return (
    <group>
      <instancedMesh ref={setBase} args={[undefined, undefined, CELLS]} raycast={() => null} receiveShadow frustumCulled={false}>
        <planeGeometry args={[CELL, CELL]} />
        <meshStandardMaterial color={INK_GHOST} roughness={1} metalness={0} />
      </instancedMesh>
      <instancedMesh ref={setGlow} args={[undefined, undefined, CELLS]} raycast={() => null} frustumCulled={false}>
        <planeGeometry args={[CELL, CELL]} />
        <meshBasicMaterial transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {/* One flat target for the pointer, as the room's wall grid: invisible, raycast. */}
      <mesh position={[0, BAND_TOP - bandHeight / 2 + CELL / 2, GLOW_Z]}>
        <planeGeometry args={[BAND_WIDTH + PITCH, bandHeight + LINE_GAP]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}
