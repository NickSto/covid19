
import * as Loader from './loader.js?via=js';
import * as UI from './ui.js?via=js';

const DEFAULT_PLACES = ['Lombardy', 'New York', 'Italy', 'US'];

function init() {
  const linkElem = document.getElementById('json-link');
  const url = linkElem.href+'?via=js';
  function callback(event) {
    Loader.initPlaces(event, loadDataAndWireUI, url);
  }
  Loader.makeRequest(url, callback, 'json');
}

function loadDataAndWireUI() {
  let data = Loader.makeEmptyData();
  Loader.loadData(data, () => UI.plotEnteredPlaces(data));
  UI.wireUI(data, DEFAULT_PLACES);
}

window.addEventListener('load', init, false);
