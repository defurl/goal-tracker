import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';

// Rolling-average FPS detector that flips a boolean low-FPS flag when the
// frame rate stays below `threshold` for `sustainedMs` continuously.
// Phase 3+ will reuse this for the city scene; Phase 1.3 uses it to gate
// bloom on machines that can't sustain the pass.
//
// Must be used inside a React Three Fiber Canvas (it relies on useFrame).
export function useAdaptiveFps(threshold = 50, sustainedMs = 2000): boolean {
  const [low, setLow] = useState(false);
  const samplesRef = useRef<number[]>([]);
  const underSinceRef = useRef<number | null>(null);

  useFrame((_, dt) => {
    const fps = dt > 0 ? 1 / dt : 60;
    const samples = samplesRef.current;
    samples.push(fps);
    if (samples.length > 30) samples.shift();
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;

    const now = performance.now();
    if (avg < threshold) {
      if (underSinceRef.current === null) underSinceRef.current = now;
      if (!low && now - underSinceRef.current >= sustainedMs) setLow(true);
    } else {
      underSinceRef.current = null;
      // Hysteresis: don't flip back to "high" unless we're well above the
      // threshold for a sustained window. Wait for >threshold+5 across all samples.
      if (low && avg > threshold + 5) setLow(false);
    }
  });

  // Reset on remount.
  useEffect(() => () => {
    samplesRef.current = [];
    underSinceRef.current = null;
  }, []);

  return low;
}
