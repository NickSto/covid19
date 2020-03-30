
import * as Loader from './loader.js';
import * as UI from './ui.js';
import * as Utils from './utils.js';

const DATA_URL = 'https://raw.githubusercontent.com/nytimes/covid-19-data/master/us-states.csv';

export function loadData(data, callback) {
  Loader.makeRequest(
    DATA_URL,
    event => receiveData(event.target, data, callback)
  );
}

function receiveData(xhr, data, callback) {
  console.log(`Received response from ${xhr.responseURL}`);
  if (xhr.status == 200) {
    try {
      let rawTable = Plotly.d3.csv.parseRows(xhr.responseText);
      parseRawData(rawTable, data);
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

function parseRawData(rawTable, data) {
  let latestDay = 0;
  let rowNum = 0;
  for (let row of rawTable) {
    rowNum++;
    if (rowNum === 1) {
      checkHeader(row);
    } else {
      // Parse the columns.
      let date = Utils.parseDate(row[0]);
      let state = row[1].toLowerCase();
      let cases = parseInt(row[3]);
      let deaths = parseInt(row[4]);
      // Transform the raw data into what we need.
      let day = Utils.dateToDayNumber(date);
      let place = ['us',state,null,null];
      let counts = data.counts.get(place);
      if (counts === undefined) {
        counts = new Map();
        data.counts.set(place, counts);
      }
      for (let [stat, value] of [['cases',cases],['deaths',deaths]]) {
        if (! counts.has(stat)) {
          counts.set(stat, []);
        }
        let countsArray = counts.get(stat);
        countsArray[day] = value;
      }
      latestDay = Math.max(day,latestDay);
    }
  }
  Utils.extendDatesArray(data.dates, latestDay);
  return data;
}

function checkHeader(header) {
  if (
    header[0] !== 'date' ||
    header[1] !== 'state' ||
    header[2] !== 'fips' ||
    header[3] !== 'cases' ||
    header[4] !== 'deaths'
  ) {
    throw `Invalid raw data: Unexpected first line format: ${row}`;
  }
}
