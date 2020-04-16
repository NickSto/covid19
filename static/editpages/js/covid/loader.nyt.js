
import * as Loader from './loader.js?via=js';
import * as UI from './ui.js?via=js';
import * as Utils from './utils.js?via=js';

const DATA_URL_BASE = 'https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-';
const DATA_URL_SUFFIX = '.csv';
//TODO: Enable counties and make merging function merge individual counts arrays.
//      NYT is missing county data for many dates that CDS has it, but NYT might be more reliable
//      for dates it does have data.
const TABLES = ['states']; // , 'counties'];
const STATS = {cases:3, deaths:4};

export function loadData(data, callback) {
  let loadStates = [];
  for (let tableName of TABLES) {
    Loader.makeRequest(
      DATA_URL_BASE+tableName+DATA_URL_SUFFIX,
      event => receiveData(event.target, data, loadStates, callback)
    );
  }
}

function receiveData(xhr, data, loadStates, callback) {
  console.log(`Received response from ${xhr.responseURL}`);
  if (xhr.status == 200) {
    try {
      let rawTable = Plotly.d3.csv.parseRows(xhr.responseText);
      parseRawData(rawTable, data);
      loadStates.push('loaded');
    } catch(error) {
      UI.setError('Problem loading raw data.');
      loadStates.push('failed');
      throw error;
    }
  } else {
    UI.setError('Problem fetching raw data.');
    loadStates.push('failed');
    throw `Request failed: ${xhr.status}: ${xhr.statusText}`;
  }
  if (typeof callback === 'function' && isDoneLoading(loadStates)) {
    callback();
  }
}

function isDoneLoading(loadStates) {
  return loadStates.length === TABLES.length && loadStates.every(s => s === 'loaded');
}

function parseRawData(rawTable, data) {
  let totals = new Map();
  for (let stat of Object.keys(STATS)) {
    totals.set(stat, []);
  }
  let latestDay = 0;
  let tableType = null;
  let offset = 0;
  for (let row of rawTable) {
    if (! tableType) {
      [tableType, offset] = getTableType(row);
    } else {
      // Parse the columns.
      let date = Utils.parseDate(row[0]);
      let state = row[1+offset].toLowerCase();
      if (Loader.TRANSLATIONS.has(state)) {
        state = Loader.TRANSLATIONS.get(state);
      }
      let county = null;
      if (tableType === 'county') {
        county = row[1].toLowerCase();
        if (Loader.TRANSLATIONS.has(county)) {
          county = Loader.TRANSLATIONS.get(county);
        }
        county += ' county';
      }
      // Collect the count values.
      let theseCounts = new Map();
      for (let [stat, column] of Object.entries(STATS)) {
        let value = parseInt(row[column+offset]);
        theseCounts.set(stat, value);
      }
      // Transform the raw data into what we need.
      let day = Utils.dateToDayNumber(date);
      let place = ['us',state,county,null];
      // Get the counts for this place.
      let counts = data.counts.get(place);
      if (counts === undefined) {
        counts = new Map();
        data.counts.set(place, counts);
      }
      for (let [stat, value] of theseCounts.entries()) {
        // Add these counts to the ones for this place.
        if (! counts.has(stat)) {
          counts.set(stat, []);
        }
        let countsArray = counts.get(stat);
        countsArray[day] = value;
        // And add to the totals.
        let statTotals = totals.get(stat);
        if (statTotals[day] === undefined) {
          statTotals[day] = 0;
        }
        statTotals[day] += value;
      }
      latestDay = Math.max(day,latestDay);
    }
  }
  data.counts.set(['us',null,null,null], totals);
  Utils.extendDatesArray(data.dates, latestDay);
  return data;
}

function getTableType(header) {
  if (Utils.arraysEqual(header, ['date','state','fips','cases','deaths'])) {
    return ['state', 0];
  } else if (Utils.arraysEqual(header, ['date','county','state','fips','cases','deaths'])) {
    return ['county', 1];
  } else {
    throw `Invalid raw data: Unexpected header format: ${header}`
  }
}
