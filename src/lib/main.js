const PageMod = require('page-mod').PageMod;
const Widget = require('widget').Widget;
const tabs = require('tabs');
const addontab = require('addon-page');
const runtime = require('runtime');
const data = require('self').data;

const bookmarks = require('bookmarks');
const currentTabs = require('current-tabs');
const history = require('history');

function detectOS() {
  switch (runtime.OS) {
    case 'WINNT':  return 'windows';
    case 'Darwin': return 'mac';
    default:       return 'linux';
  }
}

exports.main = function() {
  let url = data.url('index.html');
  
  Widget({
    id: 'mozaic',
    label: 'Mozaic',
    contentURL: data.url('img/icon.png'),
    onClick: function(event) {
      if (tabs.activeTab.url == url) {
        tabs.activeTab.close();
      }
      else {
        tabs.open(url);
      }
    }
  });
  
  PageMod({
    include: [url],
    contentScriptWhen: 'end',
    contentScriptFile: [data.url('jquery.min.js'),
                        data.url('stylist.js'),
                        data.url('script.js'),
                        data.url('populator.js')],
    onAttach: function(worker) {
      worker.port.emit('os', detectOS());

      bookmarks.get(worker);
      worker.port.on('bookmarks', function() {
        bookmarks.get(worker);
      });
      worker.port.on('tabs', function() {
        currentTabs.get(worker);
      });
      worker.port.on('history', function() {
        history.get(worker);
      });
    }
  });
};
