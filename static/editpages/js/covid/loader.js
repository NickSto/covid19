
//TODO: Switch to Corona Data Scraper: https://coronadatascraper.com/timeseries-byLocation.json

import * as Utils from './utils.js?via=js';
import * as LoaderJHU from './loader.jhu.js?via=js';
import * as LoaderCDS from './loader.cds.js?via=js';
import * as LoaderNYT from './loader.nyt.js?via=js';
const LOADERS = [LoaderCDS, LoaderJHU, LoaderNYT];

export const DIVISIONS = ['country', 'region', 'county', 'town'];
export const DIVISION_ALIASES = {country:'country', region:'state', county:'county', town:'city'};
export const PLACES = new Utils.MultiKeyMap();
export const INDEX = new Map();
export const TRANSLATIONS = new Map();

export function makeEmptyData() {
  return {
    dates: [],
    counts: new Utils.MultiKeyMap(),
  }
}

export function loadData(finalData, callback) {
  // Load in parallel, then merge results.
  // Merge in order of least reliable data to most reliable, since every later one overrides any
  // previous entries.
  let loadStates = [];
  let datas = [];
  for (let loader of LOADERS) {
    let data = makeEmptyData();
    datas.push(data);
    loader.loadData(data, () => mergeIfDone(finalData, datas, loadStates, callback));
  }
}

function mergeIfDone(finalData, datas, loadStates, callback) {
  loadStates.push('loaded');
  if (isDoneLoading(loadStates, LOADERS.length)) {
    mergeDatas(finalData, datas);
    indexPlaces(PLACES, INDEX);
    console.log(
      `Finished loading from ${LOADERS.length} sources. Got data on `+
      `${finalData.counts.keys().length} places.`
    );
    if (typeof callback === 'function') {
      callback()
    }
  }
}

function isDoneLoading(loadStates, doneLength) {
  return loadStates.length === doneLength && loadStates.every(s => s === 'loaded');
}

function mergeDatas(finalData, datas) {
  for (let data of datas) {
    if (finalData.dates.length === 0) {
      finalData.dates = data.dates;
    } else {
      compareDates(finalData.dates, data.dates);
      let latestDay = Utils.dateToDayNumber(data.dates[data.dates.length-1]);
      Utils.extendDatesArray(finalData.dates, latestDay);
    }
    finalData.counts.update(data.counts);
  }
}

function compareDates(dates1, dates2) {
  for (let i = 0; i < dates1.length && i < dates2.length; i++) {
    if (dates1[i].getTime() !== dates2[i].getTime()) {
      throw `Dates not the same in different sources (${dates1[i]} != ${dates2[i]}).`;
    }
  }
}

function indexPlaces(places, index) {
  for (let place of places.keys()) {
    let [name, division] = getMostSpecificKey(place);
    let divisionAlias = DIVISION_ALIASES[division];
    // Store place by its primary key: the lowercase version of the name of its most specific division.
    // But if there's already something stored by that key, and it's a more specific division, let
    // that stay.
    if (!hasMoreSpecificValue(index, name, division)) {
      index.set(name, place);
    }
    // Also use keys where you append the division explicitly, like 'New York (state)'.
    index.set(`${name} (${division})`, place);
    if (division !== divisionAlias) {
      index.set(`${name} (${divisionAlias})`, place);
    }
  }
}

function getMostSpecificKey(place) {
  for (let i = place.length-1; i >= 0; i--) {
    if (place[i] !== null) {
      return [place[i], DIVISIONS[i]];
    }
  }
  return [null, null];
}

function hasMoreSpecificValue(index, name, division) {
  if (index.has(name)) {
    let existingPlace = index.get(name);
    let [existingName, existingDivision] = getMostSpecificKey(existingPlace);
    let divisionI = DIVISIONS.indexOf(division);
    let existingI = DIVISIONS.indexOf(existingDivision);
    if (existingI > divisionI) {
      return true;
    }
  }
  return false;
}

export function initPlaces(event, callback) {
  // Load constants from external file.
  let xhr = event.target;
  if (xhr.status == 200) {
    if (!xhr.response) {
      throw (
        `Request for ${xhr.responseUrl} failed: Received HTTP ${xhr.status}, but xhr.response is `+
        `${xhr.response}`
      );
    }
    placesToMKM(xhr.response, PLACES);
    parsePlaces(PLACES, TRANSLATIONS);
    if (typeof callback === 'function') {
      callback();
    }
  } else {
    console.error(`Request for ${xhr.responseUrl} failed: ${xhr.status}: ${xhr.statusText}`);
  }
}

function placesToMKM(placesObj, placesMKM) {
  for (let [country, countryData] of Object.entries(placesObj)) {
    if (country === 'world') {
      country = null;
    }
    let place = [country,null,null,null];
    let countryMap = new Map();
    for (let [key, value] of Object.entries(countryData)) {
      if (key !== 'regions') {
        countryMap.set(key, value);
      }
    }
    // Some keys are optional, to keep the JSON human-readable.
    // But make them all mandatory in the data structure.
    for (let [key, value] of [['iso3166',null],['aliases',[]]]) {
      if (!countryMap.has(key)) {
        countryMap.set(key,value);
      }
    }
    placesMKM.set(place, countryMap);
    if (countryData.hasOwnProperty('regions')) {
      for (let [region, regionData] of Object.entries(countryData.regions)) {
        let place = [country,region,null,null];
        let regionMap = new Map();
        for (let [key, value] of Object.entries(regionData)) {
          regionMap.set(key, value);
        }
        // Set values for mandatory keys.
        for (let [key, value] of [['aliases',[]],['code',null]]) {
          if (!regionMap.has(key)) {
            regionMap.set(key,value);
          }
        }
        placesMKM.set(place, regionMap);
      }
    }
  }
}

function parsePlaces(places, translations) {
  let worldData = places.get([null,null,null,null]);
  let countryCodes = new Map();
  for (let country of places.keys([], 'single')) {
    let countryData = places.get([country,null,null,null]);
    // Compile lookup table for ISO-3166 codes.
    if (countryData.get('iso3166')) {
      countryCodes.set(countryData.get('iso3166'), country);
    }
    // Compile translation table for alternate country names.
    for (let alias of countryData.get('aliases')) {
      translations.set(alias, country);
    }
    let regionCodes = new Map();
    countryData.set('codes', regionCodes);
    for (let region of places.keys([country], 'single')) {
      if (region === null) {
        continue;
      }
      let regionData = places.get([country,region,null,null]);
      // Compile lookup table for postal codes.
      if (regionData.get('code')) {
        regionCodes.set(regionData.get('code'), region);
      }
      // Add region aliases.
      for (let alias of regionData.get('aliases')) {
        translations.set(alias, region);
      }
    }
  }
  worldData.set('codes', countryCodes);
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
