import { create } from 'zustand';

// Interaction state for the desk scene (Checkpoint B).
// - `hovered`: id of the object currently under the pointer (drives label +
//   emissive/scale lift). Null when nothing is hovered.
// - `focus`: the object the camera has glided to. Null = camera at rest.
// - `panel`: which DOM overlay panel is open. Derived from the focused object
//   but stored explicitly so the panel can outlive a camera glide.

export type ObjectId =
  | 'monitor1'
  | 'monitor2'
  | 'notebook'
  | 'headphones'
  | 'phone'
  | 'window'
  | 'door';

export type PanelId = 'projects' | 'terminal' | 'notebook' | 'contact' | null;

interface InteractionState {
  hovered: string | null;
  focus: ObjectId | null;
  panel: PanelId;
  setHovered: (id: string | null) => void;
  /** Glide the camera to `id` and open `panel`. */
  focusObject: (id: ObjectId, panel: PanelId) => void;
  /** Clear focus + panel — camera glides back to rest. */
  returnToDesk: () => void;
}

export const useInteractionStore = create<InteractionState>(set => ({
  hovered: null,
  focus: null,
  panel: null,
  setHovered: hovered => set({ hovered }),
  focusObject: (id, panel) => set({ focus: id, panel, hovered: null }),
  returnToDesk: () => set({ focus: null, panel: null }),
}));
