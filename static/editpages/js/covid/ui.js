
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
    let placeInputElem;
    for (let division of Loader.DIVISIONS) {
      placeInputElem = placeContainerElem.querySelector(`.${division}-input`);
      let placeStr = placeInputElem.value.trim().toLowerCase();
      try {
        let placeKey = parsePlace(placeStr, division, place);
        place.push(placeKey);
      } catch (error) {
        console.error(error);
        setPlaceAlert(placeInputElem, false);
      }
    }
    if (place.length === Loader.DIVISIONS.length && !place.every(p => p === null)) {
      setPlaceAlert(placeInputElem, true);
      places.push(place);
    }
  }
  return places;
}

function parsePlace(placeStr, division, place) {
  let placeKey;
  if (placeStr === '') {
    placeKey = null;
  } else {
    placeKey = placeStr;
  }
  // Run country/region names through translator.
  if (division === Loader.DIVISIONS[0] || division === Loader.DIVISIONS[1]) {
    if (Loader.TRANSLATIONS.has(placeKey)) {
      placeKey = Loader.TRANSLATIONS.get(placeKey);
    }
  }
  // Look up region code and check if valid region.
  if (division === Loader.DIVISIONS[1] && place.length >= 1) {
    let country = place[0];
    let regionCodes = Loader.PLACES.get([country,null,null,null]).get('codes');
    let region = regionCodes.get(placeStr.toUpperCase());
    if (region) {
      placeKey = region;
    }
  }
  // Try to look up the key to see if it's valid.
  let testPlace = [...place, placeKey];
  while (testPlace.length < Loader.DIVISIONS.length) {
    testPlace.push(null);
  }
  if (testPlace.every(p => p === null)) {
    return null;
  }
  let valid = false;
  if (Loader.PLACES.get(testPlace)) {
    valid = true;
  } else {
    // If it's a county or town, try adding ' county' or ' city' to the name.
    let newPlaceKey = placeKey;
    if (division === Loader.DIVISIONS[2]) {
      newPlaceKey += ' county';
    } else if (division === Loader.DIVISIONS[3]) {
      newPlaceKey += ' city';
    }
    if (newPlaceKey !== placeKey) {
      let divisionI = Loader.DIVISIONS.indexOf(division);
      testPlace[divisionI] = newPlaceKey;
      if (Loader.PLACES.get(testPlace)) {
        console.log(`Found place by appending "county"/"city".`);
        valid = true;
        placeKey = newPlaceKey;
      }
    }
  }
  if (valid) {
    return placeKey;
  } else {
    throw `${division} "${placeStr}" not found.`;
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
