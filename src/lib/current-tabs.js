const {Cu} = require('chrome');
Cu.import('resource://gre/modules/Services.jsm', this);
Cu.import('resource:///modules/PageThumbs.jsm', this);

exports.get = function(worker) {
  var browserWindow = Services.wm.getMostRecentWindow('navigator:browser');
  var tabViewWindow = browserWindow.TabView.getContentWindow();
  if (!tabViewWindow) return;
  var groups = tabViewWindow.GroupItems.groupItems;
  groups.forEach(function(group) {
    var pages = group.getChildren();
    var group = {
      id: group.id,
      title: group.getTitle()
    };
    worker.port.emit('group', group);
    pages.forEach(function(page) {
      let {title, url} = page.getTabState();
      var file = PageThumbsStorage.getFileForURL(url);
      var uri = Services.io.newFileURI(file);
      worker.port.emit('item', {
        group: group.id,
        location: url,
        title: title || url,
        thumb: uri.spec
      });
    });
    worker.port.emit('complete');
  });
}
