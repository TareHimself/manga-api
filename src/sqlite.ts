import path from 'path'

import Database from 'better-sqlite3';
import * as fs from 'fs';
import cluster from 'cluster'
const DATABASE_DIR = path.join(process.cwd(), 'db')
const db = Database(path.join(DATABASE_DIR, 'cache.db'))
const SHOULD_NOT_CACHE = process.argv.includes('--no-cache')
if (cluster.isPrimary) {

  const initialStatements = [
    `
    CREATE TABLE IF NOT EXISTS cache(
        src TEXT DEFAULT '',
        id TEXT DEFAULT '',
        type TEXT DEFAULT '',
        data TEXT DEFAULT '',
        timestamp INTEGER DEFAULT 0,
        UNIQUE(src, id)
    );
    `,
    `
    CREATE INDEX IF NOT EXISTS idx_cache
    ON cache (src,id,type);
    `,
  ];

  // fix concurrency issues
  db.pragma("journal_mode = WAL");

  db.pragma("wal_checkpoint(RESTART)");

  const checkDbSize = async () => {
    try {
      const stats = await fs.promises.stat(path.join(DATABASE_DIR, "cache.db-wal"))
      if (stats.size / (1024 * 1024) > 50) {
        db.pragma("wal_checkpoint(RESTART)");
      }
    } catch (error: any) {
      if (error.code !== "ENOENT") throw error;
    }

  }
  setInterval(checkDbSize,
    5000
  ).unref();

  db.transaction((statements) => {
    statements.forEach((statement) => {
      db.prepare(statement).run();
    });
  }).immediate(initialStatements);
}

export function pad(number: number) {
  return number < 10 ? `0${number}` : `${number}`;
}

/**
 * Converts a date object to an integer formated as YYYYMMDDHHMMSS
 */
export function TimeToInteger(date: Date) {
  return parseInt(
    `${date.getUTCFullYear()}${pad(date.getUTCMonth())}${pad(
      date.getUTCDate()
    )}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
      date.getUTCSeconds()
    )}`,
    10
  );
}
export type cacheType = 'search' | 'manga' | 'chapter' | 'chapters'
/**
 * Fetches an item from the cache if it exists
 * @param {string} src the source the item was scraped from
 * @param {string} id the id the item was stored with
 * @param {string} type the item type
 * @param {number} ttl items that have been stored longer than this time(seconds) will be deleted
 * @returns {any | undefined}
 */
export function getCachedItem(src: string, id: string, type: cacheType, ttl: number = 60) {
  const now = new Date();

  now.setSeconds(now.getSeconds() - ttl);

  const minTime = TimeToInteger(now);

  db.prepare(
    `DELETE FROM cache WHERE src='${src}' AND type='${type}' AND timestamp < ${minTime}`
  ).run();

  const result = db
    .prepare(
      `SELECT data FROM cache WHERE src='${src}' AND id='${id}' AND type='${type}'`
    )
    .all();

  return result[0]?.data;
}

/**
 * Adds an item to the cache or updates it if it already exists
 * @param {string} src the source the item was scraped from
 * @param {string} id the id the item was stored with
 * @param {string} type the item type
 * @param {number} data the actual item to store
 */
const tCacheItem = db.transaction((src: string, id: string, type: cacheType, data: object) => {
  if (SHOULD_NOT_CACHE) return;

  db.prepare(
    `REPLACE INTO cache (src,id,type,data,timestamp) VALUES(@src,@id,@type,@data,@timestamp)`
  ).run({
    src,
    id,
    type,
    data: JSON.stringify(data),
    timestamp: TimeToInteger(new Date()),
  });
});

export {
  tCacheItem,
  db
}
