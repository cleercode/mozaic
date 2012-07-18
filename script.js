function siteIcons() {
  var prefix = "http://www.google.com/s2/favicons?domain=";

  $('.groups li a').each(function(index, el) {
    var dest = $(el).attr('href');
    if (dest.match("^https?://")) {
      var domain = dest.split("/");
      $(el).css({ background: "url(" + prefix + domain[2] + ") 10px center no-repeat" });
    }  
  });
}

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
      $('.groups').scrollTop($next.offset().top - headerHeight);
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
  var visible = true;
  $('#info-toggle').click(function() {
    $(this).toggleClass('toggled');
    if (visible) {
      $('body').addClass('info-hidden');
    }
    else {
      $('body').removeClass('info-hidden');
    }
    visible = !visible;
  });
}

function viewToggle() {
  $('#list').click(function() {
    $(this).addClass('toggled');
    $('#grid').removeClass('toggled');
    $('body').removeClass('grid').addClass('list');
  });
  $('#grid').click(function() {
    $(this).addClass('toggled');
    $('#list').removeClass('toggled');
    $('body').removeClass('list').addClass('grid');
  });
}

function hoverInfo() {
  $('.groups li').hover(function() {
    var title = $(this).find('.title').text();
    var url = $(this).find('.url').text();
    var folder = $(this).parent().parent().find('.name h1').text();
    var $info = $('.info');
    $info.find('.title').text(title);
    $info.find('.url a').attr('href', url).text(url);
    $info.find('.folder').text(folder);
  });
}

$(function() {
  siteIcons();
  stickyScroll();
  keyboardControl();
  infoToggle();
  viewToggle();
  hoverInfo();
});