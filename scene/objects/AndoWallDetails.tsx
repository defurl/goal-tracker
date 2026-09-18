// A1.2 — Tadao Ando board-formed concrete detailing: panel joints and tie-rod
// holes. design-system/04-room-spec.md §3.
//
// This one detail does most of the work separating the room from "grey boxes".
// The joint lines catch the rim light and give the eye a scale reference; the
// tie-rod holes read as depth at almost zero geometry cost. Keep it.
//
// Back wall: 6 x 2.5 m divided into a 4 x 3 panel grid, 6 holes per panel,
// 4 x 3 x 6 = 72 holes.

import { useMemo } from 'react';
import { BG_VOID, INK_GHOST } from '../../lib/style/colors';

interface Joint {
  position: [number, number, number];
  size: [number, number, number];
}

/** [x, y, z, facesLeft] — facesLeft rotates the disc onto the right wall. */
type TieRod = [number, number, number, boolean];

const PANEL_WIDTH = 1.5;
const PANEL_HEIGHT = 0.833;
const FLOOR_Y = -0.74;

/** Holes sit 0.9 of the way out from each panel centre, 2 rows of 3. */
const HOLE_DX = [-0.5, 0, 0.5];
const HOLE_DY = [-0.25, 0.25];
const HOLE_SPREAD = 0.9;

export function AndoWallDetails() {
  const joints = useMemo<Joint[]>(
    () => [
      // Back wall, 2 mm proud of the wall at z = -1.198.
      { position: [0, 0.09, -1.198], size: [6.0, 0.005, 0.005] },
      { position: [0, 0.92, -1.198], size: [6.0, 0.005, 0.005] },
      { position: [-1.5, 0.51, -1.198], size: [0.005, 2.5, 0.005] },
      { position: [0.0, 0.51, -1.198], size: [0.005, 2.5, 0.005] },
      { position: [1.5, 0.51, -1.198], size: [0.005, 2.5, 0.005] },

      // Right wall — the in-front-of-window segment only.
      { position: [1.998, 0.09, 1.275], size: [0.005, 0.005, 2.45] },
      { position: [1.998, 0.92, 1.275], size: [0.005, 0.005, 2.45] },
      { position: [1.998, 0.51, 1.0], size: [0.005, 2.5, 0.005] },
    ],
    [],
  );

  const tieRods = useMemo<TieRod[]>(() => {
    const list: TieRod[] = [];

    const startX = -3.0 + PANEL_WIDTH / 2;
    const startY = FLOOR_Y + PANEL_HEIGHT / 2;

    for (let column = 0; column < 4; column++) {
      for (let row = 0; row < 3; row++) {
        const panelX = startX + column * PANEL_WIDTH;
        const panelY = startY + row * PANEL_HEIGHT;
        for (const dx of HOLE_DX) {
          for (const dy of HOLE_DY) {
            list.push([panelX + dx * HOLE_SPREAD, panelY + dy * HOLE_SPREAD, -1.196, false]);
          }
        }
      }
    }

    // Right wall, for visual balance rather than a strict panel grid.
    for (const z of [0.4, 0.9, 1.6, 2.1]) {
      for (const y of [-0.3, 0.5, 1.3]) {
        list.push([1.996, y, z, true]);
      }
    }

    return list;
  }, []);

  return (
    <group>
      {joints.map((joint, i) => (
        <mesh key={`joint-${i}`} position={joint.position}>
          <boxGeometry args={joint.size} />
          <meshStandardMaterial color={INK_GHOST} roughness={1} metalness={0} />
        </mesh>
      ))}

      {tieRods.map(([x, y, z, facesLeft], i) => (
        <mesh
          key={`tie-rod-${i}`}
          position={[x, y, z]}
          rotation={facesLeft ? [0, -Math.PI / 2, 0] : [0, 0, 0]}
        >
          <circleGeometry args={[0.015, 8]} />
          <meshStandardMaterial color={BG_VOID} roughness={1} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}
