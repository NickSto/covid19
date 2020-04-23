
import * as Loader from './loader.js?via=js';
import * as Utils from './utils.js?via=js';
import * as UI from './ui.js?via=js';

const COLORS = Plotly.d3.scale.category10();
const PLOT_LAYOUT = {
  margin: {t:0, b:0, l:0, r:0},
  yaxis: {automargin: true},
  xaxis: {automargin: true},
  showlegend: true,
  legend: {x: 0.05, y: 1}
};

export function plotPlaces(data, placeSpecs) {
  let plotData = [];
  let options = UI.getOptions();
  let smooth = ! isNaN(options.smoothing) && options.smoothing > 1;

  for (let [i, placeSpec] of placeSpecs.entries()) {
    try {
      let placeData = getPlacePlotData(placeSpec, data, options);
      placeData.marker = {color: COLORS(i)};
      plotData.push(placeData);
      if (smooth) {
        try {
          plotData.push(smoothPlot(placeData, options.smoothing));
        } catch (error) {
          console.error(error);
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  const plotTitleElem = document.getElementById('plot-title');
  let plotTitle = getPlacesString(plotData.map(d => d.name))+' '+getPlotDescription(options);
  plotTitleElem.textContent = plotTitle;
  const plotNotesElem = document.getElementById('plot-notes');
  if (smooth) {
    plotNotesElem.textContent = `Lines are running ${options.smoothing} day averages.`;
    plotNotesElem.classList.remove('hidden');
  } else {
    plotNotesElem.classList.add('hidden');
  }

  let layout = Utils.deepishCopy(PLOT_LAYOUT);
  if (options.rates) {
    layout.yaxis.tickformat = '%';
  } else if (options.dataType === 'mortality') {
    layout.yaxis.tickformat = '.2p'
  }
  if (options.log) {
    layout.yaxis.type = 'log';
  }

  const plotContainer = document.getElementById('plot');
  Plotly.newPlot(plotContainer, plotData, layout);
}

function getPlacesString(displayNames) {
  let placesList = [];
  let lastDisplayName = null;
  for (let displayName of displayNames) {
    if (! displayName || displayName === lastDisplayName) {
      continue;
    }
    let primaryName = displayName.split(/ [+-] /)[0];
    let suffix = '';
    let hasPlus = displayName.includes(' + ');
    let hasMinus = displayName.includes(' - ');
    if (hasPlus && hasMinus) {
      suffix = '±';
    } else if (hasPlus) {
      suffix = '+';
    } else if (hasMinus) {
      suffix = '-';
    }
    placesList.push(primaryName+suffix);
    lastDisplayName = displayName;
  }
  return placesList.join(', ');
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

function getPlacePlotData(placeSpec, data, options) {
  let [dates, yVals] = getPlaceNumbers(placeSpec.includes, placeSpec.excludes, data, options);
  let displayName = concatDisplayName(placeSpec.includes, placeSpec.excludes);
  return {name:displayName, x:dates, y:yVals, type:'scatter', mode:'markers'};
}

function getPlaceNumbers(places, excludedPlaces, data, options) {
  // Get the raw confirmed cases counts.
  let dates = data.dates;
  let placesData = getPlacesData(data, places)
  let excludedDatas = getPlacesData(data, excludedPlaces);
  let counts = getPlaceCounts(placesData, excludedDatas, options.dataType);
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
    let population = getPopulation(places) - getPopulation(excludedPlaces);
    yVals = divideByPop(yVals, population);
  }
  return [dates, yVals];
}

function smoothPlot(rawPlotData, windowSize) {
  let smoothedPlotData = {};
  Object.assign(smoothedPlotData, rawPlotData);
  let averages = [];
  let window = [];
  for (let value of rawPlotData.y) {
    window.push(value);
    if (window.length < windowSize) {
      continue;
    } else if (window.length > windowSize) {
      window.shift();
    }
    averages.push(Utils.average(window));
  }
  let leftTrim = Math.ceil((windowSize-1)/2);
  let rightTrim = Math.floor((windowSize-1)/2);
  let xVals = rawPlotData.x;
  let smoothedX = xVals.slice(leftTrim, xVals.length-rightTrim);
  let smoothedY = averages;
  if (smoothedX.length !== smoothedY.length) {
    throw (
      `Ended up with mismatched X and Y arrays in smoothPlot() `+
      `(${smoothedX.length} != ${smoothedY.length})`
    );
  }
  smoothedPlotData.x = smoothedX;
  smoothedPlotData.y = smoothedY;
  smoothedPlotData.mode = 'line';
  smoothedPlotData.showlegend = false;
  return smoothedPlotData;
}

function getPlacesData(data, places) {
  let placeDatas = [];
  for (let place of places) {
    let placeData = data.counts.get(place);
    if (! placeData) {
      throw `Excluded place ${JSON.stringify(place)} not found.`;
    }
    placeDatas.push(placeData);
  }
  return placeDatas;
}

function getPlaceCounts(allIncludedCounts, allExcludedsCounts, dataType) {
  let counts;
  if (dataType === 'mortality') {
    counts = getMortalityCounts(allIncludedCounts, allExcludedsCounts);
  } else {
    counts = getRawPlaceCounts(allIncludedCounts, allExcludedsCounts, dataType);
  }
  return counts;
}

function getMortalityCounts(allIncludedCounts, allExcludedsCounts) {
  let cases = getRawPlaceCounts(allIncludedCounts, allExcludedsCounts, 'cases');
  let deaths = getRawPlaceCounts(allIncludedCounts, allExcludedsCounts, 'deaths');
  return countsToMortality(cases, deaths);
}

function getRawPlaceCounts(allIncludedCounts, allExcludedsCounts, dataType) {
  let counts = addSeries(allIncludedCounts.map(c => c.get(dataType)));
  if (allExcludedsCounts.length > 0) {
    let excludedCounts = addSeries(allExcludedsCounts.map(c => c.get(dataType)));
    counts = subtractSeries(counts, excludedCounts);
  }
  return counts;
}

function addSeries(serieses) {
  let totals = [];
  for (let series of serieses) {
    for (let i = 0; i < totals.length || i < series.length; i++) {
      if (i >= series.length) {
        break;
      }
      if (i < totals.length) {
        totals[i] += series[i];
      } else {
        totals.push(series[i]);
      }
    }
  }
  return totals;
}

function subtractSeries(leftSeries, rightSeries) {
  if (leftSeries.length !== rightSeries.length) {
    console.error(
      `Subtracting series of unequal lengths: ${leftSeries.length} != ${rightSeries.length}`
    );
  }
  let diffSeries = [];
  for (let i = 0; i < leftSeries.length && i < rightSeries.length; i++) {
    let diff = leftSeries[i] - rightSeries[i];
    diffSeries.push(diff);
  }
  return diffSeries;
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

function getPopulation(places) {
  let population = 0;
  for (let place of places) {
    let subPop = Loader.PLACES.get(place).get('population');
    if (! subPop) {
      throw `No population found for place ${JSON.stringify(place)}`;
    }
    population += subPop;
  }
  return population;
}

function divideByPop(rawCounts, population) {
  let newCounts = [];
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

function concatDisplayName(includedPlaces, excludedPlaces) {
  let includedNames = [];
  for (let place of includedPlaces) {
    let displayName = Loader.PLACES.get(place).get('displayName');
    includedNames.push(displayName);
  }
  let excludedNames = [];
  for (let place of excludedPlaces) {
    let displayName = Loader.PLACES.get(place).get('displayName');
    excludedNames.push(displayName);
  }
  let displayName = includedNames.join(' + ');
  if (excludedNames.length > 0) {
    displayName += ' - ' + excludedNames.join(' - ');
  }
  return displayName;
}
