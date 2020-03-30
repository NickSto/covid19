
import * as Loader from './loader.js';
import * as UI from './ui.js';
import * as Utils from './utils.js';

const DATA_URL = 'https://coronadatascraper.com/timeseries-byLocation.json';
const DIVISION_KEYS = {country:'country', region:'state', county:'county', town:'city'};
let COUNTRY_CODES = null;

export function loadData(data, callback) {
  Loader.makeRequest(
    DATA_URL,
    event => receiveData(event.target, data, callback),
    'json'
  );
}

function receiveData(xhr, data, callback) {
  console.log(`Received response from ${xhr.responseURL}`);
  if (xhr.status == 200) {
    try {
      parseRawData(xhr.response, data);
    } catch(error) {
      UI.setError('Problem loading raw data.');
      throw error;
    }
  } else {
    UI.setError('Problem fetching raw data.');
    throw `Request failed: ${xhr.status}: ${xhr.statusText}`;
  }
  if (typeof callback === 'function') {
    callback();
  }
}

function parseRawData(rawData, data) {
  for (let [name, rawPlaceData] of Object.entries(rawData)) {
    let place = getPlaceKeys(rawPlaceData);
    let counts = parseCounts(rawPlaceData.dates);
    data.counts.set(place, counts);
    storePlaceData(place, rawPlaceData);
    let latestDay = getLatestDay(counts);
    Utils.extendDatesArray(data.dates, latestDay);
  }
}

function getPlaceKeys(rawPlaceData) {
  if (COUNTRY_CODES === null) {
    COUNTRY_CODES = Loader.PLACES.get([null,null,null,null]).get('codes');
  }
  let place = [];
  let country = null;
  for (let division of Loader.DIVISIONS) {
    let divisionKey = DIVISION_KEYS[division];
    let value = null;
    if (rawPlaceData.hasOwnProperty(divisionKey)) {
      let rawValue = rawPlaceData[divisionKey];
      if (rawValue.toLowerCase() !== '(unassigned)') {
        value = rawValue.toLowerCase();
      }
      if (division === 'country') {
        if (COUNTRY_CODES.has(rawValue)) {
          value = COUNTRY_CODES.get(rawValue);
        }
        country = value;
      } else if (division === 'region') {
        if (Utils.getRegionFromCode(country, rawValue)) {
          value = Utils.getRegionFromCode(country, rawValue);
        }
      }
    }
    place.push(value);
  }
  return place;
}

function storePlaceData(place, rawPlaceData) {
  let placeData = Loader.PLACES.get(place);
  if (!placeData) {
    placeData = new Map();
    Loader.PLACES.set(place, placeData);
  }
  if (!placeData.has('population')) {
    let population = rawPlaceData.population;
    if (!population) {
      population = null;
    }
    placeData.set('population', population);
  }
  placeData.set(place, placeData);
  if (!placeData.has('displayName')) {
    let displayName = getDisplayName(place, rawPlaceData);
    placeData.set('displayName', displayName);
  }
}

function getDisplayName(place, placeData) {
  let displayName = null;
  for (let i = 0; i < place.length; i++) {
    let placeKey = place[i];
    if (placeKey !== null) {
      let divisionKey = DIVISION_KEYS[Loader.DIVISIONS[i]];
      displayName = placeData[divisionKey];
    }
  }
  return displayName;
}

function parseCounts(dates) {
  let counts = new Map();
  for (let [dateStr, rawCounts] of Object.entries(dates)) {
    let day = Utils.dateToDayNumber(Utils.parseDate(dateStr));
    for (let [stat, count] of Object.entries(rawCounts)) {
      let statCounts;
      if (counts.has(stat)) {
        statCounts = counts.get(stat);
      } else {
        statCounts = [];
        counts.set(stat, statCounts);
      }
      statCounts[day] = count;
    }
  }
  return counts;
}

function getLatestDay(counts) {
  let latestDay = 0;
  for (let [stat, statCounts] of counts.entries()) {
    let statLatestDay = statCounts.length-1;
    if (statLatestDay > latestDay) {
      latestDay = statLatestDay;
    }
  }
  return latestDay;
}
