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
  /** Where the stand foot meets the desk. y = 0 IS the desk top, so callers
   *  pass 0 and cannot get the offset wrong. */
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
const NECK_RISE = 0.12;
const FOOT_THICKNESS = 0.012;

/**
 * Height of the screen centre above the desk, for a panel of `height`.
 *
 * 04-room-spec.md §1 records the portfolio bug this replaces: the source
 * comment gave the offset as `height/2 + 0.12`, the code actually used
 * `+ 0.006` more (half the foot disc), and monitor 2 was then hardcoded to the
 * value from the WRONG formula — so it shipped floating 6 mm above the desk.
 * Deriving it from the instance's own height, inside the component, makes that
 * class of mistake unrepresentable: there is no number for a caller to get
 * wrong, and a monitor of any size still lands on the desk.
 */
function screenCentreY(height: number): number {
  return height / 2 + NECK_RISE + FOOT_THICKNESS / 2;
}

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
  const centreY = screenCentreY(height);

  return (
    <group position={position}>
      {/* Only the PANEL tilts. Tilting the whole monitor rotates the foot with
          it and lifts its far edge off the desk — the same 6 mm class of gap
          the offset bug above produced, just from a different cause. */}
      <group position={[0, centreY, 0]} rotation={[tilt, 0, 0]}>
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
      </group>

      {/* Stand neck — upright, measured from the desk, not from the panel. */}
      <mesh castShadow position={[0, FOOT_THICKNESS / 2 + NECK_HEIGHT / 2, -0.02]}>
        <cylinderGeometry args={[0.012, 0.014, NECK_HEIGHT, 12]} />
        <meshStandardMaterial color={INK_GHOST} roughness={0.6} metalness={0.5} />
      </mesh>

      {/* Foot — flat on the desk. */}
      <mesh castShadow position={[0, FOOT_THICKNESS / 2, -0.02]}>
        <cylinderGeometry args={[0.09, 0.11, FOOT_THICKNESS, 24]} />
        <meshStandardMaterial color={INK_GHOST} roughness={0.5} metalness={0.55} />
      </mesh>
    </group>
  );
}
