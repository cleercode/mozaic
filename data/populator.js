self.port.on('group', function(group) {
  var html = '<div class="group" id="' + group.id + '"><div class="name"><h1>' + group.title + '</h1></div><ul class="items"></ul></div>';
  var el = $(html);
  $('.groups').append(el);
});

self.port.on('item', function(item) {
  var html = '<li><a href="' + item.location + '" target="_blank" style="background-image: url(' + item.thumb + ')"><span class="icon"></span><span class="title">' + item.title + '</span><span class="url">' + item.location + '</span><span class="edit"><span class="ui-icon">Edit</span></span></a></li>'
  var el = $(html);
  if (item.icon) {
    el.find('.icon').css({ backgroundImage: "url(" + item.icon + ")" });
  }
  el.data('item', item);

  $('#' + item.folder + ' .items').append(el);
});

self.port.on('complete', function() {
  bindItems();
});

function clearContent() {
  $('.groups').empty();
}

function contentToggle() {
  $('#bookmarks').click(function() {
    clearContent();
    $('ul.nav li').removeClass('active');
    document.title = 'Bookmarks';
    $(this).addClass('active');
    self.port.emit('bookmarks');
  });
  $('#tabs').click(function() {
    clearContent();
    $('ul.nav li').removeClass('active');
    document.title = 'Current Tabs';
    $(this).addClass('active');
    self.port.emit('tabs');
  });
  $('#history').click(function() {
    clearContent();
    $('ul.nav li').removeClass('active');
    document.title = 'History';
    $(this).addClass('active');
    self.port.emit('history');
  });
}

$(function() {
  contentToggle();
});
