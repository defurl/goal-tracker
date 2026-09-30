// When the bonsai's earned leaves appear (A5.5). Pure, so the timing is
// tested without a scene; scene/objects/Bonsai.tsx runs it in its frame loop.
//
// A leaf the user earns in this session gets the one sharp motion the room
// allows: a droplet into the pot over DROP_MS, then the leaf grows over
// REVEAL_MS (03-motion.md). Several at once come one at a time, a droplet
// each, LEAF_STAGGER_MS apart. Leaves a load brought, and every leaf under
// reduced motion, are there at once — the caller skips the schedule.

export const DROP_MS = 180; // --dur-tick
export const REVEAL_MS = 900; // --dur-reveal

/**
 * Between one leaf's droplet and the next's. Past DROP_MS, so only one droplet
 * is ever in the air and one mesh serves them all; inside the motion range
 * (600–2200 ms), so a run of leaves reads as a sequence and not as a wait.
 * PROPOSED.
 */
export const LEAF_STAGGER_MS = 600;

export interface LeafRun {
  /** When this leaf's droplet starts to fall (clock ms). */
  dropAt: number;
  /** When the leaf starts to grow: as its droplet lands. */
  revealAt: number;
}

/**
 * The runs for `count` newly earned leaves at `now`. A run already under way
 * keeps its place: `lastDropAt` is the latest droplet still queued or falling,
 * and the new ones follow it.
 */
export function scheduleLeaves(count: number, now: number, lastDropAt: number | null): LeafRun[] {
  const first = lastDropAt === null ? now : Math.max(now, lastDropAt + LEAF_STAGGER_MS);
  return Array.from({ length: Math.max(0, count) }, (_, i) => {
    const dropAt = first + i * LEAF_STAGGER_MS;
    return { dropAt, revealAt: dropAt + DROP_MS };
  });
}

/** How far the droplet starting at `dropAt` has fallen at `now`, 0 → 1, or null if it is not in the air. */
export function dropProgress(dropAt: number | undefined, now: number): number | null {
  if (dropAt === undefined || now < dropAt || now - dropAt >= DROP_MS) return null;
  return (now - dropAt) / DROP_MS;
}
