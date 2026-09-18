// useSceneStore — carried over from the portfolio unchanged.
// See spec/05-scene-state-contract.md §2.
//
// `prefersReducedMotion` is written by the matchMedia hook in lib/motion/ and
// read inside useFrame via getState(). Under it, every lerp in the state→surface
// table snaps (k = 1) and ambient motion is REMOVED, not reduced (03-motion.md
// principle 5).

import { create } from 'zustand';

/** One room in Phase 1. The door spill routes to a second scene later. */
export type SceneKey = 'room';

export interface SceneState {
  current: SceneKey;
  transitioning: boolean;
  prefersReducedMotion: boolean;
  isMobile: boolean;
  /** From useAdaptiveFps — gates bloom and dpr. */
  lowFps: boolean;
  setScene: (s: SceneKey) => void;
  setTransitioning: (t: boolean) => void;
  setPrefersReducedMotion: (r: boolean) => void;
  setIsMobile: (m: boolean) => void;
  setLowFps: (l: boolean) => void;
}

export const useSceneStore = create<SceneState>((set) => ({
  current: 'room',
  transitioning: false,
  prefersReducedMotion: false,
  isMobile: false,
  lowFps: false,
  setScene: (current) => set({ current }),
  setTransitioning: (transitioning) => set({ transitioning }),
  setPrefersReducedMotion: (prefersReducedMotion) => set({ prefersReducedMotion }),
  setIsMobile: (isMobile) => set({ isMobile }),
  setLowFps: (lowFps) => set({ lowFps }),
}));
