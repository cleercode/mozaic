const PageMod = require('page-mod').PageMod;
const Widget = require('widget').Widget;
const ToolbarButton = require('toolbarbutton').ToolbarButton;
const MenuItem = require('menuitems').Menuitem;
const tabs = require('tabs');
const addontab = require('addon-page');
const runtime = require('runtime');
const data = require('self').data;
const Content = require('content').Content;

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

      let contentActivated = false;
      Object.keys(Content).forEach(function(name) {
        let module = Content[name];
        worker.port.on(module.id, function() { module.get(worker)});
        if (module.id == content) { 
          module.get(worker);
          contentActivated = true;
        }
      });

      if (!contentActivated) {
        Content.default.get(worker);
      }
    }
  });
}

exports.main = function(options) {

  let tbb = ToolbarButton({
    id: 'mozaic-tbb',
    label: 'Mozaic',
    image: data.url('img/icon.png'),
    onCommand: open
  });

  // if (options.loadReason == 'install') {
    tbb.moveTo({
      toolbarID: 'nav-bar',
      forceMove: true
    });
  // }

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
