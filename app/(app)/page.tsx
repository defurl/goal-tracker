'use client';

// The room. Phase 1 track A ships the empty room: shell, Ando detailing, desk
// and the five-light rig. Nothing else enters until the lighting acceptance
// test reads TRUE on all five criteria (design-system/05-lighting-rig.md §4).
//
// The canvas is mounted through next/dynamic with { ssr: false } because React
// Three Fiber cannot be server-rendered (D-06). It is also the only place the
// 3D chunk is referenced, which is what keeps three.js out of the route shell
// and inside its own lazy chunk (D-10).

import dynamic from 'next/dynamic';

const RoomCanvas = dynamic(() => import('../../scene/RoomCanvas'), { ssr: false });

export default function RoomPage() {
  return (
    <main>
      <RoomCanvas />
    </main>
  );
}
