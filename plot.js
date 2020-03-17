
const DATA_URL_BASE = 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports';
const PLOT_LAYOUT = {
  margin: {t:0, b:0, l:0, r:0},
  yaxis: {automargin: true},
  xaxis: {automargin: true},
};
let TRANSLATIONS = null;
let POPULATIONS = null;

function initCovid() {
  // Load constants from external file.
  // When doing local testing (via file://), CORS will normally block this request.
  // In Firefox you can allow it by toggling `privacy.file_unique_origin`.
  makeRequest('constants.json?via=js', initConstants, 'json');
}

function initConstants(event) {
  let xhr = event.target;
  if (xhr.status == 200) {
    let constants = xhr.response;
    TRANSLATIONS = constants.translations;
    POPULATIONS = constants.populations;
    loadDataAndWireUI();
  } else {
    console.error(`Request for ${xhr.responseUrl} failed: ${xhr.status}: ${xhr.statusText}`);
  }
}

function loadDataAndWireUI() {
  let data = [];
  loadData(data);

  const addCountryElem = document.getElementById('add-country');
  addCountryElem.addEventListener('click', addCountryInput);
  addCountryInput(null, 'World');
  const plotBtnElem = document.getElementById('plot-btn');
  plotBtnElem.addEventListener('click', event => plot(event, data));
}

function loadData(data) {
  for (let dayEntry of getDates()) {
    dayEntry.status = 'loading';
    data.push(dayEntry);
  }
  for (let dayEntry of data) {
    makeRequest(
      `${DATA_URL_BASE}/${dayEntry.name}.csv`,
      event => appendData(event.target, data, dayEntry)
    );
  }
}

function appendData(xhr, data, dayEntry) {
  if (xhr.status == 200) {
    let dailyDataRaw = Plotly.d3.csv.parseRows(xhr.responseText);
    dayEntry.data = processData(dailyDataRaw);
    dayEntry.status = 'loaded';
  } else {
    console.error(`Request for ${dayEntry.name}.csv failed: ${xhr.status}: ${xhr.statusText}`);
    dayEntry.status = 'failed';
  }
  if (isDoneLoading(data)) {
    plotCountries(data, ['World']);
  }
}

function isDoneLoading(data) {
  for (let dayEntry of data) {
    if (dayEntry.status === 'loading') {
      return false;
    }
  }
  return true;
}

function plotCountries(data, countries) {
  let plotData = [];

  let options = getOptions();

  for (let country of countries) {
    let countryData = getCountryData(country, data, options);
    if (countryData) {
      plotData.push(countryData);
    }
  }

  const plotTitleElem = document.getElementById('plot-title');
  let plotTitle = plotData.map(d => d.name).join(', ')
  if (options.perCapita) {
    plotTitle += ' infection rate';
  } else if (options.rates) {
    plotTitle += ' infection change per day';
  } else {
    plotTitle += ' infections';
  }
  plotTitleElem.textContent = plotTitle;

  let layout = deepishCopy(PLOT_LAYOUT);
  if (options.rates) {
    layout.yaxis.tickformat = '%';
    layout.yaxis.range = [0,1];
  }
  if (options.log) {
    layout.yaxis.type = 'log';
  }

  const plotContainer = document.getElementById('plot-container');
  Plotly.newPlot(plotContainer, plotData, layout);
}

function getCountryData(country, data, options) {
  let [dates, counts] = getPlaceSeries(data, country.toLowerCase());
  if (counts.length <= 0) {
    if (country.trim() === '') {
      setCountryAlert(country, true);
    } else {
      setCountryAlert(country, false);
    }
    console.error(`counts.length === ${counts.length} for ${country}`);
    return null;
  } else {
    setCountryAlert(country, true);
  }
  let yVals = null;
  if (options.perCapita) {
    yVals = divideByPop(counts, country.toLowerCase());
    if (!yVals) {
      return null;
    }
  } else if (options.rates) {
    [dates, yVals] = countsToRates(dates, counts);
  } else {
    yVals = counts;
  }
  return {name:country, x:dates, y:yVals}
}

function getPlaceSeries(data, country) {
  let dates = [];
  let counts = [];
  for (let dayEntry of data) {
    if (dayEntry.status !== 'loaded') {
      continue
    }
    let total = null;
    for (let row of dayEntry.data) {
      if ((country === 'world' || row.country === country) && row.confirmed !== null) {
        if (total === null) {
          total = 0;
        }
        total += row.confirmed;
      }
    }
    if (total !== null) {
      dates.push(dayEntry.date);
      counts.push(total);
    }
  }
  return [dates, counts];
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
  return [dates, rates];
}

function divideByPop(rawCounts, country) {
  let newCounts = [];
  let population = POPULATIONS[country];
  if (!population) {
    console.error(`No population found for ${country}.`);
    return null;
  }
  for (let count of rawCounts) {
    newCounts.push(count/population);
  }
  return newCounts;
}

function getCountryList(data) {
  let countries = {};
  for (let dayEntry of data) {
    if (dayEntry.status !== 'loaded') {
      continue;
    }
    for (let row of dayEntry.data) {
      if (row.country) {
        if (!countries[row.country]) {
          countries[row.country] = 1;
        }
      }
    }
  }
  return Object.keys(countries);
}

function makeRequest(url, callback, respType='') {
  let request = new XMLHttpRequest();
  request.responseType = respType;
  request.addEventListener('loadend', callback);
  request.open('GET', url);
  request.send();
}

function processData(rawTable) {
  let table = [];
  let rowNum = 0;
  for (let row of rawTable) {
    rowNum++;
    let region = parseStr(row[0]);
    let country = parseStr(row[1]);
    let confirmed = strToInt(row[3]);
    let deaths = strToInt(row[4]);
    let recovered = strToInt(row[5]);
    if (TRANSLATIONS[country]) {
      country = TRANSLATIONS[country];
    }
    if (isNaN(confirmed)) {
      if (rowNum !== 1) {
        console.error(`Invalid 'Confirmed' number on row ${rowNum}: ${confirmed} (updated ${row[2]})`);
      }
      continue;
    }
    table.push({
      region: region, country: country, confirmed: confirmed, deaths: deaths, recovered: recovered
    })
  }
  return table;
}

function parseStr(rawStr) {
  if (rawStr === '') {
    return null;
  } else {
    return rawStr.toLowerCase();
  }
}

function strToInt(intStr) {
  if (intStr === '') {
    return null;
  } else {
    return parseInt(intStr);
  }
}

function getDates() {
  let dates = [];
  const StartYear = 2020;
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth()+1;
  const thisDay = now.getDate();
  let done = false;
  for (let year = StartYear; year <= thisYear; year++) {
    for (let month = 1; month <= 12; month++) {
      for (let day = 1; day <= 31; day++) {
        if (year == StartYear && month == 1 && day < 22) {
          continue;
        }
        let dayStr = day.toString().padStart(2, '0');
        let monthStr = month.toString().padStart(2, '0');
        let dateStr = `${monthStr}-${dayStr}-${year}`;
        let dateObj = new Date(year, month-1, day);
        dates.push({name:dateStr, date:dateObj});
        if (year == thisYear && month == thisMonth && day == thisDay) {
          done = true;
          break;
        }
      }
      if (done) {
        break;
      }
    }
    if (done) {
      break;
    }
  }
  return dates;
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
  countryAlertElem.classList.add('country-alert');
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
    let country = countryInputElem.value;
    if (TRANSLATIONS[country]) {
      country = TRANSLATIONS[country];
    }
    countries.push(country);
  }
  return countries;
}

function getOptions() {
  let options = {};
  const optionElems = document.getElementsByClassName('option');
  for (let optionElem of optionElems) {
    options[optionElem.value] = optionElem.checked;
  }
  return options;
}

function setCountryAlert(country, valid) {
  const countryInputElems = document.getElementsByClassName('country-input');
  for (let countryInputElem of countryInputElems) {
    let thisCountry = countryInputElem.value;
    if (thisCountry === country) {
      let countryAlertElem = countryInputElem.parentElement.querySelector('.country-alert');
      if (valid) {
        countryAlertElem.style.display = 'none';
      } else {
        countryAlertElem.style.display = 'initial';
      }
      return;
    }
  }
}

// init //

window.addEventListener('load', initCovid, false);
