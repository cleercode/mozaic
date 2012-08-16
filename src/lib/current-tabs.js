const {Cu} = require('chrome');
Cu.import('resource://gre/modules/Services.jsm', this);
Cu.import('resource:///modules/PageThumbs.jsm', this);

exports.get = function(worker) {
  let TabView = Services.wm.getMostRecentWindow('navigator:browser').TabView;
  TabView._initFrame(function() {
    let tabViewWindow = TabView.getContentWindow();
    if (!tabViewWindow) return;
    let groups = tabViewWindow.GroupItems.groupItems;
    groups.forEach(function(group) {
      let pages = group.getChildren();
      let group = {
        id: group.id,
        title: group.getTitle()
      };
      worker.port.emit('group', group);
      pages.forEach(function(page) {
        let {title, url} = page.getTabState();
        let file = PageThumbsStorage.getFileForURL(url);
        let uri = Services.io.newFileURI(file);
        worker.port.emit('item', {
          group: group.id,
          location: url,
          title: title || url,
          thumb: uri.spec
        });
      });
      worker.port.emit('complete');
    });
   });
}
