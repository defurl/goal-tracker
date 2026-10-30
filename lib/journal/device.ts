'use client';

// The journal on this device (FR-3.6 as amended by D-26 §5): entries live in
// IndexedDB under the signed-in account, or under `guest` when nobody is
// signed in. The server hears only a check-in's mood and tags, which earn the
// day's journal points; it never receives a title, body or answer.

import { create } from 'zustand';

import { saveEntry as saveServerMood } from '../data/journal';
import { getSession, today } from '../data/session';
import { localDate, browserTimeZone } from '../data/time';
import { MOOD_KEYS } from './moods';
import {
  countEntries,
  deleteAllFor,
  deleteEntry,
  exportJournal,
  importJournal,
  listEntries,
  openJournal,
  requestPersistence,
  saveEntry,
  type DeviceEntry,
  type ImportResult,
} from './deviceStore';

export const GUEST_OWNER = 'guest';

interface JournalState {
  owner: string | null;
  entries: DeviceEntry[];
  loaded: boolean;
  /** Storage was refused or failed: the board says so and keeps the draft. */
  unavailable: boolean;
}

export const useJournalStore = create<JournalState>(() => ({
  owner: null,
  entries: [],
  loaded: false,
  unavailable: false,
}));

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbPromise ??= openJournal().catch((error: unknown) => {
    dbPromise = null;
    throw error;
  });
  return dbPromise;
}

export function currentOwner(): string {
  return getSession()?.userId ?? GUEST_OWNER;
}

export function localToday(): string {
  const session = getSession();
  return session ? today(session) : localDate(browserTimeZone());
}

/** Loads the current owner's entries. Called when the board mounts and when the account changes. */
export async function loadDeviceJournal(): Promise<void> {
  const owner = currentOwner();
  try {
    const entries = await listEntries(await db(), owner);
    useJournalStore.setState({ owner, entries, loaded: true, unavailable: false });
  } catch {
    useJournalStore.setState({ owner, entries: [], loaded: true, unavailable: true });
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export type EntryDraft = Omit<DeviceEntry, 'id' | 'ownerId' | 'createdAt' | 'updatedAt' | 'localDate'> & {
  localDate?: string;
};

/**
 * Saves a new entry, or updates `id`. Returns the saved entry, or null when
 * the device refused it — the caller keeps the text and offers retry (F-02).
 */
export async function putEntry(draft: EntryDraft, id?: string): Promise<DeviceEntry | null> {
  const owner = currentOwner();
  const now = new Date().toISOString();
  const existing = id ? useJournalStore.getState().entries.find((e) => e.id === id) : undefined;
  const entry: DeviceEntry = {
    ...draft,
    id: existing?.id ?? newId(),
    ownerId: owner,
    localDate: draft.localDate ?? existing?.localDate ?? localToday(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  try {
    await saveEntry(await db(), entry);
  } catch {
    return null;
  }
  await loadDeviceJournal();

  // The day's mood reaches the server for points and the year view — the
  // mood key and tags only, and only for a mood the server knows.
  const mood = entry.moods.find((m) => (MOOD_KEYS as readonly string[]).includes(m));
  if (owner !== GUEST_OWNER && mood) void saveServerMood({ mood, tags: entry.tags.slice(0, 8) });
  return entry;
}

export async function removeEntry(id: string): Promise<boolean> {
  try {
    const ok = await deleteEntry(await db(), currentOwner(), id);
    await loadDeviceJournal();
    return ok;
  } catch {
    return false;
  }
}

export async function journalCount(owner = currentOwner()): Promise<number> {
  try {
    return await countEntries(await db(), owner);
  } catch {
    return 0;
  }
}

/** Starts a download of the owner's journal as a JSON file. */
export async function downloadExport(): Promise<boolean> {
  try {
    const text = await exportJournal(await db(), currentOwner());
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `be-better-everyday-journal-${localToday()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch {
    return false;
  }
}

export async function importFile(file: File): Promise<ImportResult | string> {
  try {
    const result = await importJournal(await db(), currentOwner(), await file.text());
    await loadDeviceJournal();
    return result;
  } catch (error) {
    return error instanceof Error ? error.message.replace(/^import refused: /, '') : 'the file could not be read';
  }
}

/** Sign-out: deletes this account's entries from the device (D-26 §5). */
export async function clearDeviceJournal(owner = currentOwner()): Promise<number> {
  try {
    const n = await deleteAllFor(await db(), owner);
    useJournalStore.setState({ entries: [], owner: null, loaded: false });
    return n;
  } catch {
    return 0;
  }
}

export { requestPersistence };
