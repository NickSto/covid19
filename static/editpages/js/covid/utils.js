
import * as Loader from './loader.js?via=js';

const START_DATE = new Date(2020, 0, 22);

export class MultiKeyMap {
  constructor() {
    this._data = {map:new Map()};
  }
  get(keys, type='value') {
    let level = this._data;
    for (let key of keys) {
      let nextLevel = level.map.get(key);
      if (nextLevel) {
        level = nextLevel;
      } else {
        return undefined;
      }
    }
    if (type === 'value') {
      return level.value;
    } else if (type === 'map') {
      return level.map;
    }
  }
  set(keys, value) {
    let level = this._data;
    for (let key of keys) {
      if (! level.map.has(key)) {
        level.map.set(key, {map:new Map()});
      }
      level = level.map.get(key);
    }
    level.value = value;
  }
  has(keys) {
    if (this.get(keys) === undefined) {
      return false;
    } else {
      return true;
    }
  }
  keys(prefix=[], type='full') {
    //TODO: Convert to generator.
    let levelMap = this.get(prefix, 'map');
    if (levelMap === undefined) {
      return [];
    }
    if (type === 'full') {
      return getMkmKeys(levelMap, prefix);
    } else if (type === 'single') {
      return Array.from(levelMap.keys());
    }
  }
  *entries() {
    for (let keys of this.keys()) {
      yield [keys, this.get(keys)];
    }
  }
  *values() {
    for (let keys of this.keys()) {
      yield this.get(keys);
    }
  }
  update(newData) {
    for (let keys of newData.keys()) {
      let value = newData.get(keys);
      this.set(keys, value);
    }
  }
}

function getMkmKeys(levelMap, prefix=[]) {
  let allKeys = [];
  for (let [key, subLevel] of levelMap.entries()) {
    let thisKeys = prefix.concat([key]);
    if (subLevel.value !== undefined) {
      allKeys.push(thisKeys);
    }
    let subKeys = getMkmKeys(subLevel.map, thisKeys);
    allKeys = allKeys.concat(subKeys);
  }
  return allKeys;
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
  // Daylight savings adjustment kludge.
  if (milliseconds > 1583683200000) {
    milliseconds -= 60*60*1000;
  }
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

export function arraysEqual(arr1, arr2, cmp) {
  // Return true if the two arrays are identical, false otherwise.
  // Comparing each pair of elements is done with the function `cmp`.
  // By default, this just returns the `===` equality of the elements.
  if (! cmp) {
    cmp = (el1, el2) => el1 === el2;
  }
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (let i = 0; i < arr1.length; i++) {
    if (! cmp(arr1[i], arr2[i])) {
      return false;
    }
  }
  return true;
}
