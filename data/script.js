function stickyScroll() {
  $('.group h1').each(function(index, el) {
    var $el = $(el);
    var elOffset = $el.offset().top - $('.groups').scrollTop();
    var elHeight = $el.height();

    // Container must have position: relative;
    var $container = $($el.parent());
    var containerOffset = $container.offset().top; - $('.groups').scrollTop()
    var containerHeight = $container.height();

    var padding = 10;
    var pageOffset = 57;

    $('.groups').scroll(function() {

      var top = $('.groups').scrollTop();
      var position = top + pageOffset + padding;

      $el.removeClass();

      // Below container
      if (position > (containerOffset + containerHeight - elHeight)) {
        $el.addClass('bottom');
      }
      // Within container
      else if (position >= elOffset) {
        $el.addClass('sticky');
      }
      // Before container
      else if (position < elOffset) {
      }
    });
  });
}

function keyboardControl() {
  var index = -1;
  var headerHeight = 57;
  Mousetrap.bind('down', function() {
    if (!$('ul.bookmarks li')[index + 1]) return;

    var $active = $('ul.bookmarks li.active');
    var $next = $($('ul.bookmarks li')[++index]);

    $active.removeClass('active');
    $next.addClass('active');

    var nextTop = $next.offset().top;
    var docBottom = $('.groups').scrollTop() + $(window).height();
    if (nextTop > docBottom) {
      $('.groups').scrollTop($next.offset().top - $(window).height() + headerHeight);
    }

    return false;
  });
  Mousetrap.bind('up', function() {
    if (!$('ul.bookmarks li')[index - 1]) return;

    var $active = $('ul.bookmarks li.active');
    var $next = $($('ul.bookmarks li')[--index]);

    $active.removeClass('active');
    $next.addClass('active');

    var nextTop = $next.offset().top;
    var docTop = $('.groups').scrollTop() + headerHeight;

    if (nextTop < docTop) {
      // $('.groups').scrollTop($next.offset().top - headerHeight);
    }
    return false;
  });
  Mousetrap.bind('enter', function() {
    var $active = $('ul.bookmarks li.active');
    var link = $active.find('a').attr('href');
    window.open(link);
  });
}

function infoToggle() {
  var visible = false;
  $('#info-toggle').click(function() {
    if (visible) $('body').removeClass('info-visible');
    else $('body').addClass('info-visible');
    visible = !visible;
  });
}

function viewToggle() {
  $('#list').click(function() {
    $('body').removeClass('grid').addClass('list');
  });
  $('#grid').click(function() {
    $('body').removeClass('list').addClass('grid');
  });
}

function formatDate(dateString) {
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var d = new Date(dateString);
  var month = months[d.getMonth()];
  var date = d.getDate();
  var year = d.getFullYear();
  if (year < 1970) return 'Never';
  return month + ' ' + date + ', ' + year;
}

function hoverInfo() {
  $('.groups li').hover(function() {
    var $info = $('#info');
    if ($info.hasClass('editing')) return;

    var bookmark = $(this).data('bookmark');
    var folder = $(this).parent().parent().find('.name h1').text();
    $info.find('.thumb').attr('src', bookmark.thumb);
    $info.find('.title').text(bookmark.title);
    $info.find('.url a').attr('href', bookmark.location).text(bookmark.location);
    $info.find('.folder').text(folder);
    $info.find('.added').text(formatDate(bookmark.added));
    $info.find('.visited').text(formatDate(bookmark.visited));
    $info.find('.visits').text(bookmark.visits);
    $info.find('.tags').empty();
    bookmark.tags.forEach(function(tag) {
      var html = '<li>' + tag + '</li>';
      var el = $(html);
      el.appendTo($info.find('.tags'));
    });
  });
}

function editInfo() {
  $('.edit').click(function(e) {
    $('body').addClass('info-visible');
    var $info = $('#info');
    var title = $(this).parent().find('.title').text();
    var url = $(this).parent().find('.url').text();
    var folder = $(this).parent().parent().parent().parent().find('.name h1').text();
    $info.addClass('editing');
    $info.find('.title').text(title);
    $info.find('.url a').attr('href', url).text(url);
    $info.find('.folder').text(folder);
    $info.find('#edit-title').val(title);
    $info.find('#edit-url').val(url);
    e.preventDefault();
    e.stopPropagation();
    return false;
  });
  $('.done').click(function() {
    $('#info').removeClass('editing');
  })
}

function bindBookmarks() {
  stickyScroll();
  // keyboardControl();
  hoverInfo();
  editInfo();
}

$(function() {
  infoToggle();
  viewToggle();
});