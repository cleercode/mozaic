# Mozaic
Functional prototype for a different take on Firefox's Places (bookmarks and history) browsing features, implemented as a Firefox add-on. Also displays [tab groups](http://support.mozilla.org/en-US/kb/tab-groups-organize-tabs), like Firefox's Panorama feature.

The philosophy behind Mozaic is to decouple content and view. There are three types of content: bookmarks, current tabs, and history, which could possible be extended (perhaps as modules) in the future. There are two types of views: list and thumbnail grid. Each type of content is viewable with each type of view.

Mozaic could be a solution or at least a springboard for development for features such as a visual bookmarks, a history timeline, bookmark syncing with services, bookmarking of specific media content, or a redesigned Firefox Panorama.

## Status
Mozaic is currently in development. In terms of design, I'm looking for feedback on both the concept and the visual/interaction details. In terms of programming, I'm looking for help with [bugs](https://github.com/cleercode/mozaic/issues?state=open).

Mozaic was intended as a prototype and could either be implemented into core Firefox (and rewritten) or continue to be developed as an add-on.

## Compatibility
Mozaic's bookmarks and history display features use the `PageThumbsStorage` API available only in Firefox 16+.

Only the visual design for Mac OS X is implemented at this point.

![Mozaic](https://raw.github.com/cleercode/mozaic/master/screenshot.png)