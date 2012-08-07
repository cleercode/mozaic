var PageMod = require('page-mod').PageMod;
var Widget = require('widget').Widget;
var tabs = require('tabs');
var addontab = require('addon-page');
var data = require('self').data;

var bookmarks = require('bookmarks');
var currentTabs = require('current-tabs');
var history = require('history');


exports.main = function() {

  var url = data.url('index.html');
  var widget = new Widget({
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
  
  var pageMod = PageMod({
    include: [url],
    contentScriptWhen: 'end',
    contentScriptFile: [data.url('jquery-1.7.2.min.js'),
                        data.url('mousetrap.min.js'),
                        data.url('script.js'),
                        data.url('populator.js')],
    onAttach: function(worker) {
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
