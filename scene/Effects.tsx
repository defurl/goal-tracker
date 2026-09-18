// The post-processing stack. design-system/05-lighting-rig.md §5.
//
// One broad bloom pass, nothing else. The design spec asks for different bloom
// on warm and cool sources ("they should not match"); the shipped compromise is
// a single pass, and a selective two-pass version is the upgrade if there is
// ever budget for it.
//
// **Bloom is disabled entirely** under reduced motion, on a sustained low frame
// rate, or on mobile. These are deliberate perf escape hatches, not bugs, and
// the room is required to read correctly with no bloom at all — which is why
// nothing in the scene depends on bloom to be visible.
//
// All three flags are event-driven, not per-tick, so subscribing is within the
// scene state contract (spec/05 §3) and is what lets the pass unmount.

import { Bloom, EffectComposer } from '@react-three/postprocessing';

import {
  BLOOM_INTENSITY,
  BLOOM_LUMINANCE_SMOOTHING,
  BLOOM_LUMINANCE_THRESHOLD,
} from './lighting';
import { useSceneStore } from '../lib/stores/scene';

export function Effects() {
  const reduced = useSceneStore((s) => s.prefersReducedMotion);
  const lowFps = useSceneStore((s) => s.lowFps);
  const isMobile = useSceneStore((s) => s.isMobile);

  if (reduced || lowFps || isMobile) return null;

  return (
    <EffectComposer>
      <Bloom
        intensity={BLOOM_INTENSITY}
        luminanceThreshold={BLOOM_LUMINANCE_THRESHOLD}
        luminanceSmoothing={BLOOM_LUMINANCE_SMOOTHING}
        mipmapBlur
      />
    </EffectComposer>
  );
}
