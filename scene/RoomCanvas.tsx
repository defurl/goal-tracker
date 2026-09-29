'use client';

// The canvas mount. React Three Fiber cannot be server-rendered, so this whole
// subtree is client-only and the module is loaded through next/dynamic with
// { ssr: false } from the route. Get that wrong and the build fails at prerender
// time with an opaque error (D-06).

import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import styles from './RoomCanvas.module.css';
import { RoomScene } from './RoomScene';
import { ShaderWarmup } from './ShaderWarmup';
import { REST_POSE, REST_POSE_MOBILE } from './cameraPoses';
import { useSceneStore } from '../lib/stores/scene';
import { useAdaptiveFps } from '../lib/perf/useAdaptiveFps';
import { prefersReducedMotion, watchReducedMotion } from '../lib/motion/reducedMotion';

const MOBILE_QUERY = '(max-width: 768px)';

/** Runs inside the Canvas — useAdaptiveFps needs useFrame. Renders nothing. */
function AdaptiveFpsBridge() {
  const low = useAdaptiveFps();
  const setLowFps = useSceneStore((s) => s.setLowFps);

  useEffect(() => {
    setLowFps(low);
  }, [low, setLowFps]);

  return null;
}

export default function RoomCanvas() {
  const setPrefersReducedMotion = useSceneStore((s) => s.setPrefersReducedMotion);
  const setIsMobile = useSceneStore((s) => s.setIsMobile);
  const isMobile = useSceneStore((s) => s.isMobile);

  useEffect(() => {
    setPrefersReducedMotion(prefersReducedMotion());
    return watchReducedMotion(setPrefersReducedMotion);
  }, [setPrefersReducedMotion]);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    setIsMobile(media.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, [setIsMobile]);

  // No frame is drawn until every shader is compiled, so the compile runs in
  // small tasks instead of inside the first render (ShaderWarmup).
  const [warm, setWarm] = useState(false);
  const onWarm = useCallback(() => setWarm(true), []);

  const rest = isMobile ? REST_POSE_MOBILE : REST_POSE;

  return (
    <div className={styles.host} data-room-ready={warm || undefined}>
      <Canvas
        frameloop={warm ? 'always' : 'never'}
        // dpr capped at 2 even on retina — a perf escape hatch, not a bug.
        dpr={[1, 2]}
        shadows
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: rest.position, fov: isMobile ? 38 : 50 }}
        onCreated={({ camera }) => camera.lookAt(...rest.target)}
      >
        <RoomScene />
        <ShaderWarmup onReady={onWarm} />
        <AdaptiveFpsBridge />
      </Canvas>
    </div>
  );
}
