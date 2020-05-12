
import * as Loader from './loader.js?via=js';

const HOSPITAL_URL = 'https://coronavirus.dc.gov/page/hospital-status-data';
const CORS_PROXY = 'https://cors-anywhere.herokuapp.com/';
const MONTHS = {
  'Jan':0, 'Feb':1, 'Mar':2, 'Apr':3, 'May':4, 'Jun':5, 'Jul':6, 'Aug':7, 'Sep':8, 'Oct':9, 'Nov':10, 'Dec':11
};
let APRIL28 = new Date(2020, 3, 27, 23);
const LABELS = {
  'ICU Beds In Use': 'ICU Beds In Use',
  'In-Use Ventilators in Hospitals': 'Ventilators In Use',
};
const PLOT_LAYOUT = {
  margin: {t:0, b:0, l:0, r:0},
  xaxis: {automargin: true},
  yaxis: {automargin: true, rangemode: 'tozero'},
  showlegend: true,
  legend: {x: 0.05, y: 1}
};

export function loadAndPlot() {
  Loader.makeRequest(CORS_PROXY+HOSPITAL_URL, parseAndPlot, 'document');
}

function parseAndPlot(event) {
  let xhr = event.target;
  const mainElem = xhr.response.querySelector('#node-page-1469061 .content .field-item');
  let [dates, data] = parseData(mainElem);
  inferData(dates, data);
  makePlot(dates, data);
}

function parseData(mainElem) {
  let dates = [];
  let data = [];
  let section = 'date';
  let date = null;
  let dayData = new Map();
  for (const [i, child] of Array.from(mainElem.children).entries()) {
    if (section === 'date') {
      if (child.nodeName === 'P' && child.children.length === 1 && child.children[0].nodeName == 'STRONG') {
        let dateStr = child.children[0].textContent;
        date = parseDate(dateStr);
        section = 'content';
      } else {
        throw `Invalid date section on child ${i}.`;
      }
    } else if (section === 'content') {
      if (child.nodeName === 'UL' && child.children.length > 0) {
        for (let dataElem of child.children) {
          if (dataElem.nodeName !== 'LI') {
            throw `Invalid content section on child ${i}: Expected LI, got ${dataElem.nodeName}`;
          }
          let [labelStr, valueStr] = dataElem.textContent.split(': ');
          dayData.set(labelStr, parseLooseInt(valueStr));
        }
        section = 'end';
      } else {
        throw `Invalid content section on child ${i}.`;
      }
    } else if (section === 'end') {
      if (child.nodeName === 'HR') {
        dates.push(date);
        data.push(dayData);
        dayData = new Map();
        section = 'date';
      } else {
        throw `Invalid end section on child ${i}: Tag was ${child.nodeName}`;
      }
    }
  }
  if (section === 'end') {
    dates.push(date);
    data.push(dayData);
  }
  return [dates, data];
}

function inferData(dates, data) {
  // Insert an artificial data series, 'ICU Beds In Use'.
  for (let i = 0; i < dates.length; i++) {
    let date = dates[i];
    let dayData = data[i];
    let totalBeds = dayData.get('Total ICU Beds in Hospitals');
    if (totalBeds === undefined) {
      if (date < APRIL28) {
        totalBeds = 345;
      } else {
        console.error(`No "Total ICU Beds" found on ${date}.`);
        continue;
      }
    }
    let availableBeds = dayData.get('ICU Beds Available');
    if (availableBeds === undefined) {
      console.error(`No "ICU Beds Available" found on ${date}.`);
      continue;
    }
    dayData.set('ICU Beds In Use', totalBeds-availableBeds);
  }
}

function makePlot(dates, data) {
  let plotData = [];
  for (let [label, displayLabel] of Object.entries(LABELS)) {
    let [xVals, yVals] = getSeriesData(label, dates, data);
    plotData.push({name:displayLabel, x:xVals, y:yVals, type:'scatter', mode:'lines+markers'});
  }
  const plotTitleElem = document.getElementById('plot-title');
  plotTitleElem.textContent = 'DC Hospitalizations';
  const plotNotesElem = document.getElementById('plot-notes');
  plotNotesElem.classList.add('hidden');
  const plotContainer = document.getElementById('plot');
  Plotly.newPlot(plotContainer, plotData, PLOT_LAYOUT);
}

function getSeriesData(label, dates, data) {
  let xVals = [];
  let yVals = [];
  for (let i = 0; i < dates.length; i++) {
    let date = dates[i];
    let dayData = data[i];
    if (dayData.has(label)) {
      xVals.push(date);
      yVals.push(dayData.get(label));
    }
  }
  return [xVals, yVals];
}

function parseDate(dateStr) {
  let parts = dateStr.trim().split(' ');
  if (parts.length !== 3) {
    throw `Invalid date ${dateStr}: ${parts.length} fields.`;
  }
  let [monthStr, dayStr, yearStr] = parts;
  let month = MONTHS[monthStr.slice(0, 3)];
  if (month === undefined) {
    throw `Invalid date ${dateStr}: Bad month ${parts[0]}.`;
  }
  if (! dayStr.endsWith(',')) {
    throw `Invalid date ${dateStr}: Bad day ${dayStr} (no comma).`;
  }
  let trimmedDay = dayStr.slice(0, dayStr.length-1);
  let day = parseInt(trimmedDay);
  if (isNaN(day)) {
    throw `Invalid date ${dateStr}: Bad day ${dayStr}.`;
  }
  let year = parseInt(yearStr);
  if (isNaN(year)) {
    throw `Invalid date ${dateStr}: Bad year ${yearStr}.`;
  }
  return new Date(year, month, day);
}

function parseLooseInt(looseIntStr) {
  let intStr = looseIntStr.replace(/[,%]/g, '');
  let value = parseInt(intStr);
  if (isNaN(value)) {
    throw `Invalid int: ${looseIntStr}.`;
  }
  return value;
}