
import * as Plotter from './plotter.js';
import * as Loader from './loader.js';
import * as UI from './ui.js';

const DEFAULT_PLACES = [['usa',null,null,null]];

function init() {
  const linkElem = document.getElementById('json-link');
  const callback = event => Loader.initPlaces(event, loadDataAndWireUI);
  Loader.makeRequest(linkElem.href+'?via=js', callback, 'json');
}

function loadDataAndWireUI() {
  let data = Loader.makeEmptyData();
  Loader.loadData(data, () => Plotter.plotPlaces(data, DEFAULT_PLACES));
  UI.wireUI(data, DEFAULT_PLACES);
}

window.addEventListener('load', init, false);
