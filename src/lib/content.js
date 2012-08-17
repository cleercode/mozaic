exports.Content = {
  Bookmarks: require('bookmarks').Bookmarks,
  Tabs: require('current-tabs').Tabs,
  History: require('history').History
}

exports.Content.default = exports.Content.Bookmarks;