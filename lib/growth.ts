// The single source of truth for how points become leaves.
//
// spec/05-scene-state-contract.md §4: `points.total` is server-owned and
// authoritative; `leafCount` is DERIVED from it, and the derivation lives in
// exactly one place. Two implementations of this will drift, and the drift shows
// up as the bonsai disagreeing with the number printed next to it. Both the
// scene and /text import this function — neither computes its own.

/**
 * Thresholds are **PROPOSED** (spec/05 §4): 20 / 45 / 70 / 100, then every 100.
 * They need a real points history to tune against. The signature is what
 * matters; the curve is adjustable here and nowhere else.
 */
const EARLY_THRESHOLDS = [20, 45, 70, 100];

/** Every this many points past the last early threshold adds one leaf. */
const LATE_INTERVAL = 100;

/**
 * The cap is what makes the curve asymptotic rather than unbounded, and it is
 * also the `InstancedMesh` count the bonsai allocates — one draw call, fixed
 * size. A long-term user reaches a full bonsai, not an ever-growing shrub.
 */
export const MAX_LEAVES = 64;

/**
 * Leaves earned by a lifetime points total.
 *
 * **Monotonic by construction**, because `points.total` is monotonic — there are
 * no negative ledger rows (D-08). If a leaf ever disappears, something upstream
 * is broken: that is a bug, not a state.
 */
export function leafCountForPoints(total: number): number {
  if (!Number.isFinite(total) || total < (EARLY_THRESHOLDS[0] as number)) return 0;

  let leaves = 0;
  for (const threshold of EARLY_THRESHOLDS) {
    if (total >= threshold) leaves++;
  }

  const lastEarly = EARLY_THRESHOLDS[EARLY_THRESHOLDS.length - 1] as number;
  if (total > lastEarly) {
    leaves += Math.floor((total - lastEarly) / LATE_INTERVAL);
  }

  return Math.min(leaves, MAX_LEAVES);
}
