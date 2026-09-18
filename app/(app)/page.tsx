// The room. Phase 0 ships the route empty — the scene arrives in Phase 1 track A,
// and only after the lighting acceptance test reads TRUE on all five criteria
// (spec/06-build-plan.md).
//
// When the canvas lands here it mounts through next/dynamic with { ssr: false }:
// React Three Fiber cannot be server-rendered, and getting this wrong fails the
// build at prerender time with an opaque error (D-06).

export default function RoomPage() {
  return (
    <main>
      <h1>Be Better Everyday</h1>
    </main>
  );
}
