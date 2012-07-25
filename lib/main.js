var PageMod = require("page-mod").PageMod;
var Widget = require("widget").Widget;
var tabs = require('tabs');
var windows = require("windows").browserWindows;
var addontab = require("addon-page");
var data = require("self").data;
var places = require("places.js");

exports.main = function() {

    var url = data.url("index.html");
    var widget = new Widget({
        // Mandatory string used to identify your widget in order to
        id: "cleer-bookmarks",
        label: "Bookmarks",
        contentURL: data.url("icon.png"),
        onClick: function(event) {
            if (tabs.activeTab.url == url) {
                tabs.activeTab.close();
            }
            else {
                tabs.open(url);
            }
        }
    });
    
    var aboutHomeSearch = PageMod({
        include: [url],
        contentScriptWhen: 'ready',
        onAttach: function(worker) {
            var folders = [];
            var search = places.bookmarks.search({
                onResult: function(result) {
                    if (result.type == "folder") {
                        if (!folders[result.folder]) folders[result.folder] = { bookmarks: [] };
                        folders[result.folder].title = result.title || result.location || result.folder;
                    }
                    else if (result.type == "bookmark") {
                        var bookmark = {
                            folder: result.folder,
                            location: result.location,
                            title: result.title,
                            icon: result.icon
                        };
                        if (!folders[result.folder]) folders[result.folder] = { bookmarks: [] };
                        folders[result.folder].bookmarks[result.position] = bookmark;
                    }
                },
                onComplete: function() {
                    console.log(JSON.stringify(folders));
                }
            });
        }
    });
};
