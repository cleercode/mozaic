const PageMod = require('page-mod').PageMod;
const Widget = require('widget').Widget;
const ToolbarButton = require('toolbarbutton').ToolbarButton;
const MenuItem = require('menuitems').Menuitem;
const tabs = require('tabs');
const addontab = require('addon-page');
const runtime = require('runtime');
const data = require('self').data;

const bookmarks = require('bookmarks');
const currentTabs = require('current-tabs');
const history = require('history');

let url = data.url('index.html');

function detectOS() {
  switch (runtime.OS) {
    case 'WINNT':  return 'windows';
    case 'Darwin': return 'mac';
    default:       return 'linux';
  }
}

function open(content) {
  for each (let tab in tabs) {
    if (tab.url == url) {
      tab.activate();
      return;
    }
  }
  tabs.open({
    url: url,
    onReady: function(tab) {
      var worker = tab.attach({
        contentScriptFile: [data.url('jquery.min.js'),
                            data.url('stylist.js'),
                            data.url('script.js'),
                            data.url('populator.js')],
      });
      worker.port.emit('os', detectOS());

      worker.port.on('bookmarks', function() { bookmarks.get(worker); });
      worker.port.on('tabs', function() { currentTabs.get(worker); });
      worker.port.on('history', function() { history.get(worker); });

      switch(content) {
        case 'bookmarks': bookmarks.get(worker);   break;
        case 'tabs':      currentTabs.get(worker); break;
        case 'history':   history.get(worker);     break;
        default:          bookmarks.get(worker);   break;
      }
    }
  });
}

exports.main = function(options) {

  let tbb = ToolbarButton({
    id: 'mozaic',
    label: 'Mozaic',
    image: data.url('img/icon.png'),
    onCommand: open
  });

  if (options.loadReason == 'install') {
    tbb.moveTo({
      toolbarID: 'nav-bar',
      forceMove: true
    });
  }

  MenuItem({
    id: 'mozaic-tabs',
    menuid: 'menu_viewPopup',
    label: 'Show All Tabs (Mozaic)',
    insertbefore: 'documentDirection-separator',
    onCommand: function() { open('tabs') }
  });

  MenuItem({
    id: 'mozaic-history',
    menuid: 'goPopup',
    label: 'Show All History (Mozaic)',
    insertbefore: 'showAllHistorySeparator',
    onCommand: function() { open('history') }
  });

  MenuItem({
    id: 'mozaic-bookmarks',
    menuid: 'bookmarksMenuPopup',
    label: 'Show All Bookmarks (Mozaic)',
    insertbefore: 'organizeBookmarksSeparator',
    onCommand: function() { open('bookmarks') }
  });
};
