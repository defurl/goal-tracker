// prefers-reduced-motion detection. 03-motion.md principle 5 and CLAUDE.md
// non-negotiable 4: ambient motion is REMOVED under reduced motion, not reduced.
//
// The hook writes into useSceneStore; 3D code reads
// `useSceneStore.getState().prefersReducedMotion` inside useFrame rather than
// subscribing, to avoid re-rendering the tree.

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(QUERY).matches;
}

/** Subscribe to changes. Returns an unsubscribe function. */
export function watchReducedMotion(onChange: (reduced: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const media = window.matchMedia(QUERY);
  const handler = (e: MediaQueryListEvent) => onChange(e.matches);
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}
