'use client';

// The room. The lighting acceptance test reads TRUE on all five criteria, so
// the desk objects, the window and the atmosphere layers are in
// (design-system/05-lighting-rig.md §4).
//
// The canvas is mounted through next/dynamic with { ssr: false } because React
// Three Fiber cannot be server-rendered (D-06). It is also the only place the
// 3D chunk is referenced, which is what keeps three.js out of the route shell
// and inside its own lazy chunk (D-10).

import dynamic from 'next/dynamic';
import { useEffect } from 'react';

import { ensureHistory } from '../../lib/data/history';
import { useAppStore } from '../../lib/stores/app';
import { useSceneStore } from '../../lib/stores/scene';
import { AudioControl } from './AudioControl';
import { DetailPanel } from './DetailPanel';
import { SceneFade } from './SceneFade';
import { SceneNav } from './SceneNav';

const RoomCanvas = dynamic(() => import('../../scene/RoomCanvas'), { ssr: false });

/**
 * The hall's wall shows every habit's year (design-system/13 §8), which the room
 * never loads. Fetched on arrival in the hall, and again if a sign-in or a
 * sign-out has reset it while there. Renders nothing.
 */
function HallHistory() {
  const inHall = useSceneStore((s) => s.current === 'hall');
  const hydrated = useAppStore((s) => s.hydrated);
  const unloaded = useAppStore((s) => s.history === null);
  useEffect(() => {
    if (inHall && hydrated && unloaded) void ensureHistory();
  }, [inHall, hydrated, unloaded]);
  return null;
}

export default function RoomPage() {
  return (
    <main>
      <RoomCanvas />
      <SceneNav />
      <DetailPanel />
      <AudioControl />
      <SceneFade />
      <HallHistory />
    </main>
  );
}
