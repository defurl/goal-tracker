// A1.5 — the two desk monitors. design-system/04-room-spec.md §5.
//
// Hand-built primitives, no models. The screens are the room's other emissive
// surfaces after the lamp, so both tints are luminance-checked against the 0.1
// bloom threshold (D-20, D-21):
//
//   monitor 1  SIGNAL_DIM       #8E4A5C  L 0.114 x 1.2 = 0.137  -> blooms
//   monitor 2  GLOW_COOL_SOFT   #3F6B77  L 0.131 x 1.0 = 0.131  -> blooms
//
// Both clear it, but not by much, which is the point: a screen that sits just
// over the line glows without lighting the room. Do not lower either intensity
// without re-measuring — SIGNAL_DIM's first candidate missed the threshold and
// left monitor 1 flat.
//
// `color` is BG_VOID so the unlit base reads dark; the emissive layer is the
// glow. `toneMapped={false}` keeps the emissive value raw so bloom can catch
// it. The GradientTexture on emissiveMap fades the glow toward the bottom of
// the screen, which is what stops it reading as a flat coloured rectangle.

import { GradientTexture } from '@react-three/drei';

import {
  BG_PANEL_2,
  BG_VOID,
  GLOW_COOL_SOFT,
  INK_FAINT,
  INK_GHOST,
  INK_MUTED,
  INK_PAPER,
  SIGNAL_DIM,
} from '../../lib/style/colors';
import { useInteractionStore, type ObjectId } from '../../lib/stores/interaction';

export type MonitorVariant = 'primary' | 'terminal';

interface MonitorProps {
  /** Group origin. The stand foot sits FOOT_DROP below it, so y = FOOT_DROP
   *  puts the monitor on the desk. */
  position: [number, number, number];
  variant: MonitorVariant;
  width?: number;
  height?: number;
  /** When set, the screen lifts emissive on hover. */
  hoverId?: ObjectId;
}

const BEZEL_THICKNESS = 0.012;
const PANEL_DEPTH = 0.024;
const HOVER_EMISSIVE_LIFT = 1.2;

const DEFAULT_WIDTH = 0.62;
const DEFAULT_HEIGHT = 0.36;

const NECK_HEIGHT = 0.12;
const FOOT_THICKNESS = 0.012;

/** Distance from the group origin down to the underside of the foot. */
export const FOOT_DROP = DEFAULT_HEIGHT / 2 + 0.12 + FOOT_THICKNESS / 2;

export function Monitor({
  position,
  variant,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  hoverId,
}: MonitorProps) {
  const isPrimary = variant === 'primary';
  const emissiveTint = isPrimary ? SIGNAL_DIM : GLOW_COOL_SOFT;
  const baseIntensity = isPrimary ? 1.2 : 1.0;

  // Hover is event-driven, not per-tick, so subscribing is within the scene
  // state contract (spec/05 §3). The value swap is instant and therefore still
  // legible under prefers-reduced-motion without a frame loop.
  const hovered = useInteractionStore((s) => hoverId != null && s.hovered === hoverId);
  const emissiveIntensity = hovered ? baseIntensity * HOVER_EMISSIVE_LIFT : baseIntensity;

  const tilt = isPrimary ? -0.06 : -0.04;

  return (
    <group position={position} rotation={[tilt, 0, 0]}>
      {/* Bezel */}
      <mesh castShadow>
        <boxGeometry args={[width, height, PANEL_DEPTH]} />
        <meshStandardMaterial color={BG_PANEL_2} roughness={0.55} metalness={0.35} />
      </mesh>

      {/* Screen, 1 mm proud of the bezel */}
      <mesh position={[0, 0, PANEL_DEPTH / 2 + 0.001]}>
        <planeGeometry args={[width - BEZEL_THICKNESS * 2, height - BEZEL_THICKNESS * 2]} />
        <meshStandardMaterial
          color={BG_VOID}
          emissive={emissiveTint}
          emissiveIntensity={emissiveIntensity}
          roughness={0.9}
          metalness={0.05}
          toneMapped={false}
        >
          <GradientTexture
            attach="emissiveMap"
            stops={[0, 0.5, 1]}
            colors={[INK_PAPER, INK_MUTED, INK_FAINT]}
          />
        </meshStandardMaterial>
      </mesh>

      {/* Stand neck */}
      <mesh castShadow position={[0, -height / 2 - 0.06, -0.02]}>
        <cylinderGeometry args={[0.012, 0.014, NECK_HEIGHT, 12]} />
        <meshStandardMaterial color={INK_GHOST} roughness={0.6} metalness={0.5} />
      </mesh>

      {/* Foot */}
      <mesh castShadow position={[0, -height / 2 - 0.12, -0.02]}>
        <cylinderGeometry args={[0.09, 0.11, FOOT_THICKNESS, 24]} />
        <meshStandardMaterial color={INK_GHOST} roughness={0.5} metalness={0.55} />
      </mesh>
    </group>
  );
}
