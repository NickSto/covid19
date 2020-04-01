
import * as Loader from './loader.js?via=js';
import * as Plotter from './plotter.js?via=js';

export function wireUI(data, defaultPlaces) {
  const addPlaceElem = document.getElementById('add-place');
  addPlaceElem.addEventListener('click', addPlaceInput);
  for (let place of defaultPlaces) {
    addPlaceInput(null, place);
  }
  const plotBtnElem = document.getElementById('plot-btn');
  plotBtnElem.addEventListener('click', event => {event.preventDefault(); plotEnteredPlaces(data);});
  const optionsElem = document.getElementById('options');
  optionsElem.addEventListener('click', setValidOptions);
  setValidOptions();
}

export function plotEnteredPlaces(data) {
  let places = getEnteredPlaces();
  Plotter.plotPlaces(data, places);
}

function addPlaceInput(event, place=null) {
  if (typeof event !== 'undefined' && event) {
    event.preventDefault();
  }
  const placeListElem = document.getElementById('place-list');
  let placeContainerElem = document.createElement('p');
  placeContainerElem.classList.add('place-container');
  let placeDeleteElem = document.createElement('button');
  placeDeleteElem.classList.add('place-delete','btn','btn-sm','btn-default');
  placeDeleteElem.textContent = '✕';
  placeDeleteElem.title = 'delete';
  placeDeleteElem.addEventListener('click', deletePlaceInput);
  placeContainerElem.appendChild(placeDeleteElem);
  for (let i = 0; i < Loader.DIVISIONS.length; i++) {
    let division = Loader.DIVISIONS[i];
    let placeInputElem = document.createElement('input');
    placeInputElem.classList.add('place-input',`${division}-input`);
    placeInputElem.type = 'text';
    // placeInputElem.placeholder = 'Italy, New York, etc.';
    if (place) {
      placeInputElem.value = place[i];
    }
    placeContainerElem.appendChild(placeInputElem);
  }
  let placeAlertElem = document.createElement('span');
  placeAlertElem.classList.add('place-alert', 'error', 'hidden');
  placeAlertElem.textContent = "Did not recognize this place. Try checking the spelling.";
  placeContainerElem.appendChild(placeAlertElem);
  placeListElem.appendChild(placeContainerElem);
}

function deletePlaceInput(event) {
  if (typeof event !== 'undefined') {
    event.preventDefault();
  }
  let placeDeleteElem = event.target;
  if (!(placeDeleteElem.tagName === 'BUTTON' && placeDeleteElem.classList.contains('place-delete'))) {
    console.error(`deletePlaceInput() called on wrong element (a ${placeDeleteElem.tagName})`);
    return;
  }
  placeDeleteElem.parentElement.remove();
}

function getEnteredPlaces() {
  let places = [];
  const placeContainerElems = document.getElementsByClassName('place-container');
  for (let placeContainerElem of placeContainerElems) {
    let place = [];
    for (let division of Loader.DIVISIONS) {
      const placeInputElem = placeContainerElem.querySelector(`.${division}-input`);
      let placeStr = placeInputElem.value.trim().toLowerCase();
      let placeKey = parsePlace(placeStr, division, place);
      place.push(placeKey);
    }
    places.push(place);
  }
  return places;
}

function parsePlace(placeStr, division, place) {
  if (division === 'country' || division === 'region') {
    if (Loader.TRANSLATIONS.has(placeStr)) {
      placeStr = Loader.TRANSLATIONS.get(placeStr);
    }
  }
  if (division === 'region') {
    let country = place[0];
    let regionCodes = Loader.PLACES.get([country,null,null,null]).get('codes');
    let region = regionCodes.get(placeStr.toUpperCase());
    if (region) {
      return region;
    }
  }
  if (placeStr === '') {
    return null;
  } else {
    return placeStr;
  }
}

function setPlaceAlert(placeInputElem, valid) {
  let placeAlertElem = placeInputElem.parentElement.querySelector('.place-alert');
  if (valid) {
    placeAlertElem.classList.add('hidden');
  } else {
    placeAlertElem.classList.remove('hidden');
  }
  return;
}

export function getOptions() {
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
    let optionElem = document.querySelector(`.option[value="${value}"]`);
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

export function setError(message) {
  const stderrElem = document.getElementById('stderr');
  stderrElem.classList.remove('hidden');
  stderrElem.textContent = message;
}

export function clearError() {
  const stderrElem = document.getElementById('stderr');
  stderrElem.classList.add('hidden');
  stderrElem.textContent = '';
}
