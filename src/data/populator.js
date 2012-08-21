function renderGroup(group) {
  var html = '<div class="group" id="' + group.id + '"><div class="name"><h1>' + group.title + '</h1><div class="placeholder">' + group.title + '</div></div><ul class="items"></ul></div>';
  var el = $(html);
  $('#groups').append(el);
}

function renderItem(item) {
  var html = '<li><a href="' + item.location + '" target="_blank" style="background-image: url(' + item.thumb + ')"><span class="icon"></span><span class="title">' + item.title + '</span><span class="url">' + item.location + '</span><span class="edit"><span class="ui-icon">Edit</span></span></a></li>'
  var el = $(html);
  if (item.icon) {
    el.find('.icon').css({ backgroundImage: "url(" + item.icon + ")" });
  }
  el.data('item', item);

  $('#' + item.group + ' .items').append(el);
}

self.port.on('group', renderGroup);
self.port.on('item', renderItem);
self.port.on('complete', bindItems);
