
const DATA_URL_BASE = 'https://raw.githubusercontent.com/CSSEGISandData/COVID-19/master/csse_covid_19_data/csse_covid_19_daily_reports';

function initCovid() {
  let data = [];
  loadData(data);

  const addCountryElem = document.getElementById('add-country');
  addCountryElem.addEventListener('click', addCountryInput);
  addCountryInput();
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
    console.error(`Request for ${dayEntry.name}.csv failed: ${xhr.status}: ${xhr.statusText}`)
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

  for (let country of countries) {
    let [dates, counts] = getPlaceSeries(data, country);
    plotData.push({name:country, x:dates, y:counts});
  }

  const plotTitleElem = document.getElementById('plot-title');
  let plotTitle = countries.join(', ')+' COVID-19 infections';
  plotTitleElem.textContent = plotTitle;

  const plotContainer = document.getElementById('plot-container');
  Plotly.newPlot(plotContainer, plotData, {margin: {t:0}});
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
      if ((country === 'World' || row.country === country) && row.confirmed !== null) {
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

function makeRequest(url, callback) {
  let request = new XMLHttpRequest();
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
    if (TRANSLATIONS[region]) {
      region = TRANSLATIONS[region];
    }
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
    return rawStr;
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

// UI //

function plot(event, data) {
  if (typeof event !== 'undefined') {
    event.preventDefault();
  }
  let countries = getEnteredCountries();
  plotCountries(data, countries);
}

function addCountryInput(event) {
  if (typeof event !== 'undefined') {
    event.preventDefault();
  }
  const countryListElem = document.getElementById('country-list');
  let countryElem = document.createElement('input');
  countryElem.type = 'text';
  countryElem.style.display = 'block';
  countryElem.placeholder = 'Italy, Germany, etc.';
  countryListElem.appendChild(countryElem);
}

function getEnteredCountries() {
  let countries = [];
  const countryListElem = document.getElementById('country-list');
  for (let countryElem of countryListElem.children) {
    let country = countryElem.value;
    if (TRANSLATIONS[country]) {
      country = TRANSLATIONS[country];
    }
    countries.push(country);
  }
  return countries;
}

// Data and init //

const TRANSLATIONS = {
  'District of Columbia': 'DC',
  'Mainland China': 'China',
  'Iran (Islamic Republic of)': 'Iran',
  'Republic of Korea': 'South Korea',
  'Korea, South': 'South Korea',
  'Britain': 'UK',
  'United Kingdom': 'UK',
  'United States': 'US',
  'Hong Kong SAR': 'Hong Kong',
  'Taipei and environs': 'Taiwan',
  'Taiwan*': 'Taiwan',
  'occupied Palestinian territory': 'Palestine',
  'Russian Federation': 'Russia',
};

window.addEventListener('load', initCovid, false);
