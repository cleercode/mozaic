var places = require('places');
var moment = require('moment.min');
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
          folder: folder.id,
          location: result.location,
          title: result.title,
          icon: result.icon,
          thumb: uri.spec,
          visited: moment(result.time).calendar(),
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
  var today = moment().startOf('day').toDate();
  var yesterday = moment().startOf('day').subtract('days', 1).toDate();
  var yesterdayEnd = moment().endOf('day').subtract('days', 1).toDate();
  queryFolder({ id: 'today', title: 'Today', begin: today }, worker);
  queryFolder({ id: 'yesterday', title: 'Yesterday', begin: yesterday, end: yesterdayEnd }, worker);
}
