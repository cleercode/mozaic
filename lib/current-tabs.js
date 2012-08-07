var tabs = require('tabs');

exports.get = function(worker) {
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
  worker.port.emit('complete');
}
