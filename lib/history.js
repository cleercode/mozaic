var places = require('places.js');
var {Cu} = require('chrome');
Cu.import('resource://gre/modules/Services.jsm', this);
Cu.import('resource:///modules/PageThumbs.jsm', this);

function queryFolder(folder, worker) {
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
      worker.port.emit('complete');
    }
  });
}

exports.get = function(worker) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  queryFolder({ id: 1000, title: 'Today', begin: today }, worker);
}
