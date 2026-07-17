// ─── Offline write queue ────────────────────────────────────────────────────
// Pure, framework-agnostic (mirrors src/lib/ledger.ts). Persists mutations
// that couldn't reach the server to localStorage, and replays them in order
// once the connection is back. No Mongoose/Next imports here on purpose —
// this runs entirely in the browser.

const STORAGE_KEY = 'steelvault:pending-queue';

export interface QueuedRequest {
  id: string;
  url: string;
  method: string;
  body?: string;
  queuedAt: string;
}

export function getQueue(): QueuedRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedRequest[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
}

export function enqueue(req: { url: string; method: string; body?: string }): QueuedRequest {
  const entry: QueuedRequest = {
    id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...req,
    queuedAt: new Date().toISOString(),
  };
  saveQueue([...getQueue(), entry]);
  return entry;
}

export function dequeue(id: string) {
  saveQueue(getQueue().filter(r => r.id !== id));
}

// ─── Dirty flag ─────────────────────────────────────────────────────────────
// Set whenever any mutation lands (even one that reached the local/server DB
// fine) and cleared only by a successful sync. This is what flips the TopBar
// button from "Saved" to "Save" — on the desktop app every write succeeds
// against the LOCAL database, so the queue alone can't tell us whether the
// cloud has the latest data; this flag tracks "changed since last sync".
const DIRTY_KEY = 'steelvault:dirty';

export function isDirty(): boolean {
  if (typeof window === 'undefined') return false;
  try { return window.localStorage.getItem(DIRTY_KEY) === '1'; } catch { return false; }
}

export function markDirty() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(DIRTY_KEY, '1'); } catch { /* ignore */ }
}

export function clearDirty() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(DIRTY_KEY); } catch { /* ignore */ }
}

export interface FlushResult {
  success: boolean; // true once the queue is fully drained
}

// Replays queued requests one at a time, in the order they were queued.
// - Network failure (still offline): stop, leave the remainder queued, try later.
// - 401 (session expired): stop, leave the remainder queued — the caller
//   should prompt the user to sign in again.
// - Any other non-OK response (a real server-side rejection, e.g. a failed
//   validation): drop that one request and keep going, so one bad request
//   can't jam the whole queue forever.
export async function flushQueue(): Promise<FlushResult> {
  let queue = getQueue();
  while (queue.length > 0) {
    const req = queue[0];
    let res: Response;
    try {
      res = await fetch(req.url, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        body: req.body,
      });
    } catch {
      return { success: false };
    }
    if (res.status === 401) {
      return { success: false };
    }
    if (!res.ok) {
      console.error('[syncQueue] dropping rejected queued request', req.method, req.url, res.status);
    }
    dequeue(req.id);
    queue = getQueue();
  }
  return { success: true };
}
