
import * as Loader from './loader.js';

export function wireUI(data, defaultPlaces) {
  const addPlaceElem = document.getElementById('add-place');
  addPlaceElem.addEventListener('click', addPlaceInput);
  for (let [country, region] of defaultPlaces) {
    let place;
    if (region === '__all__') {
      place = Loader.PLACES[country].displayName;
    } else {
      place = Loader.PLACES[country].regions[region].displayName;
    }
    addPlaceInput(null, place);
  }
  const plotBtnElem = document.getElementById('plot-btn');
  plotBtnElem.addEventListener('click', event => plot(event, data));
  const optionsElem = document.getElementById('options');
  optionsElem.addEventListener('click', setValidOptions);
  setValidOptions();
}

function plot(event, data) {
  if (typeof event !== 'undefined') {
    event.preventDefault();
  }
  let places = getEnteredPlaces();
  plotPlaces(data, places);
}

function addPlaceInput(event, place=null) {
  if (typeof event !== 'undefined' && event) {
    event.preventDefault();
  }
  const placeListElem = document.getElementById('place-list');
  let placeContainerElem = document.createElement('p');
  let placeDeleteElem = document.createElement('button');
  placeDeleteElem.classList.add('place-delete','btn','btn-sm','btn-default');
  placeDeleteElem.textContent = '✕';
  placeDeleteElem.title = 'delete';
  placeDeleteElem.addEventListener('click', deletePlaceInput);
  placeContainerElem.appendChild(placeDeleteElem);
  let placeInputElem = document.createElement('input');
  placeInputElem.classList.add('place-input');
  placeInputElem.type = 'text';
  placeInputElem.placeholder = 'Italy, New York, etc.';
  if (place) {
    placeInputElem.value = place;
  }
  placeContainerElem.appendChild(placeInputElem);
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
  const placeInputElems = document.getElementsByClassName('place-input');
  for (let placeInputElem of placeInputElems) {
    let placeStr = placeInputElem.value.trim();
    if (placeStr === '') {
      setPlaceAlert(placeInputElem, true);
    } else {
      let [country, region] = parsePlace(placeStr);
      if (country === null || region === null) {
        setPlaceAlert(placeInputElem, false);
      } else {
        setPlaceAlert(placeInputElem, true);
        places.push([country, region]);
      }
    }
  }
  return places;
}

function parsePlace(placeStr) {
  let country = null;
  let region = null;
  let rawPlace = placeStr.toLowerCase();
  if (Loader.TRANSLATIONS.hasOwnProperty(rawPlace)) {
    rawPlace = Loader.TRANSLATIONS[rawPlace];
  }
  // Is it a postal code?
  let possibleCode = placeStr.toUpperCase();
  for (let country in Loader.REGION_CODES) {
    let regionCodes = Loader.REGION_CODES[country];
    if (regionCodes.hasOwnProperty(possibleCode)) {
      region = regionCodes[possibleCode];
      return [country, region];
    }
  }
  // Is it a country?
  if (Loader.PLACES.hasOwnProperty(rawPlace)) {
    country = rawPlace;
    region = '__all__';
    return [country, region];
  }
  // Is it a region?
  for (let country in Loader.PLACES) {
    let countryData = Loader.PLACES[country];
    if (countryData.hasOwnProperty('regions')) {
      if (countryData.regions.hasOwnProperty(rawPlace)) {
        region = rawPlace;
        return [country, region];
      }
    }
  }
  console.error(`Could not find place "${placeStr}".`);
  return [country, region];
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
