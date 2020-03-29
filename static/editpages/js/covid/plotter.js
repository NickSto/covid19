
import * as Loader from './loader.js';
import * as UI from './ui.js';

const PLOT_LAYOUT = {
  margin: {t:0, b:0, l:0, r:0},
  yaxis: {automargin: true},
  xaxis: {automargin: true},
};

export function plotPlaces(data, places) {
  let plotData = [];

  let options = UI.getOptions();

  for (let place of places) {
    try {
      let placeData = getPlacePlotData(place, data, options);
      plotData.push(placeData);
    } catch(error) {
      console.error(error);
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
    unit = unit.replace(/s$/,'')+' rate';
  }
  return prefix+unit+suffix;
}

function getPlacePlotData(place, data, options) {
  // Get the raw confirmed cases counts.
  let dates = data.dates;
  let placeCounts = data.counts.get(place);
  if (! placeCounts) {
    throw `Place ${place} not found.`;
  }
  let counts = getPlaceCounts(data.counts.get(place), options.dataType);
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
    yVals = divideByPop(yVals, data.places.get(place).population);
  }
  let displayName = data.places.get(place).displayName;
  return {name:displayName, x:dates, y:yVals}
}

function getPlaceCounts(allPlaceCounts, dataType) {
  if (dataType === 'mortality') {
    let cases = allPlaceCounts.cases;
    let deaths = allPlaceCounts.deaths;
    return countsToMortality(cases, deaths);
  } else {
    return allPlaceCounts.get(dataType);
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

function divideByPop(rawCounts, population) {
  let newCounts = [];
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
