var prefix = "http://www.google.com/s2/favicons?domain=";

self.port.on('folder', function(folder) {
  var html = '<div class="group" id="' + folder.id + '"><div class="name"><h1>' + folder.title + '</h1></div><ul class="bookmarks"></ul></div>';
  var el = $(html);
  $('.groups').append(el);
});

self.port.on('bookmark', function(bookmark) {
  var html = '<li><a href="' + bookmark.location + '" target="_blank"><img src="thumbs/unsorted/dog.png" alt="" class="thumb" /><span class="icon"></span><span class="title">' + bookmark.title + '</span><span class="url">' + bookmark.location + '</span><span class="edit ss-icon">Pencil</span></a></li>'
  var el = $(html);
  if (bookmark.icon) {
    el.find('.icon').css({ backgroundImage: "url(" + bookmark.icon + ")" });
  }
  el.data('bookmark', bookmark);

  $('#' + bookmark.folder + ' .bookmarks').append(el);
});

self.port.on('image', function(url) {
  var html = '<img src="' + url + '" />'
  var el = $(html);
  $('body').append(el);
});

self.port.on('complete', function() {
  bindBookmarks();
});
