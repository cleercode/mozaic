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
      showBookmarks(worker);
      worker.port.on('bookmarks', function() {
        showBookmarks(worker);
      });
      worker.port.on('tabs', function() {
        showCurrentTabs(worker);
      });
      worker.port.on('history', function() {
        showHistory(worker);
      });
    }
  });
};

function queryFolderBookmarks(folder, worker) {
  counter++;
  worker.port.emit('group', folder);
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
        queryFolderBookmarks(folder, worker);
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
        worker.port.emit('item', bookmark);
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

function showBookmarks(worker) {
  queryFolderBookmarks({ id: places.bookmarks.menu,    title: 'Bookmarks Menu'    }, worker);
  queryFolderBookmarks({ id: places.bookmarks.toolbar, title: 'Bookmarks Toolbar' }, worker);
  queryFolderBookmarks({ id: places.bookmarks.unfiled, title: 'Unsorted Bookmarks' }, worker);
}

function showCurrentTabs(worker) {
  worker.port.emit('group', { title: 'Current Tabs', id: 999 });
  for each (var tab in tabs) {
    if (!tab.title) continue;
    var page = {
      folder: 999,
      location: tab.url,
      title: tab.title,
      tags: [],
      icon: tab.favicon,
      thumb: tab.getThumbnail()
    };
    worker.port.emit('item', page);
  }
}

function queryFolderHistory(folder, worker) {
  worker.port.emit('group', folder);
  places.history.search({
    visited: {
      begin: folder.begin
    },
    onResult: function(result) {
      if (result.type == 'page' && result.location.indexOf('javascript') != 0) {
        var file = PageThumbsStorage.getFileForURL(result.location);
        var uri = Services.io.newFileURI(file);
        var page = {
          folder: 1000,
          location: result.location,
          title: result.title,
          icon: result.icon,
          thumb: uri.spec,
          visited: result.time,
          visits: result.accessCount
        };
        worker.port.emit('item', page);
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

function showHistory(worker) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  queryFolderHistory({ id: 1000, title: 'Today', begin: today }, worker);
}
