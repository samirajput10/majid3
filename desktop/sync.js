/**
 * Sync engine: local MongoDB ↔ MongoDB Atlas.
 *
 * Rules (designed so no path can wipe real data):
 *  - PULL (seed): only when the local DB is completely empty and Atlas has
 *    data — first run on a new PC pulls everything down.
 *  - PUSH (mirror): whenever the local DB has any data, it is the source of
 *    truth. All local docs are upserted to Atlas and Atlas docs that no
 *    longer exist locally are removed (so deletes sync too).
 *  - An empty local DB never pushes, so Atlas can never be wiped by a fresh
 *    install syncing before it has seeded.
 */
const { MongoClient } = require('mongodb');

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

async function countAll(db) {
  let total = 0;
  for (const name of COLLECTIONS) {
    total += await db.collection(name).countDocuments();
  }
  return total;
}

/**
 * Copies every collection from one DB to the other.
 * mirror=true  → target becomes an exact copy (extra target docs deleted);
 *                used for PUSH so deletes made on the PC reach Atlas.
 * mirror=false → pure upsert, nothing deleted; used for PULL so a record
 *                the user creates while the seed is running is never lost.
 */
async function copyAll(fromDb, toDb, { mirror, log }) {
  const copied = {};
  for (const name of COLLECTIONS) {
    const docs = await fromDb.collection(name).find().toArray();
    const target = toDb.collection(name);

    if (mirror) {
      // Delete first so unique indexes — customer phone, attendance
      // worker+date — can't collide with incoming upserts.
      const ids = docs.map(d => d._id);
      await target.deleteMany(ids.length ? { _id: { $nin: ids } } : {});
    }

    for (let i = 0; i < docs.length; i += 500) {
      const batch = docs.slice(i, i + 500);
      await target.bulkWrite(
        batch.map(doc => ({
          replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true },
        })),
        { ordered: false }
      );
    }
    copied[name] = docs.length;
  }
  log && log('  copied: ' + JSON.stringify(copied));
  return copied;
}

/**
 * Runs one sync pass. Returns { mode: 'pull'|'push'|'idle'|'offline', ... }.
 * seedOnly: only PULL-seed an empty local DB (fresh install); never push.
 * Used by the boot sync now that pushing is manual (the in-app Save button).
 */
async function runSync({ localUri, atlasUri, log = () => {}, seedOnly = false }) {
  if (!atlasUri) return { mode: 'idle', reason: 'no atlas uri configured' };

  const local = new MongoClient(localUri, { serverSelectionTimeoutMS: 5000 });
  const atlas = new MongoClient(atlasUri, { serverSelectionTimeoutMS: 10000 });

  try {
    await local.connect();
  } catch (e) {
    await local.close().catch(() => {});
    return { mode: 'error', reason: 'local db unreachable: ' + e.message };
  }

  try {
    await atlas.connect();
    await atlas.db('admin').command({ ping: 1 });
  } catch (e) {
    await local.close().catch(() => {});
    await atlas.close().catch(() => {});
    return { mode: 'offline', reason: e.message.split('\n')[0] };
  }

  try {
    const localDb = local.db(DB_NAME);
    const atlasDb = atlas.db(DB_NAME);

    const localCount = await countAll(localDb);
    // Seed marker: guards against a half-finished seed being mistaken for
    // real local data and pushed to Atlas (which would delete the un-pulled
    // docs there). While the marker says "incomplete", we keep pulling.
    const meta = localDb.collection('_syncmeta');
    const seed = await meta.findOne({ _id: 'seed' });
    const seedIncomplete = seed ? seed.complete === false : false;

    if (localCount === 0 || seedIncomplete) {
      const atlasCount = await countAll(atlasDb);
      if (atlasCount > 0) {
        log('Seeding local database from Atlas (' + atlasCount + ' docs)...');
        await meta.replaceOne({ _id: 'seed' }, { _id: 'seed', complete: false }, { upsert: true });
        const copied = await copyAll(atlasDb, localDb, { mirror: false, log });
        await meta.replaceOne({ _id: 'seed' }, { _id: 'seed', complete: true }, { upsert: true });
        return { mode: 'pull', copied };
      }
      if (localCount === 0) return { mode: 'idle', reason: 'both databases empty' };
      // Atlas is empty but local has data (seed marker was stale) — fall
      // through to push after clearing the marker.
      await meta.replaceOne({ _id: 'seed' }, { _id: 'seed', complete: true }, { upsert: true });
    }

    if (seedOnly) {
      return { mode: 'idle', reason: 'seed-only sync — push is manual (Save button)' };
    }

    log('Mirroring local database to Atlas (' + localCount + ' docs)...');
    const copied = await copyAll(localDb, atlasDb, { mirror: true, log });
    return { mode: 'push', copied };
  } catch (e) {
    return { mode: 'error', reason: e.message.split('\n')[0] };
  } finally {
    await local.close().catch(() => {});
    await atlas.close().catch(() => {});
  }
}

module.exports = { runSync, DB_NAME, COLLECTIONS };
