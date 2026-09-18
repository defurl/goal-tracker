// Rolling-average FPS detector. Flips a low-FPS flag when the frame rate stays
// below `threshold` for `sustainedMs` continuously, which gates bloom and dpr
// on machines that cannot sustain the pass.
//
// These are intentional performance escape hatches, not bugs: the scene must
// still read correctly with no bloom at all (05-lighting-rig.md §5).
//
// Must be used inside a React Three Fiber Canvas — it relies on useFrame.

import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

export function useAdaptiveFps(threshold = 50, sustainedMs = 2000): boolean {
  const [low, setLow] = useState(false);
  const samples = useRef<number[]>([]);
  const underSince = useRef<number | null>(null);

  useFrame((_, dt) => {
    const fps = dt > 0 ? 1 / dt : 60;
    const window_ = samples.current;
    window_.push(fps);
    if (window_.length > 30) window_.shift();
    const average = window_.reduce((a, b) => a + b, 0) / window_.length;

    const now = performance.now();
    if (average < threshold) {
      if (underSince.current === null) underSince.current = now;
      if (!low && now - underSince.current >= sustainedMs) setLow(true);
    } else {
      underSince.current = null;
      // Hysteresis: do not flip back to "high" until comfortably above the
      // threshold, or the flag chatters around the boundary.
      if (low && average > threshold + 5) setLow(false);
    }
  });

  useEffect(
    () => () => {
      samples.current = [];
      underSince.current = null;
    },
    [],
  );

  return low;
}
