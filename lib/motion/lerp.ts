// The one lerp every state-driven room surface uses (spec/05 §3).
//
// Per-frame and exponential: each frame closes `k` of the remaining gap, so a
// surface eases toward its target and never overshoots. Under
// prefers-reduced-motion callers pass k = 1, which snaps — motion is removed,
// not slowed (03-motion.md principle 5).

export function lerpTo(current: number, target: number, k: number): number {
  return current + (target - current) * k;
}
