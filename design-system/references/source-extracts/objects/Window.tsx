import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type MeshStandardMaterial, type Group } from 'three';
import {
  BG_NIGHT,
  BG_PANEL,
  BG_VOID,
  LAMP_WARM,
  VOXEL_GLOW,
  VOXEL_GLOW_SOFT,
  RAIN_STREAK,
} from '../../../lib/style/colors';
import { useMarketStore } from '../../../lib/stores/marketStore';
import { useSceneStore } from '../../../lib/stores/sceneStore';
import type { IndexDirection, MarketSession } from '../../../lib/data/types';

// The window is the desk's payoff in Phase 2: the "city-beyond" plane shifts
// subtly with the market.
//   - Lower plane (city) tint shifts on `index.direction`:
//       up   → 5% toward LAMP_WARM
//       down → 5% toward VOXEL_GLOW (cooler/saturated cyan)
//       flat → no shift
//   - Upper plane (sky) shifts on `session` over a wider color/intensity range.
//
// Reads from `useMarketStore.getState()` inside useFrame — no React-level
// subscription, no re-renders. Both planes lerp toward their target every
// frame at SHIFT_RATE; under prefers-reduced-motion we snap instead.

interface WindowProps {
  position: [number, number, number];
  rotation?: [number, number, number];
}

const W = 0.7;
const H = 1.0;
const FRAME_T = 0.04;
const FRAME_DEPTH = 0.06;
const GLASS_THICKNESS = 0.02;

const CITY_BASE = new Color(VOXEL_GLOW_SOFT);
const CITY_WARM = new Color(LAMP_WARM);
const CITY_COOL = new Color(VOXEL_GLOW);
const SHIFT = 0.05; // 5% of the way toward the target hue

const cityTarget = new Color();
function cityColorFor(dir: IndexDirection | undefined, out: Color): Color {
  out.copy(CITY_BASE);
  if (dir === 'up') out.lerp(CITY_WARM, SHIFT);
  else if (dir === 'down') out.lerp(CITY_COOL, SHIFT);
  return out;
}

interface SkyState {
  color: Color;
  intensity: number;
}
const SKY_TABLE: Record<MarketSession, SkyState> = {
  'pre-market': { color: new Color(BG_VOID).lerp(new Color(LAMP_WARM), 0.04), intensity: 0.5 },
  open: { color: new Color(VOXEL_GLOW_SOFT), intensity: 1.4 },
  lunch: { color: new Color(BG_NIGHT).lerp(new Color(VOXEL_GLOW_SOFT), 0.3), intensity: 0.9 },
  close: { color: new Color(VOXEL_GLOW_SOFT).lerp(new Color(LAMP_WARM), 0.15), intensity: 1.1 },
  'after-hours': { color: new Color(BG_VOID).lerp(new Color(VOXEL_GLOW_SOFT), 0.2), intensity: 0.35 },
  closed: { color: new Color(BG_VOID), intensity: 0.25 },
};

// Lerp speed: roughly 1 second to ~95% of target. dt is per-frame seconds.
const LERP_K = 0.05;

function WindowRain() {
  const reduced = useSceneStore((s) => s.prefersReducedMotion);
  const count = 18;

  // Generate random initial positions, speeds, and heights for the drops
  const drops = useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        x: (Math.random() - 0.5) * (W - FRAME_T * 2.2),
        y: (Math.random() - 0.5) * (H - FRAME_T * 2.2),
        speed: 0.25 + Math.random() * 0.45,
        length: 0.015 + Math.random() * 0.025,
      });
    }
    return arr;
  }, []);

  const groupRef = useRef<Group>(null);

  useFrame((_, dt) => {
    if (reduced || !groupRef.current) return;

    // Animate each droplet down the window
    groupRef.current.children.forEach((child, i) => {
      const drop = drops[i];
      if (!drop) return;
      child.position.y -= drop.speed * dt;

      // If it goes past the bottom frame, reset to top
      const bottomLimit = -H / 2 + FRAME_T;
      const topLimit = H / 2 - FRAME_T;
      if (child.position.y < bottomLimit) {
        child.position.y = topLimit;
        child.position.x = (Math.random() - 0.5) * (W - FRAME_T * 2.2);
        drop.speed = 0.25 + Math.random() * 0.45;
      }
    });
  });

  if (reduced) return null;

  return (
    <group ref={groupRef}>
      {drops.map((drop, i) => (
        <mesh key={i} position={[drop.x, drop.y, GLASS_THICKNESS / 2 + 0.001]}>
          <planeGeometry args={[0.0018, drop.length]} />
          <meshBasicMaterial
            color={RAIN_STREAK}
            transparent
            opacity={0.3 + Math.random() * 0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Window({ position, rotation = [0, 0, 0] }: WindowProps) {
  const skyRef = useRef<MeshStandardMaterial>(null);
  const cityRef = useRef<MeshStandardMaterial>(null);

  useFrame(() => {
    const { index, session } = useMarketStore.getState();
    const reduced = useSceneStore.getState().prefersReducedMotion;

    if (cityRef.current) {
      cityColorFor(index?.direction, cityTarget);
      if (reduced) cityRef.current.emissive.copy(cityTarget);
      else cityRef.current.emissive.lerp(cityTarget, LERP_K);
    }

    if (skyRef.current) {
      const sky = SKY_TABLE[session];
      if (reduced) {
        skyRef.current.emissive.copy(sky.color);
        skyRef.current.emissiveIntensity = sky.intensity;
      } else {
        skyRef.current.emissive.lerp(sky.color, LERP_K);
        skyRef.current.emissiveIntensity +=
          (sky.intensity - skyRef.current.emissiveIntensity) * LERP_K;
      }
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Top frame */}
      <mesh castShadow position={[0, H / 2 - FRAME_T / 2, 0]}>
        <boxGeometry args={[W, FRAME_T, FRAME_DEPTH]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.7} metalness={0.15} />
      </mesh>
      {/* Bottom frame */}
      <mesh castShadow position={[0, -H / 2 + FRAME_T / 2, 0]}>
        <boxGeometry args={[W, FRAME_T, FRAME_DEPTH]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.7} metalness={0.15} />
      </mesh>
      {/* Left frame */}
      <mesh castShadow position={[-W / 2 + FRAME_T / 2, 0, 0]}>
        <boxGeometry args={[FRAME_T, H - FRAME_T * 2, FRAME_DEPTH]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.7} metalness={0.15} />
      </mesh>
      {/* Right frame */}
      <mesh castShadow position={[W / 2 - FRAME_T / 2, 0, 0]}>
        <boxGeometry args={[FRAME_T, H - FRAME_T * 2, FRAME_DEPTH]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.7} metalness={0.15} />
      </mesh>
      {/* Center horizontal mullion */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[W - FRAME_T * 2, FRAME_T * 0.4, FRAME_DEPTH * 0.6]} />
        <meshStandardMaterial color={BG_PANEL} roughness={0.7} metalness={0.15} />
      </mesh>

      {/* Glass */}
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[W - FRAME_T * 2, H - FRAME_T * 2, GLASS_THICKNESS]} />
        <meshPhysicalMaterial
          color={BG_NIGHT}
          transmission={0.55}
          roughness={0.12}
          metalness={0.05}
          ior={1.45}
          thickness={0.05}
        />
      </mesh>

      {/* Rain droplets overlay */}
      <WindowRain />

      {/* Sky beyond — upper plane, tracks session. */}
      <mesh position={[0, 0.25, -0.3]}>
        <planeGeometry args={[W * 0.92, H * 0.55]} />
        <meshStandardMaterial
          ref={skyRef}
          color={BG_VOID}
          emissive={VOXEL_GLOW_SOFT}
          emissiveIntensity={1.4}
          roughness={1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
      {/* City beyond — lower plane, tracks index.direction. */}
      <mesh position={[0, -0.25, -0.3]}>
        <planeGeometry args={[W * 0.92, H * 0.55]} />
        <meshStandardMaterial
          ref={cityRef}
          color={BG_VOID}
          emissive={VOXEL_GLOW_SOFT}
          emissiveIntensity={0.55}
          roughness={1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
