// useInteractionStore — carried over from the portfolio unchanged in shape.
// See spec/05-scene-state-contract.md §2 and design-system/08-interaction-grammar.md.
//
// Two properties to preserve:
//   1. `panel` is DERIVED from the focused object but STORED EXPLICITLY, so a
//      panel can outlive a camera glide.
//   2. `focusObject` clears `hovered` in the same `set`, so a label never
//      lingers behind an opening panel.

import { create } from 'zustand';

/**
 * Every object the camera can focus. Objects are the navigation — there is no
 * menu (D-04). Mapping to features: design-system/12-habit-tracker-adaptation.md §2.
 */
export type ObjectId =
  | 'monitor1' // Daily Challenge
  | 'monitor2' // Goal Dashboard
  | 'notebook' // Journal
  | 'phone' // Article Import
  | 'headphones' // Focus mode — toggle, opens no panel
  | 'bonsai' // Growth / points
  | 'wallGrid' // The 365-day tracker
  | 'window' // Time of day
  | 'door'; // Route to the second scene

export type PanelId =
  | 'challenge'
  | 'goals'
  | 'journal'
  | 'import'
  | 'habits'
  | null;

export interface InteractionState {
  /** Drives the in-world label and the hover emissive lift. */
  hovered: string | null;
  /** Drives the camera rig. Null = camera at rest. */
  focus: ObjectId | null;
  /** Drives the DOM overlay. */
  panel: PanelId;
  setHovered: (id: string | null) => void;
  /** Glide the camera to `id` and open `panel`. Clears `hovered` in the same set. */
  focusObject: (id: ObjectId, panel: PanelId) => void;
  /** Clear focus and panel — the camera glides back to rest. */
  returnToDesk: () => void;
}

export const useInteractionStore = create<InteractionState>((set) => ({
  hovered: null,
  focus: null,
  panel: null,
  setHovered: (hovered) => set({ hovered }),
  focusObject: (id, panel) => set({ focus: id, panel, hovered: null }),
  returnToDesk: () => set({ focus: null, panel: null }),
}));
