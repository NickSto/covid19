
const DATA_URL_BASE = (
  'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/'+
  'csse_covid_19_time_series/time_series_19-covid'
);
const PLOT_LAYOUT = {
  margin: {t:0, b:0, l:0, r:0},
  yaxis: {automargin: true},
  xaxis: {automargin: true},
};
const STAT_NAMES = {'cases':'Confirmed', 'deaths':'Deaths', 'recovered':'Recovered'};
let PLACES = null;
let REGIONS = {};
let REGION_CODES = {};
let TRANSLATIONS = {};

function initCovid() {
  // Load constants from external file.
  const linkElem = document.getElementById('json-link');
  makeRequest(linkElem.href+'?via=js', initPlaces, 'json');
}

function initPlaces(event) {
  let xhr = event.target;
  if (xhr.status == 200) {
    PLACES = xhr.response;
    for (let country in PLACES) {
      // Compile translation table for alternate country names.
      let countryData = PLACES[country];
      if (countryData.hasOwnProperty('aliases')) {
        for (let alias of countryData.aliases) {
          TRANSLATIONS[alias] = country;
        }
      }
      if (countryData.hasOwnProperty('regions')) {
        let regionCodes = {};
        for (let region of Object.keys(countryData.regions)) {
          let regionData = countryData.regions[region];
          // Compile lookup table mapping regions to countries.
          REGIONS[region] = country;
          // Compile lookup table for postal codes.
          if (regionData.hasOwnProperty('code')) {
            regionCodes[regionData.code] = region;
          }
          // Add region aliases.
          if (regionData.hasOwnProperty('aliases')) {
            for (let alias of regionData.aliases) {
              TRANSLATIONS[alias] = region;
            }
          }
        }
        REGION_CODES[country] = regionCodes;
      }
    }
    loadDataAndWireUI();
  } else {
    console.error(`Request for ${xhr.responseUrl} failed: ${xhr.status}: ${xhr.statusText}`);
  }
}

function loadDataAndWireUI() {
  let data = {'dates':null, 'counts':{}};
  loadData(data);

  const addCountryElem = document.getElementById('add-country');
  addCountryElem.addEventListener('click', addCountryInput);
  addCountryInput(null, 'World');
  const plotBtnElem = document.getElementById('plot-btn');
  plotBtnElem.addEventListener('click', event => plot(event, data));
  const optionsElem = document.getElementById('options');
  optionsElem.addEventListener('click', setValidOptions);
  setValidOptions();
}

function loadData(data) {
  let loadStates = [];
  for (let stat of Object.keys(STAT_NAMES)) {
    let statName = STAT_NAMES[stat];
    makeRequest(
      `${DATA_URL_BASE}-${statName}.csv`,
      event => receiveData(event.target, data, stat, loadStates)
    );
  }
}

function receiveData(xhr, data, stat, loadStates) {
  if (xhr.status == 200) {
    let rawTableData = Plotly.d3.csv.parseRows(xhr.responseText);
    try {
      let [tableData, dates] = parseTable(rawTableData);
      addData(data, stat, tableData, dates);
      loadStates.push('loaded');
    } catch(error) {
      loadStates.push('failed');
      setError('Problem loading raw data.');
      throw error;
    }
  } else {
    loadStates.push('failed');
    setError('Problem fetching raw data.');
    throw `Request for ${stat} data failed: ${xhr.status}: ${xhr.statusText}`;
  }
  if (isDoneLoading(loadStates)) {
    plotCountries(data, ['world']);
  }
}

function isDoneLoading(loadStates) {
  return loadStates.length === 3 && loadStates.every(s => s === 'loaded');
}

function plotCountries(data, countries) {
  let plotData = [];

  let options = getOptions();

  // Check if each country is valid, and if so, get its plot data.
  // If it's invalid, alert the user.
  for (let country of countries) {
    if (data.counts.hasOwnProperty(country) || REGIONS.hasOwnProperty(country)) {
      setCountryAlert(country, true);
      try {
        let countryData = getCountryPlotData(country, data, options);
        plotData.push(countryData);
      } catch(error) {
        console.error(error);
      }
    } else if (country && country.trim() !== '') {
      console.error(`Cound not find country ${country}.`);
      setCountryAlert(country, false);
    } else {
      setCountryAlert(country, true);
    }
  }

  const plotTitleElem = document.getElementById('plot-title');
  let plotTitle = plotData.map(d => d.name).join(', ')+' '+getPlotDescription(options);

  plotTitleElem.textContent = plotTitle;

  let layout = deepishCopy(PLOT_LAYOUT);
  if (options.rates) {
    layout.yaxis.tickformat = '%';
  } else if (options.dataType === 'mortality') {
    layout.yaxis.tickformat = '.2p'
  }
  if (options.log) {
    layout.yaxis.type = 'log';
  }

  const plotContainer = document.getElementById('plot-container');
  Plotly.newPlot(plotContainer, plotData, layout);
}

function getPlotDescription(options) {
  let unit = options.dataType;
  if (options.dataType === 'cases') {
    unit = 'infections';
  } else if (options.dataType === 'mortality') {
    unit = 'mortality rate';
  }
  let prefix = '';
  let suffix = '';
  if (options.totals) {
    prefix = 'cumulative ';
  } else if (options.diffs) {
    prefix = 'new ';
    if (options.perCapita) {
      suffix = ' per day per capita';
    } else {
      suffix = ' per day';
    }
  } else if (options.rates) {
    suffix = ' change per day';
  }
  if (options.perCapita && options.totals) {
    unit = unit.replace('s','')+' rate';
  }
  return prefix+unit+suffix;
}

function getCountryPlotData(country, data, options) {
  let region = '__all__';
  let displayName;
  if (data.counts.hasOwnProperty(country)) {
    displayName = PLACES[country].displayName;
  } else if (REGIONS.hasOwnProperty(country)) {
    region = country;
    country = REGIONS[country];
    displayName = PLACES[country].regions[region].displayName;
  } else {
    throw `No country or region found for ${country}`;
  }
  // Get the raw confirmed cases counts.
  let dates = data.dates;
  let counts = getCountryCounts(data.counts[country][region], options.dataType);
  [dates, counts] = rmNulls(dates, counts);
  // Apply the requested transformations.
  let yVals = null;
  if (options.rates) {
    [dates, yVals] = countsToRates(dates, counts);
  } else if (options.diffs) {
    yVals = getCountDiffs(counts);
    dates = dates.slice(1);
  } else {
    yVals = counts;
  }
  if (options.perCapita) {
    yVals = divideByPop(yVals, country, region);
  }
  return {name:displayName, x:dates, y:yVals}
}

function getCountryCounts(allCountryCounts, dataType) {
  if (dataType === 'mortality') {
    let cases = allCountryCounts.cases;
    let deaths = allCountryCounts.deaths;
    return countsToMortality(cases, deaths);
  } else {
    return allCountryCounts[dataType];
  }
}

function rmNulls(dates, counts) {
  let newDates = [];
  let newCounts = [];
  for (let i = 0; i < dates.length; i++) {
    if (counts[i] !== null) {
      newDates.push(dates[i]);
      newCounts.push(counts[i]);
    }
  }
  return [newDates, newCounts];
}

function countsToRates(dates, counts, thres=10) {
  let rates = [];
  let newDates = [];;
  for (let i = 1; i < counts.length; i++) {
    let lastCount = counts[i-1];
    let count = counts[i];
    if (lastCount && lastCount >= thres) {
      let rate = count/lastCount - 1;
      rates.push(rate);
      newDates.push(dates[i]);
    }
  }
  return [newDates, rates];
}

function getCountDiffs(counts) {
  // This assumes there are no null counts.
  let diffs = [];
  let lastCount = null;
  for (let count of counts) {
    if (lastCount !== null) {
      diffs.push(count - lastCount);
    }
    lastCount = count;
  }
  return diffs;
}

function divideByPop(rawCounts, country, region) {
  let newCounts = [];
  let population;
  if (region === '__all__') {
    population = PLACES[country].population;
  } else {
    population = PLACES[country].regions[region].population;
  }
  if (!population) {
    throw `No population found for ${country}/${region}.`;
  }
  for (let count of rawCounts) {
    newCounts.push(count/population);
  }
  return newCounts;
}

function countsToMortality(caseCounts, deathCounts, thres=10) {
  let mortalities = [];
  for (let i = 0; i < caseCounts.length; i++) {
    let cases = caseCounts[i];
    let deaths = deathCounts[i];
    if (deaths !== null && cases !== null && cases >= thres) {
      mortalities.push(deaths/cases);
    } else {
      mortalities.push(null);
    }
  }
  return mortalities;
}

function makeRequest(url, callback, respType='') {
  let request = new XMLHttpRequest();
  request.responseType = respType;
  request.addEventListener('loadend', callback);
  request.open('GET', url);
  request.send();
}

function parseTable(rawTable) {
  let tableData = {'world':{}};
  let dates = null;
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
      let country = parseAndLowerStr(row[1]);
      let counts = row.slice(4).map(strToInt);
      if (TRANSLATIONS.hasOwnProperty(country)) {
        country = TRANSLATIONS[country];
      }
      let region = parseRegion(rawRegion, country);
      if (counts.length !== dates.length) {
        throw `Invalid raw data: counts.length (${counts.length}) != dates.length (${dates.length}).`;
      }
      if (! tableData.hasOwnProperty(country)) {
        tableData[country] = {};
      }
      if (tableData[country].hasOwnProperty(region)) {
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
          tableData[country][region][i] += counts[i];
        }
      } else {
        tableData[country][region] = counts;
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
  if (TRANSLATIONS.hasOwnProperty(rawRegion)) {
    return TRANSLATIONS[rawRegion];
  }
  let fields = rawRegion.split(', ');
  if (fields.length == 2) {
    let code = fields[1];
    if (REGION_CODES.hasOwnProperty(country) && REGION_CODES[country].hasOwnProperty(code)) {
      return REGION_CODES[country][code];
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
  for (let country of Object.keys(tableData)) {
    if (! counts.hasOwnProperty(country)) {
      counts[country] = {};
    }
    for (let region of Object.keys(tableData[country])) {
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

/* Warning: This is a very limited deep copy, basically only made for simple situations like objects
 * with only simple values or object values.
 * If a key exists in both `source` and `target`, it will replace the value in `target`.
 * This includes object values, meaning this will not do any smart things like keeping keys deep in
 * the target if they don't exist in the source.
 */
function deepishCopy(source, target=null) {
  if (target === null) {
    target = {};
  }
  for (let key of Object.keys(source)) {
    let value = source[key];
    if (typeof value === 'object') {
      target[key] = deepishCopy(value);
    } else {
      target[key] = value;
    }
  }
  return target;
}

// UI //

function plot(event, data) {
  if (typeof event !== 'undefined') {
    event.preventDefault();
  }
  let countries = getEnteredCountries();
  plotCountries(data, countries);
}

function addCountryInput(event, country=null) {
  if (typeof event !== 'undefined' && event) {
    event.preventDefault();
  }
  const countryListElem = document.getElementById('country-list');
  let countryContainerElem = document.createElement('p');
  let countryDeleteElem = document.createElement('button');
  countryDeleteElem.classList.add('country-delete','btn','btn-sm','btn-default');
  countryDeleteElem.textContent = '✕';
  countryDeleteElem.title = 'delete';
  countryDeleteElem.addEventListener('click', deleteCountryInput);
  countryContainerElem.appendChild(countryDeleteElem);
  let countryInputElem = document.createElement('input');
  countryInputElem.classList.add('country-input');
  countryInputElem.type = 'text';
  countryInputElem.placeholder = 'Italy, Germany, etc.';
  if (country) {
    countryInputElem.value = country;
  }
  countryContainerElem.appendChild(countryInputElem);
  let countryAlertElem = document.createElement('span');
  countryAlertElem.classList.add('country-alert', 'error', 'hidden');
  countryAlertElem.textContent = "Couldn't find this country in the data. Try checking the spelling.";
  countryContainerElem.appendChild(countryAlertElem);
  countryListElem.appendChild(countryContainerElem);
}

function deleteCountryInput(event) {
  if (typeof event !== 'undefined') {
    event.preventDefault();
  }
  let countryDeleteElem = event.target;
  if (!(countryDeleteElem.tagName === 'BUTTON' && countryDeleteElem.classList.contains('country-delete'))) {
    console.error(`deleteCountryInput() called on wrong element (a ${countryDeleteElem.tagName})`);
    return;
  }
  countryDeleteElem.parentElement.remove();
}

function getEnteredCountries() {
  let countries = [];
  const countryInputElems = document.getElementsByClassName('country-input');
  for (let countryInputElem of countryInputElems) {
    let country = countryInputElem.value.trim().toLowerCase();
    if (TRANSLATIONS.hasOwnProperty(country)) {
      country = TRANSLATIONS[country];
    }
    let possibleCode = country.toUpperCase();
    for (let countryName of Object.keys(REGION_CODES)) {
      let regionCodes = REGION_CODES[countryName];
      if (regionCodes.hasOwnProperty(possibleCode)) {
        country = regionCodes[possibleCode];
        break;
      }
    }
    countries.push(country);
  }
  return countries;
}

function setCountryAlert(country, valid) {
  const countryInputElems = document.getElementsByClassName('country-input');
  for (let countryInputElem of countryInputElems) {
    let thisCountry = countryInputElem.value.toLowerCase();
    if (TRANSLATIONS.hasOwnProperty(thisCountry)) {
      thisCountry = TRANSLATIONS[thisCountry];
    }
    if (thisCountry === country) {
      let countryAlertElem = countryInputElem.parentElement.querySelector('.country-alert');
      if (valid) {
        countryAlertElem.classList.add('hidden');
      } else {
        countryAlertElem.classList.remove('hidden');
      }
      return;
    }
  }
}

function getOptions() {
  let options = {};
  const optionElems = document.getElementsByClassName('option');
  for (let optionElem of optionElems) {
    if (optionElem.name == 'data-types') {
      if (optionElem.checked) {
        options.dataType = optionElem.value;
      }
    } else {
      options[optionElem.value] = optionElem.checked;
    }
  }
  return options;
}

function setValidOptions() {
  // Can't use per capita option with mortality rate or rate of increase.
  let disablePerCapita = false;
  for (let value of ['mortality', 'rates']) {
    optionElem = document.querySelector(`.option[value="${value}"]`);
    if (optionElem !== null && optionElem.checked) {
      disablePerCapita = true;
    }
  }
  const perCapitaElem = document.querySelector('.option[value="perCapita"]');
  if (disablePerCapita) {
    perCapitaElem.disabled = true;
    perCapitaElem.checked = false;
  } else {
    perCapitaElem.disabled = false;
  }
}

function setError(message) {
  const stderrElem = document.getElementById('stderr');
  stderrElem.classList.remove('hidden');
  stderrElem.textContent = message;
}

function clearError() {
  const stderrElem = document.getElementById('stderr');
  stderrElem.classList.add('hidden');
  stderrElem.textContent = '';
}

// init //

window.addEventListener('load', initCovid, false);
