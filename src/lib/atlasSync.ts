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
  mode: 'push' | 'idle' | 'offline' | 'error';
  reason?: string;
}

async function countAll(db: Db): Promise<number> {
  let total = 0;
  for (const name of COLLECTIONS) {
    total += await db.collection(name).countDocuments();
  }
  return total;
}

export async function runAtlasPush(): Promise<AtlasSyncResult> {
  const localUri = process.env.MONGODB_URI;
  const atlasUri = process.env.ATLAS_URI;
  if (!localUri) return { mode: 'error', reason: 'MONGODB_URI is not set' };
  if (!atlasUri || atlasUri === localUri) {
    return { mode: 'idle', reason: 'no separate cloud database configured' };
  }

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

  try {
    const localDb = local.db(DB_NAME);
    const atlasDb = atlas.db(DB_NAME);

    const localCount = await countAll(localDb);
    if (localCount === 0) return { mode: 'idle', reason: 'local database is empty' };

    const seed = await localDb.collection('_syncmeta').findOne({ _id: 'seed' } as never);
    if (seed && seed.complete === false) {
      return { mode: 'idle', reason: 'initial seed still in progress' };
    }

    for (const name of COLLECTIONS) {
      const docs = await localDb.collection(name).find().toArray();
      const target = atlasDb.collection(name);
      // Mirror semantics — delete first so Atlas docs removed locally (and
      // unique-index collisions) can't survive the upsert pass.
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
    return { mode: 'push' };
  } catch (e) {
    return { mode: 'error', reason: String(e instanceof Error ? e.message.split('\n')[0] : e) };
  } finally {
    await local.close().catch(() => {});
    await atlas.close().catch(() => {});
  }
}
