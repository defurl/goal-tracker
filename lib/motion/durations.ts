// The motion tokens the frame loop and the DOM both need, as numbers.
// Mirrors styles/tokens.css (design-system/03-motion.md): keep them in step by
// name. Pure, no three.js, so the route shell can import it (D-10).

/** --dur-camera: every camera glide (07-camera). */
export const CAMERA_MS = 2200;

/**
 * Each half of a scene change's fade (design-system/13 §7): out 400, in 400.
 * With the glide to the door, 2200 + 400 + 400 = --dur-scene (3000).
 */
export const SCENE_FADE_MS = 400;
