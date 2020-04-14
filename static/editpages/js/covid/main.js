
import * as Loader from './loader.js?via=js';
import * as UI from './ui.js?via=js';

const DEFAULT_PLACES = ['Lombardy', 'New York', 'Italy', 'US'];

function init() {
  const linkElem = document.getElementById('json-link');
  function callback(event) {
    Loader.initPlaces(event, loadDataAndWireUI);
  }
  Loader.makeRequest(linkElem.href+'?via=js', callback, 'json');
}

function loadDataAndWireUI() {
  let data = Loader.makeEmptyData();
  Loader.loadData(data, () => UI.plotEnteredPlaces(data));
  UI.wireUI(data, DEFAULT_PLACES);
}

window.addEventListener('load', init, false);
