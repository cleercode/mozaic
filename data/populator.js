self.port.on('folder', function(folder) {
  var html = '<div class="group" id="' + folder.id + '"><div class="name"><h1>' + folder.title + '</h1></div><ul class="bookmarks"></ul></div>';
  var el = $(html);
  $('.groups').append(el);
});

self.port.on('bookmark', function(bookmark) {
  var html = '<li><a href="' + bookmark.location + '" target="_blank" style="background-image: url(' + bookmark.thumb + ')"><span class="icon"></span><span class="title">' + bookmark.title + '</span><span class="url">' + bookmark.location + '</span><span class="edit"><span class="ui-icon">Edit</span></span></a></li>'
  var el = $(html);
  if (bookmark.icon) {
    el.find('.icon').css({ backgroundImage: "url(" + bookmark.icon + ")" });
  }
  el.data('bookmark', bookmark);

  $('#' + bookmark.folder + ' .bookmarks').append(el);
});

self.port.on('complete', function() {
  bindBookmarks();
});

function clearContent() {
  $('.groups').empty();
}

function contentToggle() {
  $('#bookmarks').click(function() {
    clearContent();
    $('ul.nav li').removeClass('active');
    $(this).addClass('active');
    self.port.emit('bookmarks');
  });
  $('#tabs').click(function() {
    clearContent();
    $('ul.nav li').removeClass('active');
    $(this).addClass('active');
    self.port.emit('tabs');
  });
  $('#history').click(function() {
    clearContent();
    $('ul.nav li').removeClass('active');
    $(this).addClass('active');
    self.port.emit('history');
  });
}

$(function() {
  contentToggle();
});
