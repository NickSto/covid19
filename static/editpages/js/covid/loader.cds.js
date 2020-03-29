
import * as Loader from './loader.js';
import * as UI from './ui.js';

const DATA_URL = 'https://coronadatascraper.com/timeseries-byLocation.json';
const START_DATE = new Date(2020, 0, 22);
const NOW = new Date();

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
    throw `Request for ${stat} data failed: ${xhr.status}: ${xhr.statusText}`;
  }
  if (typeof callback === 'function') {
    callback();
  }
}

function parseRawData(rawData, data) {
  for (let [name, rawPlaceData] of Object.entries(rawData)) {
    let placeData = {};
    let place = getPlaceKeys(rawPlaceData);
    if (rawPlaceData.hasOwnProperty('population')) {
      placeData.population = rawPlaceData.population;
    } else {
      placeData.population = null;
    }
    placeData.displayName = getDisplayName(rawPlaceData, place);
    let counts = parseCounts(rawPlaceData.dates);
    data.counts.set(place, counts);
    data.places.set(place, placeData);
    let latestDay = getLatestDay(counts);
    while (latestDay >= data.dates.length) {
      data.dates.push(dayNumberToDate(data.dates.length));
    }
  }
}

function getPlaceKeys(rawPlaceData) {
  let place = [];
  for (let division of Loader.DIVISIONS) {
    let value = null;
    if (rawPlaceData.hasOwnProperty(division)) {
      let rawValue = rawPlaceData[division].toLowerCase();
      if (rawValue !== '(unassigned)') {
        value = rawValue;
      }
    }
    place.push(value);
  }
  return place;
}

function getDisplayName(placeData, place) {
  //TODO: Un-abbreviate countries and states using iso3166 and postal data.
  let displayNameParts = [];
  for (let i = 0; i < Loader.DIVISIONS.length; i++) {
    let division = Loader.DIVISIONS[i];
    let placeKey = place[i];
    if (placeKey !== null) {
      displayNameParts.push(placeData[division]);
    }
  }
  displayNameParts.reverse();
  return displayNameParts.join(', ');
}

function parseCounts(dates) {
  let counts = new Map();
  for (let [dateStr, rawCounts] of Object.entries(dates)) {
    let day = dateToDayNumber(parseDate(dateStr));
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

function dateToDayNumber(date) {
  let milliseconds = date - START_DATE;
  return Math.round(milliseconds/1000/60/60/24);
}

function dayNumberToDate(day) {
  let milliseconds = START_DATE.getTime() + day*24*60*60*1000;
  return new Date(milliseconds);
}

function parseDate(dateStr) {
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
