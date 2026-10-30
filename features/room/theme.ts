// The room theme manifest (design-system/v2/05-room.md, D-27 §1): six matched
// renders of one scene, where each module's object sits on the Home render,
// and where the overview zooms toward for each focus view.
//
// `sunny` holds the Blender stand-in renders (scripts/room/render_views.py)
// until the design team's art replaces the files at the same paths.

export type FocusKey = 'today' | 'journal' | 'growth' | 'skills' | 'selfcare';
export type ViewKey = 'home' | FocusKey | 'settings';

export interface ImageSet {
  avif: string;
  webp: string;
  width: number;
  height: number;
}

export interface RoomHotspot {
  id: FocusKey;
  route: string;
  /** Normalised 0-1 on the Home image. */
  x: number;
  y: number;
  label: string;
  /** What the object is, for the accessible name. */
  object: string;
}

export interface FocusScene {
  image: ImageSet;
  /** Where the overview zooms toward, normalised on the Home image. */
  focal: { x: number; y: number };
}

export interface RoomTheme {
  id: string;
  overview: ImageSet;
  focuses: Record<FocusKey, FocusScene>;
  hotspots: RoomHotspot[];
}

const W = 2560;
const H = 1440;
const set = (name: string): ImageSet => ({
  avif: `/room/sunny/${name}.avif`,
  webp: `/room/sunny/${name}.webp`,
  width: W,
  height: H,
});

export const SUNNY: RoomTheme = {
  id: 'sunny',
  overview: set('home'),
  focuses: {
    today: { image: set('today'), focal: { x: 0.28, y: 0.74 } },
    journal: { image: set('journal'), focal: { x: 0.26, y: 0.76 } },
    growth: { image: set('growth'), focal: { x: 0.45, y: 0.5 } },
    skills: { image: set('skills'), focal: { x: 0.88, y: 0.48 } },
    selfcare: { image: set('selfcare'), focal: { x: 0.13, y: 0.66 } },
  },
  hotspots: [
    { id: 'today', route: '/today', x: 0.34, y: 0.66, label: 'Today', object: 'the coffee table' },
    { id: 'journal', route: '/journal', x: 0.22, y: 0.8, label: 'Journal', object: 'the notebook' },
    { id: 'growth', route: '/growth', x: 0.44, y: 0.45, label: 'Growth Map', object: 'the window plant' },
    { id: 'skills', route: '/skills', x: 0.87, y: 0.34, label: 'Skills', object: 'the bookshelf' },
    { id: 'selfcare', route: '/self-care', x: 0.11, y: 0.6, label: 'Self Care', object: 'the sofa' },
  ],
};

/** The persistent menu, in the handoff's order (doc 01 §1). */
export const MENU: readonly { view: FocusKey; route: string; label: string }[] = [
  { view: 'today', route: '/today', label: 'Today' },
  { view: 'journal', route: '/journal', label: 'Journal' },
  { view: 'growth', route: '/growth', label: 'Growth Map' },
  { view: 'skills', route: '/skills', label: 'Skills' },
  { view: 'selfcare', route: '/self-care', label: 'Self Care' },
];

export const HOME_ROUTE = '/room';

/** The URL is the source of truth (handoff 03 §2). */
export function viewForPath(pathname: string): ViewKey {
  const first = `/${pathname.split('/')[1] ?? ''}`;
  if (first === '/settings') return 'settings';
  return MENU.find((m) => m.route === first)?.view ?? 'home';
}

export function isFocus(view: ViewKey): view is FocusKey {
  return view !== 'home' && view !== 'settings';
}

/**
 * How the room moves from one view to the next (handoff 01 §5): zoom in from
 * Home, zoom out to Home, crossfade between two focus views. Under reduced
 * motion every change is an immediate swap.
 */
export type Move = 'none' | 'swap' | 'zoom-in' | 'zoom-out' | 'crossfade';

export function planMove(from: ViewKey, to: ViewKey, reducedMotion: boolean): Move {
  if (from === to) return 'none';
  if (reducedMotion) return 'swap';
  if (from === 'home') return 'zoom-in';
  if (to === 'home') return 'zoom-out';
  return 'crossfade';
}
