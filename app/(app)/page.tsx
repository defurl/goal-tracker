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

import { SceneNav } from './SceneNav';

const RoomCanvas = dynamic(() => import('../../scene/RoomCanvas'), { ssr: false });

export default function RoomPage() {
  return (
    <main>
      <RoomCanvas />
      <SceneNav />
    </main>
  );
}
