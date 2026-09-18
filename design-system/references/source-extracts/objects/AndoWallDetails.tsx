import { useMemo } from 'react';
import { BG_VOID, INK_GHOST } from '../../../lib/style/colors';


// Tadao Ando raw concrete panels detailing:
// Creates a precise grid of rectangular panel joints and circular tie-rod holes
// on the concrete walls, converting flat planes into rich, photographic
// architectural surfaces.
//
// Back wall panels: 6m wide × 2.5m tall at z = -1.2.
// Divided into 4 panels horizontally (1.5m wide) and 3 panels vertically (0.83m tall).
// Each panel features 6 circular tie-rod holes (2 rows of 3).

export function AndoWallDetails() {
  const joints = useMemo(() => {
    const list: Array<{ pos: [number, number, number]; size: [number, number, number]; rot?: [number, number, number] }> = [];

    // --- Back Wall Joints (z = -1.2, width 6, height 2.5) ---
    // Horizontal lines (2 lines at y = -0.74 + 0.83 = 0.09, and y = -0.74 + 1.66 = 0.92)
    list.push({ pos: [0, 0.09, -1.198], size: [6.0, 0.005, 0.005] });
    list.push({ pos: [0, 0.92, -1.198], size: [6.0, 0.005, 0.005] });

    // Vertical lines (3 lines at x = -1.5, 0.0, 1.5)
    list.push({ pos: [-1.5, 0.51, -1.198], size: [0.005, 2.5, 0.005] });
    list.push({ pos: [0.0, 0.51, -1.198], size: [0.005, 2.5, 0.005] });
    list.push({ pos: [1.5, 0.51, -1.198], size: [0.005, 2.5, 0.005] });

    // --- Right Wall Joints (x = 2.0, z = -1.2..2.5, width 3.7) ---
    // Horizontal lines at the same heights (y = 0.09 and y = 0.92) on the right wall
    // Segment in front of window (from z = +0.05 to z = +2.5, center z = 1.275, width 2.45)
    list.push({ pos: [1.998, 0.09, 1.275], size: [0.005, 0.005, 2.45], rot: [0, 0, 0] });
    list.push({ pos: [1.998, 0.92, 1.275], size: [0.005, 0.005, 2.45], rot: [0, 0, 0] });

    // Vertical lines on the right wall in front of window (e.g. z = 1.0)
    list.push({ pos: [1.998, 0.51, 1.0], size: [0.005, 2.5, 0.005] });

    return list;
  }, []);

  const tieRods = useMemo(() => {
    const list: Array<[number, number, number, boolean]> = []; // [x, y, z, isRotated]

    // Back wall panel centers (4 × 3 panels)
    const panelWidth = 1.5;
    const panelHeight = 0.833;
    const startX = -3.0 + panelWidth / 2;
    const startY = -0.74 + panelHeight / 2;

    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 3; r++) {
        const px = startX + c * panelWidth;
        const py = startY + r * panelHeight;

        // 6 holes per panel: 2 rows of 3
        const dx = [-0.5, 0, 0.5];
        const dy = [-0.25, 0.25];

        for (const hx of dx) {
          for (const hy of dy) {
            // Apply scale offsets relative to panel width/height
            list.push([px + hx * 0.9, py + hy * 0.9, -1.196, false]);
          }
        }
      }
    }

    // Right wall panel holes (only in front of window segment, center z = 1.275)
    // Add a few holes for visual balancing
    const rightZs = [0.4, 0.9, 1.6, 2.1];
    const rightYs = [-0.3, 0.5, 1.3];
    for (const rz of rightZs) {
      for (const ry of rightYs) {
        list.push([1.996, ry, rz, true]);
      }
    }

    return list;
  }, []);

  return (
    <group>
      {/* Rectangular joint grooves (thin inset boxes) */}
      {joints.map((j, i) => (
        <mesh key={`joint-${i}`} position={j.pos}>
          <boxGeometry args={j.size} />
          <meshStandardMaterial color={INK_GHOST} roughness={1.0} metalness={0.0} />
        </mesh>
      ))}

      {/* Circular tie-rod holes (small black indented dots) */}
      {tieRods.map((t, i) => {
        const [x, y, z, isRotated] = t;
        return (
          <mesh
            key={`tie-rod-${i}`}
            position={[x, y, z]}
            rotation={isRotated ? [0, -Math.PI / 2, 0] : [0, 0, 0]}
          >
            <circleGeometry args={[0.015, 8]} />
            <meshStandardMaterial
              color={BG_VOID}
              emissive={BG_VOID}
              emissiveIntensity={0}
              roughness={1.0}
              metalness={0.0}
            />
          </mesh>
        );
      })}
    </group>
  );
}
