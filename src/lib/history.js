const places = require('places');
const moment = require('moment.min');
const {Cu} = require('chrome');
Cu.import('resource://gre/modules/Services.jsm', this);
Cu.import('resource:///modules/PageThumbs.jsm', this);

exports.History = {
  name: 'History',
  id: 'history',
  get: get
}

function queryFolder(folder, worker) {
  worker.port.emit('group', folder);
  let pages = [];
  places.history.search({
    visited: {
      begin: folder.begin,
      end: folder.end
    },
    onResult: function(result) {
      if (result.type == 'page' && result.location.indexOf('javascript') != 0) {
        let file = PageThumbsStorage.getFileForURL(result.location);
        let uri = Services.io.newFileURI(file);
        let page = {
          group: folder.id,
          location: result.location,
          title: result.title || result.location,
          icon: result.icon,
          thumb: uri.spec,
          visited: moment(result.time).calendar(),
          visitedDate: result.time,
          visits: result.accessCount
        };
        pages.push(page);
      }
    },
    onComplete: function() {
      pages.sort(function(a, b) {
        var aDate = new Date(a.visitedDate);
        var bDate = new Date(b.visitedDate);
        return (bDate.getTime() - aDate.getTime());
      });
      pages.forEach(function(page) {
        worker.port.emit('item', page);
      });
      worker.port.emit('complete');
    }
  });
}

function get(worker) {
  let today = moment().startOf('day').toDate();
  let yesterday = moment().startOf('day').subtract('days', 1).toDate();
  let yesterdayEnd = moment().endOf('day').subtract('days', 1).toDate();
  queryFolder({ id: 'today', title: 'Today', begin: today }, worker);
  queryFolder({ id: 'yesterday', title: 'Yesterday', begin: yesterday, end: yesterdayEnd }, worker);
}
