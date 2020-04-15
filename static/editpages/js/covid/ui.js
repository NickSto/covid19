
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
  const deleteElem = event.target;
  if (deleteElem.tagName !== 'BUTTON' || ! deleteElem.classList.contains('place-delete')) {
    throw `deletePlaceInput() called on wrong element (a ${deleteElem.tagName})`;
  }
  const placeContainerElem = deleteElem.parentElement;
  if (! placeContainerElem.classList.contains('place-container')) {
    throw (
      'Expected place-container element not found (instead got an element with classes "'+
      `${placeContainerElem.classList}").`
    );
  }
  placeContainerElem.remove();
  setExcludeLabels();
}

function addExceptInput(event) {
  if (typeof event !== 'undefined') {
    event.preventDefault();
  }
  const exceptElem = event.target;
  if (exceptElem.tagName !== 'BUTTON' || ! exceptElem.classList.contains('place-except')) {
    throw `addExceptInput() called on wrong element (a ${exceptElem.tagName})`;
  }
  const excludeElem = document.createElement('input');
  excludeElem.classList.add('place-input', 'place-exclude');
  excludeElem.type = 'text';
  excludeElem.placeholder = 'Italy, New York, etc.';
  const excludeElems = exceptElem.parentElement.querySelectorAll('.place-exclude');
  if (excludeElems.length >= 1) {
    excludeElem.classList.add('place-excludes');
  }
  exceptElem.insertAdjacentElement('afterend', excludeElem);
  const exceptElem2 = document.createElement('button');
  exceptElem2.classList.add('place-except','btn','btn-sm','btn-default');
  exceptElem2.textContent = '-';
  exceptElem2.title = 'except';
  exceptElem2.addEventListener('click', addExceptInput);
  excludeElem.insertAdjacentElement('afterend', exceptElem2);
  setExcludeLabels();
}

function setExcludeLabels() {
  const excludeLabelElem = document.getElementById('exclude-label');
  const excludesLabelElem = document.getElementById('excludes-label');
  const excludeElems = document.getElementsByClassName('place-exclude');
  const excludeExtraElems = document.getElementsByClassName('place-excludes');
  if (excludeElems.length === 0 && excludeExtraElems.length === 0) {
    excludeLabelElem.classList.add('hidden');
    excludesLabelElem.classList.add('hidden');
  } else if (excludeElems.length >= 1 && excludeExtraElems.length === 0) {
    excludeLabelElem.classList.remove('hidden');
    excludesLabelElem.classList.add('hidden');
  } else if (excludeElems.length >= 1 && excludeExtraElems.length >= 1) {
    excludeLabelElem.classList.add('hidden');
    excludesLabelElem.classList.remove('hidden');
  } else {
    throw `Invalid combination of .place-exclude and .place-excludes elements.`;
  }
}

function getEnteredPlaces() {
  let placeSpecs = [];
  const placeContainerElems = document.getElementsByClassName('place-container');
  for (let placeContainerElem of placeContainerElems) {
    let placeSpec;
    try {
      placeSpec = {
        include: getAndProcessPlaceInputs(placeContainerElem, '.place-include', 'single'),
        excludes: getAndProcessPlaceInputs(placeContainerElem, '.place-exclude', 'multi')
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

function getAndProcessPlaceInputs(placeContainerElem, selector, amount='single') {
  if (amount === 'single') {
    const placeInputElem = placeContainerElem.querySelector(selector);
    return getAndProcessPlaceInput(placeContainerElem, placeInputElem);
  } else if (amount === 'multi') {
    let places = [];
    for (const placeInputElem of placeContainerElem.querySelectorAll(selector)) {
      const place = getAndProcessPlaceInput(placeContainerElem, placeInputElem);
      if (place) {
        places.push(place);
      }
    }
    return places;
  }
}

function getAndProcessPlaceInput(placeContainerElem, placeInputElem) {
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
  let place = Loader.INDEX.get(placeStr);
  if (! place) {
    // Is it an (all caps) region code?
    place = Loader.INDEX.get(rawPlaceStr);
  }
  return place;
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
