
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
  let placeSpecs = getEnteredPlaces();
  Plotter.plotPlaces(data, placeSpecs);
}

function addPlaceInput(event, placeStr='') {
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
  let placeInputElem = document.createElement('input');
  placeInputElem.classList.add('place-input', 'place-include');
  placeInputElem.type = 'text';
  placeInputElem.placeholder = 'Italy, New York, etc.';
  placeInputElem.value = placeStr;
  placeContainerElem.appendChild(placeInputElem);
  let placeExceptElem = document.createElement('button');
  placeExceptElem.classList.add('place-except','btn','btn-sm','btn-default');
  placeExceptElem.textContent = '-';
  placeExceptElem.title = 'except';
  placeExceptElem.addEventListener('click', addExceptInput);
  placeContainerElem.appendChild(placeExceptElem);
  let placeAlertElem = document.createElement('span');
  placeAlertElem.classList.add('place-alert', 'error', 'hidden');
  placeContainerElem.appendChild(placeAlertElem);
  placeListElem.appendChild(placeContainerElem);
}

function deletePlaceInput(event) {
  if (typeof event !== 'undefined') {
    event.preventDefault();
  }
  const placeDeleteElem = event.target;
  if (
      placeDeleteElem.tagName !== 'BUTTON' ||
      ! placeDeleteElem.classList.contains('place-delete')
  ) {
    throw `deletePlaceInput() called on wrong element (a ${placeDeleteElem.tagName})`;
  }
  const placeContainerElem = placeDeleteElem.parentElement;
  if (! placeContainerElem.classList.contains('place-container')) {
    throw (
      'Expected place-container element not found (instead got an element with classes "'+
      `${placeContainerElem.classList}").`
    );
  }
  placeContainerElem.remove();
  const placeExcludeElems = document.getElementsByClassName('place-exclude');
  if (placeExcludeElems.length === 0) {
    const excludeLabelElem = document.getElementById('exclude-label');
    excludeLabelElem.classList.add('hidden');
  }
}

function addExceptInput(event) {
  if (typeof event !== 'undefined') {
    event.preventDefault();
  }
  const placeExceptElem = event.target;
  if (
      placeExceptElem.tagName !== 'BUTTON' ||
      ! placeExceptElem.classList.contains('place-except')
  ) {
    throw `addExceptInput() called on wrong element (a ${placeExceptElem.tagName})`;
  }
  // Is there already an except input here?
  if (placeExceptElem.parentElement.querySelector('.place-exclude')) {
    return;
  }
  const placeExcludeElem = document.createElement('input');
  placeExcludeElem.classList.add('place-input', 'place-exclude');
  placeExcludeElem.type = 'text';
  placeExcludeElem.placeholder = 'Italy, New York, etc.';
  placeExceptElem.insertAdjacentElement('afterend', placeExcludeElem);
  const excludeLabelElem = document.getElementById('exclude-label');
  excludeLabelElem.classList.remove('hidden');
}

function getEnteredPlaces() {
  let placeSpecs = [];
  const placeContainerElems = document.getElementsByClassName('place-container');
  for (let placeContainerElem of placeContainerElems) {
    let placeSpec;
    try {
      placeSpec = {
        include: getAndProcessPlaceInput(placeContainerElem, '.place-include'),
        exclude: getAndProcessPlaceInput(placeContainerElem, '.place-exclude')
      };
    } catch (error) {
      console.error(error);
      continue;
    }
    if (placeSpec.include) {
      placeSpecs.push(placeSpec);
    }
    rmPlaceAlert(placeContainerElem);
  }
  return placeSpecs;
}

function getAndProcessPlaceInput(placeContainerElem, selector) {
  let placeInputElem = placeContainerElem.querySelector(selector);
  if (placeInputElem === null) {
    return null;
  }
  let rawPlaceStr = placeInputElem.value.trim();
  if (rawPlaceStr === '') {
    return null;
  }
  let place = parsePlace(rawPlaceStr);
  if (place) {
    return place;
  } else {
    setPlaceAlert(placeContainerElem, rawPlaceStr);
    throw `Place "${rawPlaceStr}" not found.`;
  }
}

function parsePlace(rawPlaceStr) {
  let placeStr = rawPlaceStr.toLowerCase();
  if (Loader.TRANSLATIONS.has(placeStr)) {
    placeStr = Loader.TRANSLATIONS.get(placeStr);
  }
  return Loader.INDEX.get(placeStr);
}

function rmPlaceAlert(placeContainerElem) {
  setPlaceAlert(placeContainerElem, false);
}

function setPlaceAlert(placeContainerElem, placeStr) {
  let placeAlertElem = placeContainerElem.querySelector('.place-alert');
  if (placeStr) {
    placeAlertElem.textContent = `Did not recognize "${placeStr}". Try checking the spelling.`;
    placeAlertElem.classList.remove('hidden');
  } else {
    placeAlertElem.classList.add('hidden');
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
