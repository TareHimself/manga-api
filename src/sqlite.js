"use strict";
const path = require("path");
const db = require("better-sqlite3")(path.join(__dirname, "./db/database.db"), {
  fileMustExist: true,
});

function pad(number) {
  return number < 10 ? `0${number}` : `${number}`;
}

/**
 * Converts a date object to an integer formated as YYYYMMDDHHMMSS
 * @param {Date} date the date object to convert
 * @returns {number}
 */
function TimeToInteger(date) {
  return parseInt(
    `${date.getUTCFullYear()}${pad(date.getUTCMonth())}${pad(
      date.getUTCDate()
    )}${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(
      date.getUTCSeconds()
    )}`,
    10
  );
}

/**
 * Fetches an item from the cache if it exists
 * @param {string} src the source the item was scraped from
 * @param {string} id the id the item was stored with
 * @param {string} type the item type
 * @param {number} ttl items that have been stored longer than this time(seconds) will be deleted
 * @returns {any | undefined}
 */
function getCachedItem(src, id, type, ttl = 60) {
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
const tCacheItem = db.transaction((src, id, type, data) => {
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

module.exports = {
  getCachedItem,
  tCacheItem,
};
