// The hall's chunk (design-system/13 §7). Fetched the first time the room's door
// is hovered or armed, or when the canvas needs it — never with the room
// (10-tech-stack). One import, shared: webpack serves the same chunk to both.

type HallModule = typeof import('./HallScene');

let pending: Promise<HallModule> | null = null;
let loaded = false;

export function loadHall(): Promise<HallModule> {
  pending ??= import('./HallScene').then(
    (module) => {
      loaded = true;
      return module;
    },
    (error: unknown) => {
      // Offline or a failed fetch: let the next ask try again.
      pending = null;
      throw error;
    },
  );
  return pending;
}

/** Whether the chunk is here — offline, the door opens only if it is (13 §7). */
export function hallLoaded(): boolean {
  return loaded;
}
