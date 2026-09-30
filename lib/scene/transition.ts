// Changing scenes: the room ↔ the hall behind its door (design-system/13 §7,
// 08-interaction-grammar §4 "transition: full scene change behind a fade").
//
// In:  glide to the door pose (CAMERA_MS) → fade to BG_VOID (SCENE_FADE_MS) →
//      swap the scene → the canvas compiles it and calls sceneReady() → fade in.
// Back: fade out → swap → compiled → fade in. No glide: the room returns at rest.
//
// Under reduced motion there is no glide, and the CSS escape hatch collapses the
// fade to a cut (03-motion principle 5: removed, not reduced).
//
// DOM-side and three-free, so the route shell can import it (D-10). It writes
// the scene and interaction stores only, as the DOM controls do.

import { CAMERA_MS, SCENE_FADE_MS } from '../motion/durations';
import { useInteractionStore } from '../stores/interaction';
import { useSceneStore, type SceneKey } from '../stores/scene';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

let changing = false;

async function swapTo(scene: SceneKey): Promise<void> {
  const { prefersReducedMotion, setTransitioning } = useSceneStore.getState();
  setTransitioning(true);
  if (!prefersReducedMotion) await wait(SCENE_FADE_MS);
  useInteractionStore.getState().returnToDesk();
  useSceneStore.getState().setScene(scene);
  changing = false;
}

/** Step through the door. A second call while one is under way does nothing. */
export async function enterHall(): Promise<void> {
  if (changing || useSceneStore.getState().current !== 'room') return;
  changing = true;
  if (!useSceneStore.getState().prefersReducedMotion) {
    useInteractionStore.getState().focusObject('door', null);
    await wait(CAMERA_MS);
    // Back or Escape during the glide: the user changed their mind.
    if (useInteractionStore.getState().focus !== 'door') {
      changing = false;
      return;
    }
  }
  await swapTo('hall');
}

/** Back through the door, to the room at rest. */
export async function leaveHall(): Promise<void> {
  if (changing || useSceneStore.getState().current !== 'hall') return;
  changing = true;
  await swapTo('room');
}

/** The canvas calls this once the new scene's programs are compiled: fade in. */
export function sceneReady(): void {
  if (useSceneStore.getState().transitioning) useSceneStore.getState().setTransitioning(false);
}
