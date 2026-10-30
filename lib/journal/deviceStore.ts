// The journal on the device — D-26 §5, spec/02 FR-3.6 (amended 2026-10-29).
//
// Journal writing lives only in this browser's IndexedDB. Nothing in this file
// talks to the network, and nothing that calls it may send `title` or `body`
// anywhere: the server keeps the date, moods, energy, tags and prompt, never
// the words.
//
// Phase 7 P0's device-journal test drives this module in Chromium, Firefox and
// WebKit (scripts/journal-device-check.ts). It has no imports and only erasable
// type syntax, so the test can strip its types and load it into a page as is.

export const JOURNAL_DB = 'bbe-journal';
const DB_VERSION = 1;
const STORE = 'entries';
const BY_OWNER = 'byOwner';

/** Format tag and version of an export file. Import refuses anything else. */
export const EXPORT_FORMAT = 'bbe-journal-export';
export const EXPORT_VERSION = 1;

/** PROPOSED caps. A journal page is long-form, so far above FR-3.1's 2000. */
export const LIMITS = { title: 200, body: 20000, tags: 12, moods: 4 } as const;

export type EntryType = 'check-in' | 'free' | 'guided';

export interface DeviceEntry {
  id: string;
  /** The account that wrote it. Entries are shown only to their owner. */
  ownerId: string;
  /** YYYY-MM-DD in the account's time zone. */
  localDate: string;
  type: EntryType;
  title: string | null;
  body: string;
  /** Id of the guided prompt used, if any. */
  prompt: string | null;
  tags: string[];
  moods: string[];
  energy: 1 | 2 | 3 | 4 | 5 | null;
  /** A quick check-in's four short answers (functional spec J01). */
  fields?: CheckInFields;
  createdAt: string;
  updatedAt: string;
}

export const CHECK_IN_FIELDS = ['positive', 'difficult', 'lesson', 'tomorrow'] as const;
export type CheckInField = (typeof CHECK_IN_FIELDS)[number];
export type CheckInFields = Partial<Record<CheckInField, string>>;
const FIELD_MAX = 2000;

/** J01: an entry saves with one non-empty field — any text, mood or energy. */
export function hasContent(e: Pick<DeviceEntry, 'title' | 'body' | 'moods' | 'energy' | 'fields'>): boolean {
  return Boolean(
    e.body.trim() ||
      e.title?.trim() ||
      e.moods.length ||
      e.energy !== null ||
      Object.values(e.fields ?? {}).some((v) => v?.trim()),
  );
}

export interface JournalExport {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  entries: DeviceEntry[];
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function openJournal(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(JOURNAL_DB, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex(BY_OWNER, 'ownerId', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Saves an entry after checking it. Throws with the field that failed. */
export async function saveEntry(db: IDBDatabase, entry: DeviceEntry): Promise<void> {
  const problem = checkEntry(entry);
  if (problem) throw new Error(`journal entry refused: ${problem}`);
  const tx = db.transaction(STORE, 'readwrite');
  tx.objectStore(STORE).put(entry);
  await done(tx);
}

/** One owner's entries, newest first. Another account's are never returned. */
export async function listEntries(db: IDBDatabase, ownerId: string): Promise<DeviceEntry[]> {
  const tx = db.transaction(STORE, 'readonly');
  const all = await request(tx.objectStore(STORE).index(BY_OWNER).getAll(ownerId));
  return (all as DeviceEntry[]).sort((a, b) =>
    a.localDate === b.localDate ? b.createdAt.localeCompare(a.createdAt) : b.localDate.localeCompare(a.localDate),
  );
}

/** Deletes one entry, only if it belongs to `ownerId`. Returns whether it did. */
export async function deleteEntry(db: IDBDatabase, ownerId: string, id: string): Promise<boolean> {
  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  const entry = (await request(store.get(id))) as DeviceEntry | undefined;
  const owned = entry?.ownerId === ownerId;
  if (owned) store.delete(id);
  await done(tx);
  return owned;
}

export async function countEntries(db: IDBDatabase, ownerId: string): Promise<number> {
  const tx = db.transaction(STORE, 'readonly');
  return request(tx.objectStore(STORE).index(BY_OWNER).count(ownerId));
}

/**
 * Search on the device: every word of the query must appear in the title,
 * body or tags, case-insensitive. Optional inclusive date range.
 */
export async function searchEntries(
  db: IDBDatabase,
  ownerId: string,
  query: string,
  range: { from?: string; to?: string } = {},
): Promise<DeviceEntry[]> {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const entries = await listEntries(db, ownerId);
  return entries.filter((e) => {
    if (range.from && e.localDate < range.from) return false;
    if (range.to && e.localDate > range.to) return false;
    const fields = Object.values(e.fields ?? {}).join('\n');
    const hay = `${e.title ?? ''}\n${e.body}\n${fields}\n${e.tags.join(' ')}`.toLocaleLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/**
 * Sign-out deletes this account's journal from the device (D-26 §5). The
 * caller warns first, with this count, and offers `exportJournal` (D-22 §5).
 * Returns how many entries were deleted.
 */
export async function deleteAllFor(db: IDBDatabase, ownerId: string): Promise<number> {
  const tx = db.transaction(STORE, 'readwrite');
  const index = tx.objectStore(STORE).index(BY_OWNER);
  const keys = await request(index.getAllKeys(ownerId));
  for (const key of keys) tx.objectStore(STORE).delete(key);
  await done(tx);
  return keys.length;
}

export async function exportJournal(db: IDBDatabase, ownerId: string, now = new Date()): Promise<string> {
  const file: JournalExport = {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    entries: await listEntries(db, ownerId),
  };
  return JSON.stringify(file, null, 2);
}

export interface ImportResult {
  added: number;
  /** Entries with an id already on the device; the device's copy is kept. */
  skipped: number;
}

/**
 * Imports an export file into `ownerId`'s journal. The whole file is checked
 * before anything is written; one bad entry refuses the file. Every entry is
 * re-owned by the importing account.
 */
export async function importJournal(db: IDBDatabase, ownerId: string, text: string): Promise<ImportResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('import refused: the file is not JSON');
  }
  const file = parsed as Partial<JournalExport> | null;
  if (!file || file.format !== EXPORT_FORMAT) throw new Error('import refused: not a journal export');
  if (file.version !== EXPORT_VERSION) throw new Error(`import refused: version ${String(file.version)} is not supported`);
  if (!Array.isArray(file.entries)) throw new Error('import refused: no entries');

  const entries = file.entries.map((e) => ({ ...e, ownerId }));
  entries.forEach((e, i) => {
    const problem = checkEntry(e);
    if (problem) throw new Error(`import refused: entry ${i + 1}: ${problem}`);
  });

  const tx = db.transaction(STORE, 'readwrite');
  const store = tx.objectStore(STORE);
  let added = 0;
  let skipped = 0;
  for (const e of entries) {
    const existing = await request(store.getKey(e.id));
    if (existing === undefined) {
      store.put(e);
      added += 1;
    } else {
      skipped += 1;
    }
  }
  await done(tx);
  return { added, skipped };
}

export interface StorageState {
  /** Whether the browser has already marked this site's storage persistent. */
  persisted: boolean | null;
  /** The answer to asking for persistence, or null if it did not settle. */
  granted: boolean | null;
  usage: number | null;
  quota: number | null;
}

/**
 * Asks the browser not to evict the journal under storage pressure. Some
 * browsers prompt or decide by heuristics, so the request is bounded.
 */
export async function requestPersistence(timeoutMs = 3000): Promise<StorageState> {
  const sm = typeof navigator !== 'undefined' ? navigator.storage : undefined;
  if (!sm) return { persisted: null, granted: null, usage: null, quota: null };
  const persisted = sm.persisted ? await sm.persisted() : null;
  const granted = sm.persist
    ? await Promise.race([sm.persist(), new Promise<null>((r) => setTimeout(() => r(null), timeoutMs))])
    : null;
  const estimate = sm.estimate ? await sm.estimate() : {};
  return { persisted, granted, usage: estimate.usage ?? null, quota: estimate.quota ?? null };
}

/** Returns what is wrong with an entry, or null. */
export function checkEntry(e: DeviceEntry): string | null {
  if (!e || typeof e !== 'object') return 'not an object';
  if (typeof e.id !== 'string' || e.id.length < 8 || e.id.length > 64) return 'id';
  if (typeof e.ownerId !== 'string' || !e.ownerId) return 'ownerId';
  if (typeof e.localDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(e.localDate)) return 'localDate';
  if (e.type !== 'check-in' && e.type !== 'free' && e.type !== 'guided') return 'type';
  if (e.title !== null && (typeof e.title !== 'string' || e.title.length > LIMITS.title)) return 'title';
  if (typeof e.body !== 'string' || e.body.length > LIMITS.body) return 'body';
  if (e.prompt !== null && typeof e.prompt !== 'string') return 'prompt';
  if (!Array.isArray(e.tags) || e.tags.length > LIMITS.tags || !e.tags.every((t) => typeof t === 'string')) return 'tags';
  if (!Array.isArray(e.moods) || e.moods.length > LIMITS.moods || !e.moods.every((m) => typeof m === 'string')) return 'moods';
  if (e.energy !== null && ![1, 2, 3, 4, 5].includes(e.energy as number)) return 'energy';
  if (e.fields !== undefined) {
    if (!e.fields || typeof e.fields !== 'object') return 'fields';
    for (const [k, v] of Object.entries(e.fields)) {
      if (!(CHECK_IN_FIELDS as readonly string[]).includes(k)) return 'fields';
      if (v !== undefined && (typeof v !== 'string' || v.length > FIELD_MAX)) return 'fields';
    }
  }
  if (typeof e.createdAt !== 'string' || Number.isNaN(Date.parse(e.createdAt))) return 'createdAt';
  if (typeof e.updatedAt !== 'string' || Number.isNaN(Date.parse(e.updatedAt))) return 'updatedAt';
  return null;
}
