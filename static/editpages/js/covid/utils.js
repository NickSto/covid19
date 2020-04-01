
import * as Loader from './loader.js';

const START_DATE = new Date(2020, 0, 22);

export class MultiKeyMap {
  constructor() {
    this._data = new Map();
  }
  get(keys) {
    /* This returns the value for a key combination.
     * If the key combo is shorter than the full length, it will return the raw Map for that level.
     * So if the keys for this MultiKeyMap have three elements (say, [country, state, county]),
     * but you `.get([country,state])`, then what you'll receive is the Map for that state.
     * Its keys will be all the county names, so you can iterate over the keys hierarchically like:
     *  for (let country of mkm.get([])) {
     *    for (let state of mkm.get([country])) {
     *      for (let county of mkm.get([country,state])) {
     *        for (let value of mkm.get([country,state,county])) {
     *          console.log(`${county}, ${state}, ${country} has ${value}`);
     *        }
     *      }
     *    }
     *  }
     */
    let levelValue = this._data;
    for (let key of keys) {
      if (! levelValue instanceof Map) {
        throw `Too many keys in [${keys}]`;
      }
      if (levelValue.has(key)) {
        levelValue = levelValue.get(key);
      } else {
        return undefined;
      }
    }
    return levelValue;
  }
  set(keys, value) {
    let levelValue = this._data;
    let keysMinusOne = keys.slice(0,keys.length-1);
    for (let key of keysMinusOne) {
      if (! levelValue.has(key)) {
        levelValue.set(key, new Map());
      }
      levelValue = levelValue.get(key);
    }
    let key = keys[keys.length-1];
    levelValue.set(key, value);
  }
  has(keys) {
    if (this.get(keys) === undefined) {
      return false;
    } else {
      return true;
    }
  }
  update(newData, keys=[]) {
    let value = newData.get(keys);
    if (value instanceof Map) {
      let map = value;
      for (let key of map.keys()) {
        this.update(newData, [...keys, key]);
      }
    } else {
      this.set(keys, value);
    }
  }
}

const REGION_CODES_CACHE = new Map();

export function getRegionFromCode(country, regionCode) {
  let regionCodes = REGION_CODES_CACHE.get(country);
  if (! regionCodes) {
    let countryData = Loader.PLACES.get([country,null,null,null]);
    if (countryData) {
      regionCodes = countryData.get('codes');
    } else {
      regionCodes = new Map();
    }
    REGION_CODES_CACHE.set(country, regionCodes);
  }
  if (regionCodes.has(regionCode)) {
    return regionCodes.get(regionCode);
  } else {
    return null;
  }
}

export function extendDatesArray(dates, latestDay) {
  while (latestDay >= dates.length) {
    dates.push(dayNumberToDate(dates.length));
  }
}

export function dateToDayNumber(date) {
  let milliseconds = date - START_DATE;
  return Math.round(milliseconds/1000/60/60/24);
}

export function dayNumberToDate(day) {
  let milliseconds = START_DATE.getTime() + day*24*60*60*1000;
  return new Date(milliseconds);
}

export function parseDate(dateStr) {
  let fields = dateStr.split('-');
  if (fields.length !== 3) {
    throw `Invalid Date string ${dateStr}: Wrong number of fields.`;
  }
  let year = parseInt(fields[0]);
  let month = parseInt(fields[1]);
  let day = parseInt(fields[2]);
  if (year < 2020 || year > 2050) {
    throw `Invalid Date string ${dateStr}: Year out of bounds.`;
  }
  if (month < 1 || month > 11) {
    throw `Invalid Date string ${dateStr}: Month out of bounds.`;
  }
  if (day < 1 || day > 31) {
    throw `Invalid Date string ${dateStr}: Day out of bounds.`;
  }
  return new Date(year, month-1, day);
}
