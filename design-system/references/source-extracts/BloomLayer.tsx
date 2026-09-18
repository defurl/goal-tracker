import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { useSceneStore } from '../../../lib/stores/sceneStore';
import { useAdaptiveFps } from '../../../lib/perf/useAdaptiveFps';

// Phase 1.3 — selective bloom on the lamp bulb + (later) monitor emissives.
//
// Thresholds match the materials in `lighting-plan.svg`:
//   - lamp bulb: MeshBasicMaterial, raw LAMP_WARM, toneMapped:false →
//     linear luminance well above 1.0 → warm bloom (threshold 0.6) catches.
//   - monitor 1 emissive: SIGNAL_AMBER_DIM at intensity 1.2 (added later) →
//     warm bloom catches the warm content tone.
//   - monitor 2 emissive: VOXEL_GLOW_SOFT at intensity 1.0 (added later) →
//     cool bloom (threshold 0.3) catches the cool content tone.
//
// Bloom disabled when prefers-reduced-motion is set OR when adaptive FPS
// detects sustained low frame rate. Both are intentional perf escape hatches.
export function BloomLayer() {
  const reduced = useSceneStore(s => s.prefersReducedMotion);
  const isMobile = useSceneStore(s => s.isMobile);
  const lowFps = useAdaptiveFps(50, 2000);

  // Bloom is disabled on mobile by default (1.21 — perf budget). Reduced
  // motion and sustained-low-FPS already disable it elsewhere.
  if (reduced || lowFps || isMobile) return null;

  // Threshold tuning notes:
  //   - Lamp bulb (MeshBasicMaterial LAMP_WARM, toneMapped:false): luminance ~0.55.
  //   - Monitor 1 emissive (SIGNAL_AMBER_DIM × intensity 1.2): luminance ~0.12.
  //   - Monitor 2 emissive (VOXEL_GLOW_SOFT × intensity 1.0): luminance ~0.13.
  // To catch both the lamp bulb AND the monitor screens (all flagged "bloom
  // target" in the lighting plan), thresholds need to sit below ~0.12.
  return (
    <EffectComposer>
      {/* Single broad bloom — soft warm/cool halos around everything emissive. */}
      <Bloom
        intensity={0.9}
        luminanceThreshold={0.1}
        luminanceSmoothing={0.4}
        mipmapBlur
      />
    </EffectComposer>
  );
}
