const tabs = require('tabs');

exports.get = function(worker) {
  var group = { title: 'Current Tabs', id: 'current-tabs' };
  worker.port.emit('group', group);
  for each (var tab in tabs) {
    if (!tab.title) continue;
    var page = {
      folder: group.id,
      location: tab.url,
      title: tab.title,
      icon: tab.favicon,
      thumb: tab.getThumbnail()
    };
    worker.port.emit('item', page);
  }
  worker.port.emit('complete');
}
