// ─── Manual cloud push: local MongoDB → Atlas ───────────────────────────────
// Server-side twin of desktop/sync.js's PUSH path, used by POST /api/sync so
// the TopBar "Save" button can push the desktop app's local database to the
// cloud on demand. Same safety rules as the desktop sync loop:
//  - never push an empty local DB (a fresh install can't wipe Atlas)
//  - never push while a seed-pull is half-finished (_syncmeta guard)
// On the web deployment ATLAS_URI is unset (MONGODB_URI *is* the cloud), so
// this reports 'idle' and the button simply flips to Saved.
import { MongoClient, Db } from 'mongodb';

const DB_NAME = 'steelvault';
const COLLECTIONS = [
  'companies',
  'customers',
  'stockitems',
  'scraps',
  'ledgerentries',
  'expenses',
  'invoices',
  'workers',
  'workerbs',
  'attendances',
];

export interface AtlasSyncResult {
  mode: 'push' | 'pull' | 'idle' | 'offline' | 'error';
  reason?: string;
}

async function countAll(db: Db): Promise<number> {
  let total = 0;
  for (const name of COLLECTIONS) {
    total += await db.collection(name).countDocuments();
  }
  return total;
}

// Connects both ends; returns clients, or an error/offline result to bubble up.
async function connectBoth(localUri: string, atlasUri: string): Promise<
  { local: MongoClient; atlas: MongoClient } | AtlasSyncResult
> {
  const local = new MongoClient(localUri, { serverSelectionTimeoutMS: 5000 });
  const atlas = new MongoClient(atlasUri, { serverSelectionTimeoutMS: 10000 });

  try {
    await local.connect();
  } catch (e) {
    await local.close().catch(() => {});
    return { mode: 'error', reason: 'local db unreachable: ' + String(e instanceof Error ? e.message : e) };
  }

  try {
    await atlas.connect();
    await atlas.db('admin').command({ ping: 1 });
  } catch (e) {
    await local.close().catch(() => {});
    await atlas.close().catch(() => {});
    return { mode: 'offline', reason: String(e instanceof Error ? e.message.split('\n')[0] : e) };
  }

  return { local, atlas };
}

// Mirror-copies every collection from one DB to the other: docs missing from
// the source are deleted from the target, everything else is upserted.
async function mirrorCopy(fromDb: Db, toDb: Db) {
  for (const name of COLLECTIONS) {
    const docs = await fromDb.collection(name).find().toArray();
    const target = toDb.collection(name);
    // Delete first so unique indexes can't collide with incoming upserts.
    const ids = docs.map(d => d._id);
    await target.deleteMany(ids.length ? { _id: { $nin: ids } } : {});
    for (let i = 0; i < docs.length; i += 500) {
      const batch = docs.slice(i, i + 500);
      await target.bulkWrite(
        batch.map(doc => ({
          replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
        })),
        { ordered: false }
      );
    }
  }
}

export async function runAtlasPush(): Promise<AtlasSyncResult> {
  const localUri = process.env.MONGODB_URI;
  const atlasUri = process.env.ATLAS_URI;
  if (!localUri) return { mode: 'error', reason: 'MONGODB_URI is not set' };
  if (!atlasUri || atlasUri === localUri) {
    return { mode: 'idle', reason: 'no separate cloud database configured' };
  }

  const conn = await connectBoth(localUri, atlasUri);
  if ('mode' in conn) return conn;
  const { local, atlas } = conn;

  try {
    const localDb = local.db(DB_NAME);
    const atlasDb = atlas.db(DB_NAME);

    const localCount = await countAll(localDb);
    if (localCount === 0) return { mode: 'idle', reason: 'local database is empty' };

    const seed = await localDb.collection('_syncmeta').findOne({ _id: 'seed' } as never);
    if (seed && seed.complete === false) {
      return { mode: 'idle', reason: 'initial seed still in progress' };
    }

    await mirrorCopy(localDb, atlasDb);
    return { mode: 'push' };
  } catch (e) {
    return { mode: 'error', reason: String(e instanceof Error ? e.message.split('\n')[0] : e) };
  } finally {
    await local.close().catch(() => {});
    await atlas.close().catch(() => {});
  }
}

// Refresh: mirror the cloud (Atlas) INTO the local database, so this PC sees
// the latest data entered elsewhere. Guard: an empty cloud never wipes local
// data. On the web deployment (no separate ATLAS_URI) this is 'idle' and the
// caller just refetches from its own database.
export async function runAtlasPull(): Promise<AtlasSyncResult> {
  const localUri = process.env.MONGODB_URI;
  const atlasUri = process.env.ATLAS_URI;
  if (!localUri) return { mode: 'error', reason: 'MONGODB_URI is not set' };
  if (!atlasUri || atlasUri === localUri) {
    return { mode: 'idle', reason: 'no separate cloud database configured' };
  }

  const conn = await connectBoth(localUri, atlasUri);
  if ('mode' in conn) return conn;
  const { local, atlas } = conn;

  try {
    const localDb = local.db(DB_NAME);
    const atlasDb = atlas.db(DB_NAME);

    const atlasCount = await countAll(atlasDb);
    if (atlasCount === 0) return { mode: 'idle', reason: 'cloud database is empty' };

    await mirrorCopy(atlasDb, localDb);
    // The local DB now matches the cloud — mark the seed complete so the
    // desktop boot sync never mistakes this state for a half-finished seed.
    await localDb.collection('_syncmeta').replaceOne(
      { _id: 'seed' } as never,
      { _id: 'seed', complete: true },
      { upsert: true }
    );
    return { mode: 'pull' };
  } catch (e) {
    return { mode: 'error', reason: String(e instanceof Error ? e.message.split('\n')[0] : e) };
  } finally {
    await local.close().catch(() => {});
    await atlas.close().catch(() => {});
  }
}
