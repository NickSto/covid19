
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
  // <div id="place-list">
  const placeListElem = document.getElementById('place-list');
    // <p class="place-container">
    const placeContainerElem = document.createElement('p');
    placeContainerElem.classList.add('place-container');
      // <button class="place-delete">
      const placeDeleteElem = document.createElement('button');
      placeDeleteElem.classList.add('place-delete','btn','btn-sm','btn-default');
      placeDeleteElem.textContent = '✕';
      placeDeleteElem.title = 'delete';
      placeDeleteElem.addEventListener('click', deletePlaceInput);
      placeContainerElem.appendChild(placeDeleteElem);
      // <div class="place-subcontainer">
      const subContainerElem = document.createElement('div');
      subContainerElem.classList.add('place-subcontainer');
        // <span class="place-input-container">
        const inputContainerElem = document.createElement('span');
        inputContainerElem.classList.add('place-input-container');
          // <input class="place-input place-include">
          const placeInputElem = document.createElement('input');
          placeInputElem.classList.add('place-input', 'place-include');
          placeInputElem.type = 'text';
          placeInputElem.placeholder = 'Italy, New York, etc.';
          placeInputElem.value = placeStr;
        inputContainerElem.appendChild(placeInputElem)
        subContainerElem.appendChild(inputContainerElem);
        // <span class="place-input-modifiers">
        const buttonContainerElem = document.createElement('span');
        buttonContainerElem.classList.add('place-input-modifiers');
          // <button class="place-plus">
          const placePlusElem = document.createElement('button');
          placePlusElem.classList.add('place-plus','btn','btn-sm','btn-default');
          placePlusElem.textContent = '+';
          placePlusElem.title = 'Add another place';
          placePlusElem.addEventListener('click', event => addSubPlaceInput(event, 'plus'));
          buttonContainerElem.appendChild(placePlusElem);
          // <button class="place-minus">
          const placeMinusElem = document.createElement('button');
          placeMinusElem.classList.add('place-minus','btn','btn-sm','btn-default');
          placeMinusElem.textContent = '-';
          placeMinusElem.title = 'Exclude a subregion';
          placeMinusElem.addEventListener('click', event => addSubPlaceInput(event, 'minus'));
        buttonContainerElem.appendChild(placeMinusElem);
        subContainerElem.appendChild(buttonContainerElem);
        // <span class="place-alert error hidden">
        const placeAlertElem = document.createElement('span');
        placeAlertElem.classList.add('place-alert', 'error', 'hidden');
      subContainerElem.appendChild(placeAlertElem);
    placeContainerElem.appendChild(subContainerElem);
    // <div class="clearfix">
    const clearfixElem = document.createElement('div');
    clearfixElem.classList.add('clearfix');
    placeContainerElem.appendChild(clearfixElem);
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
      'Expected place-container element not found (instead got an element with class="'+
      `${placeContainerElem.classList}").`
    );
  }
  placeContainerElem.remove();
  setExcludeLabels();
}

const INPUT_TYPE_DATA = {
  plus:  {action:'include', operand:'+'},
  minus: {action:'exclude', operand:'-'},
}
function addSubPlaceInput(event, type) {
  const typeData = INPUT_TYPE_DATA[type];
  if (typeof event !== 'undefined') {
    event.preventDefault();
  }
  // Validate assumptions: make sure the event target is what we expect.
  const buttonElem = event.target;
  if (buttonElem.tagName !== 'BUTTON' || ! buttonElem.classList.contains(`place-${type}`)) {
    throw (
      `addSubPlaceInput() called on wrong element (a <${buttonElem.tagName} `+
      `class="${buttonElem.classList}">)`
    );
  }
  const buttonContainerElem = buttonElem.parentElement;
  if (
    buttonContainerElem.tagName !== 'SPAN' ||
    ! buttonContainerElem.classList.contains('place-input-modifiers')
  ) {
    throw (
      `Parent of place input button not as expected. Saw instead a <${buttonContainerElem.tagName} `+
      `class="${buttonContainerElem.classList}">.`
    );
  }
  // Now add the new elements.
  // <span class="place-input-container">
  const inputContainerElem = document.createElement('span');
  inputContainerElem.classList.add('place-input-container');
    // <span class="place-operand">
    const operandElem = document.createElement('span');
    operandElem.classList.add('place-operand');
    operandElem.textContent = typeData.operand;
    inputContainerElem.appendChild(operandElem);
    // <input class="place-input place-[action]">
    const inputElem = document.createElement('input');
    inputElem.classList.add('place-input', `place-${typeData.action}`);
    inputElem.type = 'text';
    inputElem.placeholder = 'Italy, New York, etc.';
  inputContainerElem.appendChild(inputElem);
  // Insert right before the buttons.
  buttonContainerElem.insertAdjacentElement('beforebegin', inputContainerElem);
  setExcludeLabels();
}

function setExcludeLabels() {
  const modifierLabelElem = document.getElementById('modifier-label');
  const modifiersLabelElem = document.getElementById('modifiers-label');
  let maxInputs = 0;
  for (let containerElem of document.getElementsByClassName('place-container')) {
    const inputElems = containerElem.querySelectorAll('.place-input');
    if (inputElems.length > maxInputs) {
      maxInputs = inputElems.length;
    }
  }
  if (maxInputs === 1) {
    modifierLabelElem.classList.add('hidden');
    modifiersLabelElem.classList.add('hidden');
  } else if (maxInputs === 2) {
    modifierLabelElem.classList.remove('hidden');
    modifiersLabelElem.classList.add('hidden');
  } else if (maxInputs >= 3) {
    modifierLabelElem.classList.add('hidden');
    modifiersLabelElem.classList.remove('hidden');
  } else {
    throw `Invalid number of .place-input elements (${maxInputs}).`;
  }
}

function getEnteredPlaces() {
  let placeSpecs = [];
  const placeContainerElems = document.getElementsByClassName('place-container');
  for (let placeContainerElem of placeContainerElems) {
    let placeSpec;
    try {
      placeSpec = {
        includes: getAndProcessPlaceInputs(placeContainerElem, '.place-include'),
        excludes: getAndProcessPlaceInputs(placeContainerElem, '.place-exclude')
      };
    } catch (error) {
      console.error(error);
      continue;
    }
    if (placeSpec.includes.length >= 1) {
      placeSpecs.push(placeSpec);
    }
    rmPlaceAlert(placeContainerElem);
  }
  return placeSpecs;
}

function getAndProcessPlaceInputs(placeContainerElem, selector) {
  let places = [];
  for (const placeInputElem of placeContainerElem.querySelectorAll(selector)) {
    const place = getAndProcessPlaceInput(placeContainerElem, placeInputElem);
    if (place) {
      places.push(place);
    }
  }
  return places;
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
