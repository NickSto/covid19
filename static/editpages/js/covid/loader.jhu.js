
import * as Loader from './loader.js?via=js';
import * as Utils from './utils.js?via=js';
import * as UI from './ui.js?via=js';

const DATA_URL_BASE = (
  'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/'+
  'csse_covid_19_time_series/time_series_covid19_'
);
const DATA_URL_SUFFIX = '_global.csv';
const STAT_NAMES = {'cases':'confirmed', 'deaths':'deaths', 'recovered':'recovered'};

export function loadData(data, callback) {
  let loadStates = [];
  for (let [stat, statName] of Object.entries(STAT_NAMES)) {
    Loader.makeRequest(
      DATA_URL_BASE+statName+DATA_URL_SUFFIX,
      event => receiveData(event.target, data, stat, loadStates, callback)
    );
  }
}

function receiveData(xhr, data, stat, loadStates, callback) {
  console.log(`Received response from ${xhr.responseURL}`);
  if (xhr.status == 200) {
    let rawTable = Plotly.d3.csv.parseRows(xhr.responseText);
    try {
      parseTable(rawTable, data, stat);
      loadStates.push('loaded');
    } catch(error) {
      loadStates.push('failed');
      UI.setError('Problem loading raw data.');
      throw error;
    }
  } else {
    loadStates.push('failed');
    UI.setError('Problem fetching raw data.');
    throw `Request for ${stat} data failed: ${xhr.status}: ${xhr.statusText}`;
  }
  if (typeof callback === 'function' && isDoneLoading(loadStates)) {
    callback();
  }
}

function isDoneLoading(loadStates) {
  return loadStates.length === 3 && loadStates.every(s => s === 'loaded');
}

function parseTable(rawTable, data, stat) {
  let seenWholeCountries = new Set();
  let rowNum = 0;
  for (let row of rawTable) {
    rowNum++;
    if (rowNum === 1) {
      // Parse the dates from the header.
      checkHeader(row);
      let lastDateStr = row[row.length-1];
      let lastDay = Utils.dateToDayNumber(parseDate(lastDateStr));
      Utils.extendDatesArray(data.dates, lastDay);
    } else {
      // Parse a data row, store the counts.
      let rawRegion = parseAndLowerStr(row[0]);
      let rawCountry = parseAndLowerStr(row[1]);
      let counts = row.slice(4).map(strToInt);
      let country;
      if (Loader.TRANSLATIONS.has(rawCountry)) {
        country = Loader.TRANSLATIONS.get(rawCountry);
      } else {
        country = rawCountry;
      }
      let region = parseRegion(rawRegion, country);
      if (counts.length !== data.dates.length) {
        throw (
          `Invalid raw data: counts.length (${counts.length}) != dates.length `+
          `(${data.dates.length}).`
        );
      }
      // Sometimes they have duplicate entries for whole countries. Skip them.
      if (region === null) {
        if (seenWholeCountries.has(country)) {
          console.error(`Duplicate entry seen for ${country}`);
          continue;
        }
        seenWholeCountries.add(country);
      }
      // Store the counts.
      let place = [country,region,null,null];
      let placeCounts = data.counts.get(place);
      if (! placeCounts) {
        placeCounts = new Map();
        data.counts.set(place, placeCounts);
      }
      placeCounts.set(stat, counts);
      // If this is a specific region, add its counts to the country totals.
      /*TODO: In case there's region entries and *also* a country-wide entry (who knows what they
       *      might do), make the country-wide entry supersede the sums derived from the region
       *      entries. This is technicallly already the case for countries like France and The
       *      Netherlands, but only their overseas territories are listed as separate regions.
       *      In these cases the numbers aren't significant.
       */
      if (region !== null) {
        let countryPlace = [country,null,null,null]
        let countryCounts = data.counts.get(countryPlace);
        if (! countryCounts) {
          countryCounts = new Map();
          data.counts.set(countryPlace, countryCounts);
        }
        let statCounts = countryCounts.get(stat);
        if (statCounts) {
          for (let i = 0; i < counts.length; i++) {
            statCounts[i] += counts[i];
          }
        } else {
          countryCounts.set(stat, counts);
        }
      }
    }
  }
}

function checkHeader(header) {
  if (
    header[0].trim() !== 'Province/State' ||
    header[1].trim() !== 'Country/Region' ||
    header[2].trim() !== 'Lat' ||
    header[3].trim() !== 'Long' ||
    header[4].trim() !== '1/22/20'
  ) {
    throw `Invalid raw data: Unexpected first line format: ${header.slice(0,7)}..`;
  }
  let lastDay = null;
  for (let dateStr of header.slice(4)) {
    let date = parseDate(dateStr);
    let day = Utils.dateToDayNumber(date);
    if (lastDay !== null) {
      if (day-lastDay !== 1) {
        throw `Invalid raw data: Date ${dateStr} is ${day-lastDay} day(s) after previous date, not 1.`;
      }
    }
    lastDay = day;
  }
}

function parseDate(dateStr) {
  let fields = dateStr.split('/');
  if (fields.length !== 3) {
    throw `Invalid Date string ${dateStr}: Wrong number of fields.`;
  }
  let month = parseInt(fields[0]);
  let day = parseInt(fields[1]);
  let year = 2000+parseInt(fields[2]);
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

function parseRegion(rawRegion, country) {
  if (rawRegion === null) {
    return rawRegion;
  }
  if (Loader.TRANSLATIONS.has(rawRegion)) {
    return Loader.TRANSLATIONS.get(rawRegion);
  }
  let fields = rawRegion.split(', ');
  if (fields.length === 2) {
    let code = fields[1].replace(/\./g,'').toUpperCase();
    let regionCodes = Loader.PLACES.get([country,null,null,null]).get('codes');
    if (regionCodes.has(code)) {
      return regionCodes.get(code);
    }
  }
  return rawRegion;
}

function parseAndLowerStr(rawStr) {
  let trimmedStr = rawStr.trim();
  if (trimmedStr === '') {
    return null;
  } else {
    return trimmedStr.toLowerCase();
  }
}

function strToInt(intStr) {
  if (intStr.trim() === '') {
    return null;
  } else {
    return parseInt(intStr);
  }
}
