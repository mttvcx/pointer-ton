'use client';

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

const DB_NAME = 'pointer-pnl-share-media';
const DB_VERSION = 1;

type PointerShareMediaDb = DBSchema & {
  blobs: {
    key: string;
    value: ArrayBuffer;
  };
};

let dbPromise: Promise<IDBPDatabase<PointerShareMediaDb>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<PointerShareMediaDb>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs');
        }
      },
    });
  }
  return dbPromise;
}

export async function idbPutBlob(key: string, buf: ArrayBuffer): Promise<void> {
  const db = await getDb();
  await db.put('blobs', buf, key);
}

export async function idbGetBlob(key: string): Promise<ArrayBuffer | undefined> {
  const db = await getDb();
  return db.get('blobs', key);
}

export async function idbDeleteBlob(key: string): Promise<void> {
  const db = await getDb();
  await db.delete('blobs', key);
}
