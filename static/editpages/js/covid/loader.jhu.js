
import * as Loader from './loader.js';
import * as UI from './ui.js';

const DATA_URL_BASE = (
  'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/archived_data/'+
  'archived_time_series/time_series_19-covid'
);
const STAT_NAMES = {'cases':'Confirmed', 'deaths':'Deaths', 'recovered':'Recovered'};

export function loadData(data, callback) {
  let loadStates = [];
  for (let stat in STAT_NAMES) {
    let statName = STAT_NAMES[stat];
    Loader.makeRequest(
      `${DATA_URL_BASE}-${statName}_archived_0325.csv`,
      event => receiveData(event.target, data, stat, loadStates, callback)
    );
  }
}

function receiveData(xhr, data, stat, loadStates, callback) {
  console.log(`Received response from ${xhr.responseURL}`);
  if (xhr.status == 200) {
    let rawTableData = Plotly.d3.csv.parseRows(xhr.responseText);
    try {
      let [tableData, dates] = parseTable(rawTableData);
      addData(data, stat, tableData, dates);
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

function parseTable(rawTable) {
  let tableData = {'world':{}};
  let dates;
  let seenWholeCountries = new Set();
  let rowNum = 0;
  for (let row of rawTable) {
    rowNum++;
    if (rowNum === 1) {
      // Store the dates given in the header.
      if (
        row[0].trim() === 'Province/State' &&
        row[1].trim() === 'Country/Region' &&
        row[2].trim() === 'Lat' &&
        row[3].trim() === 'Long' &&
        row[4].trim() === '1/22/20'
      ) {
        dates = row.slice(4).map(e => parseDate(e));
      } else {
        throw `Invalid raw data: Unexpected first line format: ${row.slice(0,7)}..`;
      }
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
      if (counts.length !== dates.length) {
        throw `Invalid raw data: counts.length (${counts.length}) != dates.length (${dates.length}).`;
      }
      // Sometimes they have duplicate entries for whole countries. Skip them.
      if (region === '__all__') {
        if (seenWholeCountries.has(country)) {
          console.error(`Duplicate entry seen for ${country}`);
          continue;
        }
        seenWholeCountries.add(country);
      }
      let countryCounts = getOrMakeCountryCounts(tableData, country);
      if (countryCounts.hasOwnProperty(region)) {
        // Are there already counts for this region?
        if (region === '__all__') {
          // If this is a country-wide row, there shouldn't already be a country-wide entry in the
          // data. That'd mean that earlier we saw a row for a region in this country, and now
          // we're seeing a country-wide row. That shouldn't occur.
          throw `Saw a country-wide row for ${country}, but we already saw an entry it.`;
        }
        // If there are already counts for this region, add the new ones to them.
        // This can happen for county-level data before they stopped including them on March 10.
        for (let i = 0; i < counts.length; i++) {
          countryCounts[region][i] += counts[i];
        }
      } else {
        countryCounts[region] = counts;
      }
      // Add to area totals: world and country.
      addToTotals(tableData, country, counts);
    }
  }
  return [tableData, dates];
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
    return '__all__';
  }
  if (Loader.TRANSLATIONS.has(rawRegion)) {
    return Loader.TRANSLATIONS.get(rawRegion);
  }
  let fields = rawRegion.split(', ');
  if (fields.length === 2) {
    let code = fields[1].replace(/\./g,'').toUpperCase();
    if (Loader.REGION_CODES.get(country).has(code)) {
      return Loader.REGION_CODES.get(country).get(code);
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

function getOrMakeCountryCounts(tableData, country) {
  let countryCounts;
  if (tableData.hasOwnProperty(country)) {
    countryCounts = tableData[country];
  } else {
    countryCounts = {};
    tableData[country] = countryCounts;
  }
  return countryCounts;
}

function addToTotals(tableData, country, counts) {
  for (let area of [tableData['world'], tableData[country]]) {
    if (area.hasOwnProperty('__all__')) {
      let totals = area['__all__'];
      if (counts.length !== totals.length) {
        throw `Invalid raw data: Different count lengths (${counts.length} != ${totals.length}).`;
      }
      for (let i = 0; i < counts.length; i++) {
        totals[i] += counts[i];
      }
    } else {
      area['__all__'] = counts.slice();
    }
  }
}

function addData(data, stat, tableData, dates) {
  if (data['dates'] === null) {
    data['dates'] = dates;
  } else {
    compareDates(dates, data['dates']);
  }
  let counts = data['counts'];
  for (let country in tableData) {
    if (! counts.hasOwnProperty(country)) {
      counts[country] = {};
    }
    for (let region in tableData[country]) {
      if (! counts[country].hasOwnProperty(region)) {
        counts[country][region] = {};
      }
      counts[country][region][stat] = tableData[country][region];
    }
  }
}

function compareDates(dates1, dates2) {
  if (dates1.length !== dates2.length) {
    throw `Number of dates does not agree between tables (${dates1.length} != ${dates2.length}`;
  }
  for (let i = 0; i < dates1.length; i++) {
    if (dates1[i].getTime() !== dates2[i].getTime()) {
      throw `Dates not the same in different tables (${dates1[i]} != ${dates2[i]}).`;
    }
  }
}
