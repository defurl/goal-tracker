'use client';

// The canvas mount. React Three Fiber cannot be server-rendered, so this whole
// subtree is client-only and the module is loaded through next/dynamic with
// { ssr: false } from the route. Get that wrong and the build fails at prerender
// time with an opaque error (D-06).
//
// One canvas, one WebGL context, one scene at a time: the room, or the hall
// behind its door (design-system/13 §7). `useSceneStore.current` says which.
// Each scene is compiled by its own ShaderWarmup before its first frame, and
// the change of scene happens behind SceneFade (lib/scene/transition.ts).

import { Suspense, lazy, useCallback, useEffect, useState, type ComponentType } from 'react';
import { Canvas } from '@react-three/fiber';
import styles from './RoomCanvas.module.css';
import { RoomScene } from './RoomScene';
import { ShaderWarmup } from './ShaderWarmup';
import { REST_POSE, REST_POSE_MOBILE } from './cameraPoses';
import { loadHall } from './hall/load';
import { sceneReady } from '../lib/scene/transition';
import { useSceneStore, type SceneKey } from '../lib/stores/scene';
import { useAdaptiveFps } from '../lib/perf/useAdaptiveFps';
import { prefersReducedMotion, watchReducedMotion } from '../lib/motion/reducedMotion';

const MOBILE_QUERY = '(max-width: 768px)';

/**
 * The hall, lazily. If its chunk cannot be fetched (offline, a failed deploy),
 * the canvas goes back to the room rather than holding a black hall, and the
 * next attempt starts from a fresh lazy component — a failed one would stay
 * failed.
 */
function makeHall(): ComponentType {
  return lazy<ComponentType>(() =>
    loadHall().catch(() => {
      hall = makeHall();
      useSceneStore.getState().setScene('room');
      return { default: () => null };
    }),
  );
}
let hall = makeHall();

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
  const current = useSceneStore((s) => s.current);

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

  // `/?scene=hall` opens straight into the hall: a link to it, and how the
  // captures and checks reach it without walking through the door.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('scene') === 'hall') {
      useSceneStore.getState().setScene('hall');
    }
  }, []);

  // No frame is drawn until every shader of the CURRENT scene is compiled, so
  // the compile runs in small tasks instead of inside the first render
  // (ShaderWarmup). A change of scene is uncompiled again until its warm-up.
  const [warmFor, setWarmFor] = useState<SceneKey | null>(null);
  const warm = warmFor === current;
  const onWarm = useCallback(() => {
    setWarmFor(useSceneStore.getState().current);
    sceneReady();
  }, []);

  const rest = isMobile ? REST_POSE_MOBILE : REST_POSE;
  const Hall = hall;

  return (
    <div className={styles.host} data-room-ready={warm || undefined} data-scene={current}>
      <Canvas
        frameloop={warm ? 'always' : 'never'}
        // dpr capped at 2 even on retina — a perf escape hatch, not a bug.
        dpr={[1, 2]}
        shadows
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        camera={{ position: rest.position, fov: isMobile ? 38 : 50 }}
        onCreated={({ camera }) => camera.lookAt(...rest.target)}
      >
        {current === 'room' ? (
          <>
            <RoomScene />
            <ShaderWarmup key="room" onReady={onWarm} />
          </>
        ) : (
          <Suspense fallback={null}>
            <Hall />
            <ShaderWarmup key="hall" onReady={onWarm} />
          </Suspense>
        )}
        <AdaptiveFpsBridge />
      </Canvas>
    </div>
  );
}
