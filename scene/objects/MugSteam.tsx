// A5.3 — the mug's morning steam (D-18, D-24 §3). A time-of-day tell: in the
// dawn band (05–08, lib/sky.ts) a thin wisp rises off the coffee, and at every
// other hour there is none. The room stays nocturnal; only the mug knows it is
// morning.
//
// On the dust-mote precedent (design-system/09-atmosphere.md §3): nearly
// invisible, or it reads as smoke. Six soft sprites, each at most
// PEAK_OPACITY, no depth write. They are not emissive and light nothing — an
// unlit, faint INK_PAPER, the colour the lamp makes of anything pale.
//
// The band is read imperatively each frame (spec/05 §1) and the whole wisp
// lerps toward it at k = 0.05, the sky's rate, so dawn arriving fades the steam
// in rather than switching it on.
//
// REMOVED under prefers-reduced-motion, not slowed or frozen (03-motion.md
// principle 5): a still wisp is a smudge on the air, so there is none.

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DataTexture, MathUtils, RGBAFormat, type Group, type Sprite, type SpriteMaterial } from 'three';

import { lerpTo } from '../../lib/motion/lerp';
import { skyBand } from '../../lib/sky';
import { useAppStore } from '../../lib/stores/app';
import { useSceneStore } from '../../lib/stores/scene';
import { INK_PAPER } from '../../lib/style/colors';

const PUFF_COUNT = 6;
/** The dust motes' opacity (09 §3), and the build plan's ceiling for this. */
const PEAK_OPACITY = 0.08;
const RISE = 0.12; // metres above the rim a puff climbs before it is gone
const LIFE_MIN = 4;
const LIFE_MAX = 6; // seconds
const SIZE_START = 0.018;
const SIZE_END = 0.05;
const BAND_LERP = 0.05; // spec/05 §3, as the sky

interface Puff {
  life: number;
  phase: number;
  sway: number;
}

/** A soft round falloff, white with alpha only — tinted by the material. */
function puffTexture(): DataTexture {
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
      const alpha = Math.max(0, 1 - d) ** 2;
      const i = (y * size + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new DataTexture(data, size, size, RGBAFormat);
  texture.needsUpdate = true;
  return texture;
}

interface MugSteamProps {
  /** The rim's height in the mug's own frame. */
  rimY: number;
}

export function MugSteam({ rimY }: MugSteamProps) {
  const reduced = useSceneStore((s) => s.prefersReducedMotion);
  const groupRef = useRef<Group>(null);
  const presence = useRef(0);
  const settled = useRef(false);

  const texture = useMemo(puffTexture, []);
  const puffs = useMemo<Puff[]>(
    () =>
      Array.from({ length: PUFF_COUNT }, (_, i) => ({
        life: MathUtils.randFloat(LIFE_MIN, LIFE_MAX),
        // Staggered, so the wisp is continuous rather than six puffs in step.
        phase: i / PUFF_COUNT,
        sway: MathUtils.randFloat(0.006, 0.012),
      })),
    [],
  );

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;
    const { hydrated, localHour } = useAppStore.getState();
    if (!hydrated) return;

    const target = skyBand(localHour) === 'dawn' ? 1 : 0;
    // The first hydrated frame snaps, as the sky does: no fade-in on load.
    presence.current = settled.current ? lerpTo(presence.current, target, BAND_LERP) : target;
    settled.current = true;
    group.visible = presence.current > 0.001;
    if (!group.visible) return;

    const time = state.clock.getElapsedTime();
    group.children.forEach((child, i) => {
      const puff = puffs[i];
      if (!puff) return;
      const sprite = child as Sprite;
      const t = (time / puff.life + puff.phase) % 1; // 0 at the rim, 1 gone
      sprite.position.set(Math.sin(time * 0.7 + i) * puff.sway * t, rimY + RISE * t, 0);
      sprite.scale.setScalar(MathUtils.lerp(SIZE_START, SIZE_END, t));
      // In and out over its life: never a hard edge at the rim or the top.
      (sprite.material as SpriteMaterial).opacity = Math.sin(Math.PI * t) * PEAK_OPACITY * presence.current;
    });
  });

  if (reduced) return null;

  // Visible (at opacity 0) until the first hydrated frame decides: ShaderWarmup
  // compiles only visible objects, and a wisp hidden at load would compile its
  // program at dawn, mid-session, in one long frame.
  return (
    <group ref={groupRef}>
      {puffs.map((_, i) => (
        <sprite key={i}>
          <spriteMaterial map={texture} color={INK_PAPER} transparent opacity={0} depthWrite={false} />
        </sprite>
      ))}
    </group>
  );
}
