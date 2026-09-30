// useAppStore — application state. See spec/05-scene-state-contract.md §2.
//
// THE RULE (spec/05 §1, LOCKED): the 3D scene reads from this store, never from
// the network. A data layer under lib/data/ is the ONLY writer. Scene code reads
// imperatively inside useFrame via `useAppStore.getState()` and never subscribes
// to a per-tick value — a subscription re-renders the React tree 60×/second.
//
// DOM components in overlay/ and the /text route subscribe normally. The
// imperative-read rule applies only inside useFrame.
//
// Phase 0 ships the shape and the initial state. Actions land with the data
// layer in Phase 1 (spec/06-build-plan.md, track B).

import { create } from 'zustand';

import type { Database } from '../supabase/database.types';

/** 0 unfilled · 1 filled · 2 today. 365 entries, oldest first. */
export type DayCell = 0 | 1 | 2;

/**
 * The database's goal_category enum, derived rather than restated so the two
 * cannot drift apart again (they did: this once read `personal`, which the
 * schema never had). Owner decision 2026-09-24: the schema's six are the set.
 */
export type GoalCategory = Database['public']['Enums']['goal_category'];

export interface HabitSummary {
  id: string;
  name: string;
  type: 'build' | 'break';
  dueToday: boolean;
  completedToday: boolean;
  streak: number;
  /** Displayed as the primary number. A reset of `streak` is never announced (D-09). */
  longestStreak: number;
}

export interface GoalSummary {
  id: string;
  title: string;
  category: GoalCategory;
  /** 0–1, milestones complete / total. */
  progress: number;
  /** ISO date. */
  startDate: string;
  targetDate: string;
}

export interface Challenge {
  id: string | null;
  actionText: string;
  sourceSummary: string;
  sourceUrl: string | null;
  complete: boolean;
  rollCount: number;
  /** Capped at 3 per day (D-15). The control disables with a stated reason. */
  rollsRemaining: number;
}

export interface AppState {
  // ── Feature 1: Daily Challenge ────────────────────────────────────────────
  /** null = no pending actions — the FR-1.7 empty state, not an error. */
  challenge: Challenge | null;
  /** Phone screen emissive warms while true (spec/05 §3). */
  importing: boolean;

  // ── Feature 2: Habits ─────────────────────────────────────────────────────
  points: {
    /** Server-owned and authoritative. Monotonic — there are no negative rows (D-08). */
    total: number;
    today: number;
    /** DERIVED from `total` by lib/growth.ts. Never set independently (spec/05 §4). */
    leafCount: number;
  };
  /**
   * How the bonsai shows the leaves the last `points` write added (A5.5).
   * 'grow' when the user's own action in this session earned them — a droplet
   * and a reveal, one leaf at a time. 'appear' when a load brought them: the
   * first hydrate, a rehydrate on sign-in or back online, a snapshot. Those
   * leaves were earned before, elsewhere, and are simply there.
   */
  leafArrival: 'grow' | 'appear';
  habits: HabitSummary[];
  /** 365 entries, oldest first. Drives the wall grid instance colours. */
  dayGrid: DayCell[];

  // ── Feature 3: Journal ────────────────────────────────────────────────────
  journal: {
    todayLogged: boolean;
    reflectionsRemaining: number;
  };

  // ── Feature 4: Goals ──────────────────────────────────────────────────────
  goals: GoalSummary[];

  // ── Ambient ───────────────────────────────────────────────────────────────
  /** 0–23 in the user's timezone. Drives the window sky plane (spec/05 §5). */
  localHour: number;
  /** Headphones toggle. Drives ambient audio gain only. */
  focusMode: boolean;
  /**
   * When the two-minute timer ends (epoch ms) while focus is on, else null
   * (A5.2). The corner and /text count down from it; the scene never reads it.
   */
  focusEndsAt: number | null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  hydrated: boolean;
  offline: boolean;
}

export const initialAppState: AppState = {
  challenge: null,
  importing: false,
  points: { total: 0, today: 0, leafCount: 0 },
  leafArrival: 'appear',
  habits: [],
  dayGrid: [],
  journal: { todayLogged: false, reflectionsRemaining: 0 },
  goals: [],
  localHour: 0,
  focusMode: false,
  focusEndsAt: null,
  hydrated: false,
  offline: false,
};

export const useAppStore = create<AppState>(() => ({ ...initialAppState }));
