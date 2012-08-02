var PageMod = require('page-mod').PageMod;
var Widget = require('widget').Widget;
var tabs = require('tabs');
var addontab = require('addon-page');
var data = require('self').data;
var places = require('places.js');
var {Cu} = require('chrome');
Cu.import('resource://gre/modules/Services.jsm', this);
Cu.import('resource:///modules/PageThumbs.jsm', this);

var counter = 0;

exports.main = function() {

  var url = data.url('index.html');
  var widget = new Widget({
    id: 'cleer-bookmarks',
    label: 'Bookmarks',
    contentURL: data.url('icon.png'),
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
      queryFolder({ id: places.bookmarks.menu,    title: 'Bookmarks Menu'    }, worker);
      queryFolder({ id: places.bookmarks.toolbar, title: 'Bookmarks Toolbar' }, worker);
      queryFolder({ id: places.bookmarks.unfiled, title: 'Unsorted Bookmarks' }, worker);

      showCurrentTabs(worker);
    }
  });
};

function queryFolder(folder, worker) {
  counter++;
  worker.port.emit('folder', folder);
  places.bookmarks.search({
    bookmarked: {
      folder: folder.id
    },
    onResult: function(result) {
      if (result.type == 'folder' && !result.location) {
        var folder = {
          id: result._itemId,
          title: result.title
        };
        queryFolder(folder, worker);
      }
      else if (result.type == 'bookmark' && result.location.indexOf('javascript') != 0) {
        var file = PageThumbsStorage.getFileForURL(result.location);
        var uri = Services.io.newFileURI(file);
        var bookmark = {
          folder: result.folder,
          location: result.location,
          title: result.title,
          tags: result.tags,
          icon: result.icon,
          thumb: uri.spec,
          added: result.dateAdded,
          visited: result.time,
          visits: result.accessCount
        };
        worker.port.emit('bookmark', bookmark);
      }
    },
    onComplete: function() {
      counter--;
      if (counter == 0) {
        worker.port.emit('complete');
      }
    }
  });
}

function showCurrentTabs(worker) {
  worker.port.emit('folder', {title: 'Current Tabs', id: 999});
  for each (var tab in tabs) {
    if (!tab.title) continue;
    var page = {
      folder: 999,
      location: tab.url,
      title: tab.title,
      tags: [],
      icon: tab.favicon,
      thumb: tab.getThumbnail(),
    }
    worker.port.emit('bookmark', page);
  }
}
