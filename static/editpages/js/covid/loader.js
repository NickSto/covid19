
//TODO: Switch to Corona Data Scraper: https://coronadatascraper.com/timeseries-byLocation.json

import * as LoaderJHU from './loader.jhu.js';
import * as LoaderCDS from './loader.cds.js';

export const DIVISIONS = ['country', 'state', 'county', 'city'];
export const PLACES = new Map();
export const COUNTRY_CODES = new Map();
export const REGION_CODES = new Map();
export const TRANSLATIONS = new Map();

export function makeEmptyData() {
  return {
    dates: [],
    counts: new MultiKeyMap(),
    places: new MultiKeyMap(),
  }
}

export class MultiKeyMap {
  constructor() {
    this._data = new Map();
  }
  get(keys) {
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
}

export const loadData = LoaderCDS.loadData;

export function initPlaces(event, callback) {
  // Load constants from external file.
  let xhr = event.target;
  if (xhr.status == 200) {
    placesToMap(xhr.response, PLACES);
    parsePlaces(PLACES, COUNTRY_CODES, REGION_CODES, TRANSLATIONS);
    if (typeof callback === 'function') {
      callback();
    }
  } else {
    console.error(`Request for ${xhr.responseUrl} failed: ${xhr.status}: ${xhr.statusText}`);
  }
}

function placesToMap(placesObj, placesMap) {
  objToMapShallow(placesObj, placesMap);
  for (let [country, countryData] of placesMap.entries()) {
    // Some keys are optional, to keep the JSON human-readable.
    // But make them all mandatory in the data structure.
    if (! countryData.hasOwnProperty('iso3166')) {
      countryData.iso3166 = null;
    }
    if (! countryData.hasOwnProperty('aliases')) {
      countryData.aliases = [];
    }
    if (countryData.hasOwnProperty('regions')) {
      countryData.regions = objToMapShallow(countryData.regions);
    } else {
      countryData.regions = new Map();
    }
    for (let [region, regionData] of countryData.regions.entries()) {
      if (! regionData.hasOwnProperty('aliases')) {
        regionData.aliases = [];
      }
      if (! regionData.hasOwnProperty('code')) {
        regionData.code = null;
      }
    }
  }
}

function parsePlaces(places, countryCodes, regionCodes, translations) {
  for (let [country, countryData] of places.entries()) {
    // Compile lookup table for ISO-3166 codes.
    if (countryData.iso3166) {
      countryCodes.set(countryData.iso3166, country);
    }
    // Compile translation table for alternate country names.
    for (let alias of countryData.aliases) {
      translations.set(alias, country);
    }
    let countryRegionCodes = new Map();
    for (let [region, regionData] of countryData.regions.entries()) {
      // Compile lookup table for postal codes.
      if (regionData.code !== null) {
        countryRegionCodes.set(regionData.code, region);
      }
      // Add region aliases.
      for (let alias of regionData.aliases) {
        translations.set(alias, region);
      }
    }
    regionCodes.set(country, countryRegionCodes);
  }
}

export function makeRequest(url, callback, respType='') {
  let request = new XMLHttpRequest();
  request.responseType = respType;
  request.addEventListener('loadend', callback);
  request.open('GET', url);
  request.send();
}

function objToMapShallow(obj, map=null) {
  if (map === null) {
    map = new Map();
  }
  for (let [key, value] of Object.entries(obj)) {
    map.set(key, value);
  }
  return map;
}

// Naive deep copy of an object to a Map.
// It will only create independent copies of objects (as maps) and arrays (as arrays). All other
// values will not be copied, and instead included by reference.
function objToMap(obj, map=null) {
  if (map === null) {
    map = new Map();
  }
  for (let [key, rawValue] of Object.entries(obj)) {
    let value;
    if (Array.isArray(rawValue)) {
      value = [];
      for (let element of rawValue) {
        value.push(objToMap(element));
      }
    } else if (typeof rawValue === 'object') {
      value = objToMap(rawValue);
    } else {
      value = rawValue;
    }
    map.set(key, value);
  }
  return map;
}
