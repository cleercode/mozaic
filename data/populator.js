var prefix = "http://www.google.com/s2/favicons?domain=";

self.port.on('folder', function(folder) {
  var html = '<div class="group" id="' + folder.id + '"><div class="name"><h1>' + folder.title + '</h1></div><ul class="bookmarks"></ul></div>';
  var el = $(html);
  $('.groups').append(el);
});

self.port.on('bookmark', function(bookmark) {
  var html = '<li><a href="' + bookmark.location + '"><img src="thumbs/unsorted/dog.png" alt="" class="thumb" /><span class="title">' + bookmark.title + '</span><span class="url">' + bookmark.location + '</span><span class="edit ss-icon">Pencil</span></a></li>'
  var el = $(html);
  if (bookmark.icon) {
    el.css({ background: "url(" + bookmark.icon + ") 10px center no-repeat" });
  }

  $('#' + bookmark.folder + ' .bookmarks').append(el);
});
