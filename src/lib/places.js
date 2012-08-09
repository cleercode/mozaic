/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim:set ts=2 sw=2 sts=2 et: */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is the Mozilla Foundation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Marco Bonardo <mak77@bonardo.net> (Original Author)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

const {Cc, Ci, Cr, Cu} = require("chrome");

// PlacesQuery is currently included at the bottom of this file,
// to ease distribution by not tying Jetpack's usage of it to a
// particular Firefox version.
//Cu.import("resource://gre/modules/PlacesQuery.jsm", this);
Cu.import("resource://gre/modules/PlacesUtils.jsm", this);

const apiUtils = require("api-utils");
const collection = require("collection");
const errors = require("errors");


// Main search function.
exports.search = (new PlacesHandler()).search;


// Shortcut helper to search visited places.
exports.history = new PlacesHandler({ visited: {} });
// Shortcut helper to search bookmarked places.
exports.bookmarks = new PlacesHandler({ bookmarked: {} });


// Add bookmark root folder shortcuts.
exports.bookmarks.unfiled = PlacesUtils.unfiledBookmarksFolderId;
exports.bookmarks.toolbar = PlacesUtils.toolbarFolderId;
exports.bookmarks.menu = PlacesUtils.bookmarksMenuFolderId;


// Method for creating a bookmark. Can take an options object or an array of
// options objects to create bookmarks in batch.
exports.bookmarks.create = function PF_create(aOptions) {
  let options = validateBookmarkInfo(aOptions, true);

  let bs = PlacesUtils.bookmarks;

  // Create the bookmark item.
  try {
    switch(options.type) {
      case "bookmark":
        options._itemId =
          bs.insertBookmark(options.folder,
                            PlacesUtils._uri(options.location),
                            options.position,
                            options.title);

          if (options.tags.length > 0) {
            PlacesUtils.tagging.tagURI(PlacesUtils._uri(options.location),
                                       options.tags);
          }
        break;
      case "folder":
        options._itemId = 
          PlacesUtils.bookmarks.createFolder(options.folder,
                                             options.title,
                                             options.position);
        break;
      case "separator":
        options._itemId =
          PlacesUtils.bookmarks.insertSeparator(options.folder,
                                                options.position);
    }

    /*
    if (options.annotations) {
      PlacesUtils.setAnnotationsForItem(options._itemId,
                                        options.annotations);
    }
    */
  }
  catch (err) {
    console.exception("Failed to create new bookmark. " + err);
  }
  
  if (options.onCreate) {
    safeCallback(undefined, options.onCreate, options);
  }
};


/**
 * Wrapper for safely calling user-callback functions.
 * TODO: file a bug for getting this into api-utils.
 */
function safeCallback(aArgument, aCallbackFunc, aCallbackScope) {
  if (aCallbackFunc) {
    require("timer").setTimeout(function() {
      try {
        if (aCallbackScope)
          aCallbackFunc.call(aCallbackScope, aArgument);
        else
          aCallbackFunc.call(exports, aArgument); // safe "this".
      }
      catch (err) {
        console.exception(err);
      }
    }, 0);
  }
}


/**
 * This is the basic exposed object for searching.
 * The caller will get access to it via an alias such as "bookmarks"
 * or "history" and call it's .search() method.
 */
function PlacesHandler(helperOptions) {
  this.search = function PH_createNewFilter(userOptions) {
    // Merge helper configuration to user configurations.
    let options = validateAndMergeConfigs(userOptions, helperOptions);
    // Create and return a PlacesSearch.
    return new PlacesSearch(options);
  }
}
PlacesHandler.prototype = {}


/**
 * apiUtils method does not support "date" type.
 */
function checkType(entry, type) {
  switch (type) {
    case "undefined":
      return entry === undefined;
    case "null":
      return entry === null;
    case "date":
      return Object.prototype.toString.call(entry) === "[object Date]";
    case "array":
      return Object.prototype.toString.call(entry) === "[object Array]";
    default:
      return typeof(entry) == type;
  }
}

/**
 * apiUtils method does not support things like "array of optional string" or
 * "array of positive optional number".
 */
function checkArrayElementsType(array, type, allowOptionalElement) {
  let arrayIsValid = true;
  array.every(function(elm) {
    if (allowOptionalElement && (elm === undefined || elm === null))
      return true;
    return arrayIsValid = checkType(elm, type);
  });
  return arrayIsValid;
}

/**
 * Take caller-supplied options and merge them with a set of default
 * options.
 */
function validateAndMergeConfigs(userOptions, additionalOptions) {
  userOptions = apiUtils.validateOptions(userOptions, {
    phrase: {
      map: function(v) v.toString(),
      is: ["undefined", "string"],
      ok: function(v) !v || v.length > 0,
      msg: "Provided phrase must be a non-empty string."
    },
    host: {
      map: function(v) v.toString(),
      is: ["undefined", "string"],
      ok: function(v) !v || v.length > 0,
      msg: "Provided host must be a non-empty string."
    },
    uri: {
      map: function(v) v.toString(),
      is: ["undefined", "string"],
      ok: function(v) !v || v.length > 0,
      msg: "Provided uri must be a non empty string."
    },
    annotated: {
      is: ["undefined", "array"],
      ok: function (v) !v || v.length > 0,
      msg: "Required annotations must be a valid array of strings."
    },
    bookmarked: apiUtils.validateOptions(userOptions.bookmarked, {
      is: ["undefined", "boolean"],
      ok: function (v) !v || apiUtils.validateOptions(userOptions.bookmarked, {
        tags: {
          is: ["undefined", "array"],
          ok: function(v) !v || (v.length > 0 && checkArrayElementsType(v, "string")),
          msg: "Tags must be a valid array of strings."
        },
        folder: {
          is: ["undefined", "number"],
          ok: function(v) !v || v > 0,
          msg: "Folder id must be a positive number."
        },
        position: {
          is: ["undefined", "number"],
          ok: function(v) !v || v > 0,
          msg: "Position must be a positive number."
        },
        id: {
          is: ["undefined", "number"],
          ok: function(v) !v || v > 0,
          msg: "Bookmark id must be a positive number."
        },
        created: {
          is: ["undefined", "array"],
          ok: function(v) !v || (v.length > 0 && checkArrayElementsType(v, "date", true)),
          msg: "Bookmark creation times must be an array of two optional Date objects."
        },
        modified: {
          is: ["undefined", "array"],
          ok: function(v) !v || (v.length > 0 && checkArrayElementsType(v, "date", true)),
          msg: "Bookmark modification times must be an array of two optional Date objects."
        }
      }),
      msg: "Bookmarked configuration is incorrect."
    }),
    visited: apiUtils.validateOptions(userOptions.visited, {
      is: ["undefined", "object", "boolean"],
      ok: function (v) !v || apiUtils.validateOptions(userOptions.visited, {
        count: {
          is: ["undefined", "array"],
          ok: function(v) !v || (v.length > 0 && checkArrayElementsType(v, "number", true)),
          msg: "Visit count must be an array of two optional numbers."
        },
        transitions: {
          is: ["undefined", "array"],
          ok: function(v) !v || (v.length > 0 && checkArrayElementsType(v, "number", true)),
          msg: "Transitions must be an array of valid transition values."
        },
        when: {
          is: ["undefined", "array"],
          ok: function(v) !v || (v.length > 0 && checkArrayElementsType(v, "date", true)),
          msg: "Visit times must be an array of two optional Date objects."
        },
        includeAllVisits: {
          is: ["undefined", "boolean"]
        }
      }),
      msg: "Visited configuration is incorrect."
    }),
    sortBy: {
      is: ["undefined", "string"],
      ok: function(v) !v || ["none", "title", "time", "uri", "accessCount",
                             "lastModified", "frecency"].indexOf(v) != -1,
      msg: "Sorting must define an acceptable string for by."
    },
    sortDir: {
      is: ["undefined", "string"],
      ok: function(v) !v || ["asc", "desc"].indexOf(v) != -1,
      msg: "sorting must define an acceptable direction."
    },
    limit: {
      is: ["undefined", "number"],
      ok: function (v) !v || v > 0,
      msg: "Can limit only on positive number of results."
    },
    onResult: {
      is: ["undefined", "function"]
    },
    onComplete: {
      is: ["undefined", "function"]
    },
    onChange: {
      is: ["undefined", "function"]
    },
    onRemove: {
      is: ["undefined", "function"]
    }
  });

  // This will only contain visited or bookmarked properties.
  additionalOptions = apiUtils.validateOptions(additionalOptions, {
    visited: {
      is: ["undefined", "object", "boolean"]
    },
    bookmarked: {
      is: ["undefined", "object", "boolean"]
    },
  });

  // Do the merge.
  for (let prop in additionalOptions) {
    if (!userOptions[prop])
      userOptions[prop] = additionalOptions[prop];
  }

  return userOptions;
}


// Defaults for bookmark properties.
let bookmarkDefaults = {
  title: null,
  type: "bookmark",
  folder: PlacesUtils.unfiledBookmarksFolderId,
  position: PlacesUtils.bookmarks.DEFAULT_INDEX,
  tags: []
};

function validateBookmarkInfo(aOptions, aProvideDefaults) {
  aOptions = apiUtils.validateOptions(aOptions, {
    location: {
      map: function(v) v.toString(),
      is: ["undefined", "string"],
      ok: function(v) !v || v.length > 0,
      msg: "Bookmark location must be a non empty string."
    },
    title: {
      map: function(v) v.toString(),
      is: ["undefined", "string"],
      ok: function(v) !v || v.length > 0
    },
    folder: {
      is: ["undefined", "number"],
      ok: function(v) !v || v > 0,
      msg: "Required containing folder id must be a positive number."
    },
    position: {
      is: ["undefined", "number"],
      ok: function(v) !v || v >= 0,
      msg: "Bookmark position, if present, must be a non-negative number."
    },
    tags: {
      is: ["undefined", "array"],
      ok: function(v) !v || (v.length > 0 && checkArrayElementsType(v, "string")),
      msg: "Tags must be a valid array of strings."
    },
    //annotations: validateAnnotations,
    type: {
      is: ["undefined", "string"],
      ok: function(v) !v || ["bookmark", "separator", "folder"].indexOf(v) != -1,
      msg: "Bookmark type must be one of: bookmark, separator or folder."
    },
    onCreate: {
      is: ["undefined", "function"],
    }
  });

  if (aProvideDefaults && !aOptions.type) {
    function checkProps(aObject, aDefaultObject) {
      for (let prop in aDefaultObject) {
        if (!(prop in aObject))
          aObject[prop] = aDefaultObject[prop];
        else if (typeof(aObject[prop]) == "object")
          checkProps(aObject[prop], aDefaultObject[prop])
      }
    }
    checkProps(aOptions, bookmarkDefaults);

    if (aOptions.type == "bookmark" &&
        !("location" in aOptions) || aOptions.title.length == 0)
      throw new Error("Must provide a valid location for the bookmark.");

  }
  return aOptions;
}

let validateAnnotations = {
  is: ["undefined", "array"],
  ok: function(v) {
    return !v || (v.length > 0 &&
                  checkArrayElementsType(v, "object") &&
                  v.every(function(a) a.name && a.value))
  },
  msg: "Annotations must be a valid array of { name: '', value: '' } objects."
};


/**
 * An object that is returned by .search() and can be used to act on
 * entries.
 */
function PlacesSearch(aOptions) {
  let query = new PlacesQuery(aOptions);

  this.change = function PS_change(aChangeOptions) {
    // Allow editing of bookmark properties if a bookmark query.
    if ("bookmarked" in aOptions) {
      validateBookmarkInfo(aChangeOptions);
    }
    else {
      throw new Error("Editing of history is not supported at this time.");
    }
    /*
    // Otherwise only validate annotation properties
    else {
      aChangeOptions = apiUtils.validateOptions(aChangeOptions, {
        annotations: validateAnnotations
      });
    }
    */

    // When the owning query has finished, pass results to the walker that
    // will make the changes, re-query to update the results, and then call
    // the user's callback.
    function changeCallback() {
      new QueryExecutor(query, null, aOptions.onChange, aOptions);
    }

    let walker = new Walker(changeCallback, {}, function(result) {
      let txns = [];
      if ("bookmarked" in aOptions) {
        let bs = PlacesUtils.bookmarks;
        // location
        if (aChangeOptions.location)
          txns.push(new PlacesEditBookmarkURITransaction(result._itemId,
                                                         PlacesUtils._uri(aChangeOptions.location)));
        // title
        if (aChangeOptions.title) {
          txns.push(new PlacesEditItemTitleTransaction(result._itemId, aChangeOptions.title));
        }
        // folder & position
        if (aChangeOptions.folder != undefined || aChangeOptions.position != undefined) {
          let position = (aChangeOptions.position === undefined) ? -1 : aChangeOptions.position;
          txns.push(new PlacesMoveItemTransaction(result._itemId,
                                                  aChangeOptions.folder || result.folder,
                                                  position));
        }
        // tags
        if (aChangeOptions.tags) {
          let uri = PlacesUtils._uri(aChangeOptions.location || result.location);
          txns.push(new PlacesTagURITransaction(uri, aChangeOptions.tags));
        }
        /*
        // annotations
        if (aChangeOptions.annotations) {
          aChangeOptions.annotations.forEach(function(anno) {
            txns.push(new PlacesSetItemAnnotationTransaction(result._itemId, anno));
          });
        }
        */
      }
      else if (aChangeOptions.annotations) {
        aChangeOptions.annotations.forEach(function(anno) {
          txns.push(new PlacesSetPageAnnotationTransaction(result.location, anno));
        });
      }

      (new PlacesAggregatedTransaction("Changing " + result.title, txns)).doTransaction();
    });
    new QueryExecutor(query, null, walker.run, walker);
  };

  this.remove = function PS_remove() {
    if (!("bookmarked" in aOptions)) {
      throw new Error("Removal of history is not supported at this time.");
    }

    // When the owning query has finished, pass results to the walker that
    // will make the changes, re-query to update the results, and then call
    // the user's callback.
    function removeCallback() {
      new QueryExecutor(query, null, aOptions.onRemove, aOptions);
    }

    // When the owning query has finished, pass results to the walker that
    // will remove them from the database.
    let walker = new Walker(removeCallback, aOptions, function(result) {
      (new PlacesRemoveItemTransaction(result._itemId)).doTransaction();
    });
    new QueryExecutor(query, null, walker.run, walker);
  };

  if (aOptions.onResult || aOptions.onComplete)
    new QueryExecutor(query, aOptions.onResult, aOptions.onComplete, aOptions);
}
PlacesSearch.prototype = {}


/**
 * Executes a query and receives results from it.
 */
function QueryExecutor(aPlacesQuery, aOnResult, aOnComplete, aScope) {
  this.onResult = aOnResult;
  this.onComplete = aOnComplete;
  this.scope = aScope;
  this.results = [];

  aPlacesQuery.execute(this.resultsCallback, this);
}

QueryExecutor.prototype = {
  resultsCallback: function QX_resultsCallback(aResult) {
    // Query has finished returning results and caller registered onComplete
    // so pass results to it.
    if (!aResult && this.onComplete) {
      this.scope.results = this.results;
      safeCallback(null, this.onComplete, this.scope);
    }

    // Caller registered an onComplete, so don't send results until then.
    else if (this.onComplete)
      this.results.push(new Place(aResult));

    // Send individual result to the caller.
    if (this.onResult)
      safeCallback(new Place(aResult), this.onResult, this.scope);
  }
}


/**
 * Walks through all results from an owning query that are passed to run,
 * then calls aUserCallback in the scope of aUserScope. It will also set
 * the results of the owning query as aUserScope.results. This ensures that
 * when query results have their change/remove methods called, the result set
 * is updated to reflect those calls.
 */
function Walker(aUserCallback, aUserScope, aMapFunction) {
  this.userCallback = aUserCallback;
  this.userScope = aUserScope;
  this.mapFunction = aMapFunction;
}

Walker.prototype = {
  run: function WLKR_run() {
    // Process results.
    this.results.forEach(this.mapFunction);
    if (this.userScope)
      this.userScope.results = this.results;
    if (this.userCallback)
      safeCallback(null, this.userCallback, this.userScope || undefined);
  }
}


/**
 * Place object, representing a single result in a set of search results.
 */
function Place(aOptions) {
  for (var i in aOptions) {
    switch (i) {
      // Omitted for now.
      case "pageId": // id from moz_places table, used for sql queries
      case "referringVisitId":
      case "revHost":
      case "sessionId":
      case "transitionType":
      case "type": // type const from nsINavBookmarksService
      case "visitId":
        continue;
        break;
      // Rename bookmarkIndex to position.
      case "bookmarkIndex":
        this.position = aOptions[i];
        break;
      // Id from moz_bookmarks table, used for the internal boomark apis.
      // HACK: Expose as "private" because we need to access it for
      // internal use such as deletion, and query folders.
      case "itemId": 
        this._itemId = aOptions[i];
        break;
      // Rename parentId to folder.
      case "parentId":
        this.folder = aOptions[i];
      // Rename readableType to bookmarkType.
      case "readableType":
        this.type = aOptions[i] == "container" ? "folder" : aOptions[i];
        break;
      // Rename referringUri to referrer.
      case "referringUri":
        this.referrer = aOptions[i];
        break;
      // Rename uri to location.
      case "uri":
        this.location = aOptions[i];
        break;
      // Name/value does not need to change.
      case "accessCount":
      case "dateAdded":
      case "frecency":
      case "host":
      case "icon": // is a URL, should rename to iconURL?
      case "isBookmarked":
      case "lastModified":
      case "tags":
      case "title":
      case "time":
        this[i] = aOptions[i];
        break;
    }
  }
}

/******************************************************************************
 * THE CODE FROM HERE TO THE END OF THE FILE IS THE JETPACK-LESS PLACES QUERY
 * MODULE. IT MUST REMAIN JETPACK-FREE. ANY MODIFICATIONS MUST BE FILED AS
 * BUGS AND MARKED AS BLOCKING BUG 522572.
 *****************************************************************************/

/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*-
 * vim: sw=2 ts=2 sts=2 expandtab
 * ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Mozilla Corporation.
 * Portions created by the Initial Developer are Copyright (C) 2010
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Marco Bonardo <mak77@bonardo.net> (original author)
 *   David Dahl <ddahl@mozilla.com>
 *   Dietrich Ayala <dietrich@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

//const EXPORTED_SYMBOLS = ["PlacesQuery"];

/* This is a pure async querying API.
 * It provides non-liveupdating query results passed to a callback function.
 *
 * NOTE: history results returned by this object may be up to two minutes behind
 * since it does not handle TEMP tables.  We plan to remove them, so this bad
 * behavior will be rectified at that point.
 *
 * TODO:
 * - Hierarchal queries.
 * - Accept a place: uri as input.
 * - Par querying capabilities with the old querying API.
 * - Faster queries.
 * - Create a PlacesLiveQuery wrapper that will query through an internal
 *   PlacesQuery object and then will maintain an updated copy of the results.
 * - Use PlacesLiveQuery wrapper in our views.
 * - Add further querying capabilities.
 *
 * EXAMPLE:
 *
 *  let query = new PlacesQuery({_QueryConf_});
 *
 *  query.execute(function(result) {
 *    if (result)
 *      dump("Got a result: " + [result.title, result.uri, result.readableType].join(", "));
 *    else
 *      dump("Finished executing query!\n");
 *  }, this);
 *
 *
 * _QueryConf_ = {
 *   phrase: string.
 *           Containing this string in either title, uri or tags.  Case
 *           insensitive.  Can use ^ and $ to match at beginning or end.
 *   host: string.
 *         Containing this string in the host.  Case insensitive.
 *         Can use ^ and $ to match at beginning or end.
 *   uri: string.
 *        Containing this string in the uri.  Case insensitive.
 *        Can use ^ and $ to match beginning or end.
 *   annotated: array of strings.
 *              With these annotations (Either page or item).
 *   bookmarked: object
 *   {
 *     tags: array of strings.
 *           Tagged with these tags.
 *     folder: number.
 *             Inside this folder. (non-recursive)
 *     position: number.
 *               At this position. (relative to folder).
 *               If undefined or null matches all children.
 *               If no folder is defined, position is ignored.
 *     id: number.
 *         Bookmarked with this id.
 *     createdBegin: optional Date object
 *                   Bookmarks created after this time (included).
 *                   Defaults to epoch.
 *     createdEnd: optional Date object 
 *                 Bookmarks created before this time (included).
 *                 Defaults to now.
 *     modifiedBegin: optional Date object
 *                    Bookmarks modified after this time (included).
 *                    Defaults to epoch.
 *     modifiedEnd: optional Date object 
 *                  Bookmarks modified before this time (included).
 *                  Defaults to now.
 *     onlyContainers: boolean.
 *                     Removes any non-container from results.
 *                     Default is false.
 *     excludeReadOnlyContainers: boolean.
 *                                Removes read only containers from results.
 *                                Default is false.
 *   }
 *   visited: object
 *   {
 *     countMin: optional number.
 *               With more than this many visits.
 *               Defaults to 0.
 *               This is lazily based on visit_count, thus is not going to work
 *               for not counted transitions: embed, download, framed_link.
 *     countMax: optional number.
 *               With less than this many visits.
 *               Defaults to inf.
 *               This is lazily based on visit_count, thus is not going to work
 *               for not counted transitions: embed, download, framed_link.
 *     transitions: array of transition types.
 *                  With at least one visit for each of these transitions.
 *     begin: optional Date object
 *            With visits after this time (included).
 *            Defaults to epoch.
 *     end: optional Date object 
 *          With visits before this time (included).
 *          Defaults to now.
 *     excludeRedirectSources: boolean.
 *                             Removes redirects sources from results.
 *                             Default is false.
 *     excludeRedirectTargets: boolean.
 *                             Removes redirects targets from results.
 *                             Default is false.
 *     includeHidden: boolean.
 *                    Includes also pages marked as hidden.
 *                    Default is false.
 *     includeAllVisits: boolean.
 *                       Returns all visits ungrouped.
 *                       Default is false, that means visits are grouped by uri.
 *   }
 *   sortBy: string.
 *           Either "none", "title", "time", "uri", "accessCount", "lastModified",
 *           "frecency".  Defaults to "none".
 *   sortDir: string.
 *            Either "asc" or "desc".  Defaults to "asc".
 *   group: string.
 *          Either "tags", "containers", "days", "months", "years" or "domains".
 *          Defaults to "none".
 *          NOTE: Not yet implemented.
 *   limit: number.
 *          Maximum number of results to return.  Defaults to all results.
 *   merge: string.
 *          How to merge this query's results with others in the same request.
 *          Valid values:
 *          - "union": merge results from the 2 queries.
 *          - "except": exclude current results from the previous ones.
 *          - "intersect": only current results that are also in previous ones.
 * }
 * 
 */

////////////////////////////////////////////////////////////////////////////////
//// Constants and Getters

//const Cc = Components.classes;
//const Ci = Components.interfaces;
//const Cr = Components.results;
//const Cu = Components.utils;

const TAGS_SEPARATOR = ", ";

const TAGS_SQL_FRAGMENT =
  "("
+   "SELECT GROUP_CONCAT(tag_title, ', ') "
+   "FROM ( "
+   "SELECT t_t.title AS tag_title "
+   "FROM moz_bookmarks b_t "
+   "JOIN moz_bookmarks t_t ON t_t.id = b_t.parent  "
+   "WHERE b_t.fk = h.id "
+   "AND LENGTH(t_t.title) > 0 "
+   "AND t_t.parent = :tags_folder "
+   "ORDER BY t_t.title COLLATE NOCASE ASC "
+   ") WHERE b.id NOTNULL "
+ ")";

const REFERRING_URI_SQL_FRAGMENT =
  "("
+   "SELECT refh.url FROM moz_places refh "
+   "JOIN moz_historyvisits refv ON refh.id = refv.place_id "
+   "WHERE refv.id = v.from_visit "
+ ")";

Cu.import("resource://gre/modules/XPCOMUtils.jsm", this);
Cu.import("resource://gre/modules/Services.jsm", this);
Cu.import("resource://gre/modules/PlacesUtils.jsm", this);

XPCOMUtils.defineLazyGetter(this, "DB", function() {
  return PlacesUtils.history.QueryInterface(Ci.nsPIPlacesDatabase)
                            .DBConnection;
});


////////////////////////////////////////////////////////////////////////////////
//// Utils and Helpers

function checkType(entry, type) {
  switch (type) {
    case "undefined":
      return entry === undefined;
    case "null":
      return entry === null;
    case "date":
      return Object.prototype.toString.call(entry) === "[object Date]";
    case "array":
      // TODO: Use ES5 isArray() once available.
      // NOTE: current method fails if the array comes from JSON.parse.
      return Object.prototype.toString.call(entry) === "[object Array]";
    default:
      if (entry === null) // typeof(null) == "object" but we have a "null" type.
        return false;
      return typeof(entry) == type;
  }
}


function checkArrayElementsType(array, type, allowOptionalElement) {
  let arrayIsValid = true;
  array.every(function(elm) {
    if (allowOptionalElement && (elm === undefined || elm === null))
      return true;
    return arrayIsValid = checkType(elm, type);
  });
  return arrayIsValid;
}


function isValidArray(aObj, aValidator)
{
  let validArray = checkType(aObj, "array");
  if (validArray && aValidator) {
    if (!checkType(aValidator, "function"))
      throw new Error("Array validator must be a function.");
    return aValidator(aObj);
  }
  return validArray;
}


function getReadableItemType(aResultItem, aItemType)
{
  if (aItemType) {
    // it's a bookmark.
    if (!aResultItem.uri || aResultItem.uri.substr(0, 6) == "place:") {
      switch (aItemType) {
        case Ci.nsINavBookmarksService.TYPE_SEPARATOR:
          return "separator";
        default:
          return "container";
      }
    }
    return "bookmark";
  }
  if (aResultItem.visitId)
    return "visit";
  return "page";
}


function getNodeType(aResultItem, aItemType) {
  if (aResultItem.transitionType)
    return Ci.nsINavHistoryResultNode.RESULT_TYPE_FULL_VISIT;

  let isQuery = aResultItem.uri && aResultItem.uri.substr(0, 6) == "place:";
  if (aResultItem.isBookmarked) {
    if (aItemType == PlacesUtils.bookmarks.TYPE_FOLDER)
      return Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER;
    if (aItemType == PlacesUtils.bookmarks.TYPE_SEPARATOR)
      return Ci.nsINavHistoryResultNode.RESULT_TYPE_SEPARATOR;

    if (isQuery && /^place:folder=[^&]+$/i.test(aResultItem.uri))
      return Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER_SHORTCUT;
  }

  return isQuery ? Ci.nsINavHistoryResultNode.RESULT_TYPE_QUERY
                 : Ci.nsINavHistoryResultNode.RESULT_TYPE_URI;
}


function TextMatch(aText)
{
  if (aText.substr(0, 1) == "^")
    this.matchBegin = true;
  if (aText.substr(-1, 1) == "$")
    this.matchEnd = true;
  this.exactMatch = this.matchEnd && this.matchBegin;
  let cutFrom = this.matchBegin ? 1 : 0;
  let cutLen = aText.length - cutFrom - (this.matchEnd ? 1 : 0);
  this.value = aText.substr(cutFrom, cutLen);
}

TextMatch.prototype = {
  matchBegin: false,
  matchEnd: false,
  exactMatch: false,
  value: "",

  getStringForLike: function TM_getStringForLike(aStmt) {
    let escValue = aStmt.escapeStringForLIKE(this.value, '/');
    if (this.exactMatch)
      return escValue;
    if (this.matchBegin)
      return escValue + "%";
    if (this.matchEnd)
      return "%" + escValue;
    return "%" + escValue + "%";
  },

  getRegExp: function TM_getRegExp(aUseWordBoundaries) {
    let beginMod = aUseWordBoundaries ? "\\b" : "^";
    let endMod = aUseWordBoundaries ? "\\b" : "$";
    if (this.exactMatch)
      return new RegExp(beginMod + this.value + endMod, "i");
    if (this.matchBegin)
      return new RegExp(beginMod + this.value, "i");
    if (this.matchEnd)
      return new RegExp(this.value + endMod, "i");
    return new RegExp(this.value, "i");
  }
}


////////////////////////////////////////////////////////////////////////////////
//// (De)Serializers

const SPECIAL_FOLDERS = {
  BOOKMARKS_MENU_FOLDER: PlacesUtils.bookmarksMenuFolderId
, TAGS_FOLDER: PlacesUtils.tagsFolderId
, UNFILED_BOOKMARKS_FOLDER: PlacesUtils.unfiledBookmarksFolderId
, TOOLBAR_FOLDER: PlacesUtils.toolbarFolderId
};

const TIME_REFERENCE = {
  0: 0 // EPOCH
, 1: new Date().setHours(0,0,0,0) * 1000 // TODAY'S START
, 2: Date.now() * 1000 // NOW
};

function deserializeLegacyPlaceUrl(aUrl) {
  let queryConfs = [];
  // Strip "place:" scheme.
  aUrl = aUrl.substr(7);
  // Split multiple queries.
  let queries = aQuery.split("OR");
  // Put each param in an array of objects like { name:, value: }.
  let re = new RegExp("([^?=&]+)(=([^&]*))?", "gi");
  queries.forEach(function(aQuery) {
    let params = {};
    let match = null;
    while ((match = re.exec(aQuery))) {
      let name = match[1].toLowerCase();
      let value = match[3];
      // Same key can have multiple params, for simplicity make values arrays.
      if (!(name in params))
        params[name] = [];
      params[name].push(value);
    };

    let conf = {}
    for (let name in params) {
      switch(name) {
        case "begintime":
          if (!("visited" in conf))
            conf.visited = {}
          let begintimeref = 0;
          if ("begintimeref" in params)
            begintimeref += params["begintimeref"];
          conf.visited.begin = new Date((timeref + params["begintime"][0])/1000);
          break;
        case "endtime":
          if (!("visited" in conf))
            conf.visited = {}
          let endtimeref = 0;
          if ("endtimeref" in params)
            endtimeref += params["endtimeref"];
          conf.visited.end = new Date((timeref + params["endtime"][0])/1000);
          break;
        case "terms":
          conf.phrase = params["terms"][0];
          break;
        case "minvisits":
          if (!("visited" in conf))
            conf.visited = {}
          conf.visited.countMin = params["minvisits"][0];
          break;
        case "maxvisits":
          if (!("visited" in conf))
            conf.visited = {}
          conf.visited.countMax = params["maxvisits"][0];
          break;
        case "onlybookmarked":
          if (!("bookmarked" in conf))
            conf.bookmarked = {};
          break;
        case "domain":
          if ("domainishost" in params) {
            if (params["domainishost"] == 1)
              conf.host = "^" + params["domain"][0] + "$";
          }
          else
            conf.host = params["domain"][0];
          break;
        case "folder":
          if (!("bookmarked" in conf))
            conf.bookmarked = {};
          if (params["folder"].length == 1) {
            let folderId;
            if (/[a-z]/.test(folderId)) {
              if (folderId in SPECIAL_FOLDERS)
                folderId = SPECIAL_FOLDERS[folderId];
            }
            else {
             folderId = params["folder"][0];
            }
            if (folderId)
              conf.bookmarked.folder = folderId;
          }
          // TODO: due to a nice API confusion, if there is more than one folder
          // they are wrongly ORed.
          break;
        case "annotation":
          if ("!annotation" in params) {
            // TODO: handle !annotation=1, should split an except query.
          }
          else {
            conf.annotated = params["annotation"];
          }
          break;
        case "uri":
          if ("uriisprefix" in params) {
            if (params["uriisprefix"] == 1)
              conf.host = "^" + params["uri"][0];
          }
          else
            conf.uri = "^" + params["domain"][0] + "$";
          break;
        case "group":
          // Sadly this has been killed lot of time ago for result type.
          break;
        case "sort":
          let opts = Ci.nsINavHistoryQueryOptions;
          switch(params["sort"][0]) {
            case opts.SORT_BY_TITLE_ASCENDING:
              conf.sortBy = "title";
              conf.sortDir = "ASC";
              break;
            case opts.SORT_BY_TITLE_DESCENDING:
              conf.sortBy = "title";
              conf.sortDir = "DESC";
              break;
            case opts.SORT_BY_DATE_ASCENDING:
              conf.sortBy = "time";
              conf.sortDir = "ASC";
              break;
            case opts.SORT_BY_DATE_DESCENDING:
              conf.sortBy = "time";
              conf.sortDir = "DESC";
              break;
            case opts.SORT_BY_URI_ASCENDING:
              conf.sortBy = "uri";
              conf.sortDir = "ASC";
              break;
            case opts.SORT_BY_URI_DESCENDING:
              conf.sortBy = "uri";
              conf.sortDir = "DESC";
              break;
            case opts.SORT_BY_VISITCOUNT_ASCENDING:
              conf.sortBy = "accessCount";
              conf.sortDir = "ASC";
              break;
            case opts.SORT_BY_VISITCOUNT_DESCENDING:
              conf.sortBy = "accessCount";
              conf.sortDir = "DESC";
              break;
            case opts.SORT_BY_DATEADDED_ASCENDING:
              conf.sortBy = "dateAdded";
              conf.sortDir = "ASC";
              break;
            case opts.SORT_BY_DATEADDED_DESCENDING:
              conf.sortBy = "dateAdded";
              conf.sortDir = "DESC";
              break;
            case opts.SORT_BY_LASTMODIFIED_ASCENDING:
              conf.sortBy = "lastModified";
              conf.sortDir = "ASC";
              break;
            case opts.SORT_BY_LASTMODIFIED_DESCENDING:
              conf.sortBy = "lastModified";
              conf.sortDir = "DESC";
              break;
            case opts.SORT_BY_NONE:  
              // default.
              break;
            case opts.SORT_BY_KEYWORD_ASCENDING:
            case opts.SORT_BY_KEYWORD_DESCENDING:
            case opts.SORT_BY_TAGS_ASCENDING:
            case opts.SORT_BY_TAGS_DESCENDING:
            case opts.SORT_BY_ANNOTATION_ASCENDING:
            case opts.SORT_BY_ANNOTATION_DESCENDING:
              // Not supported.
              break;
          };
          break;
        case "type":
          switch (params["type"][0]) {
            case Ci.nsINavHistoryQueryOptions.RESULTS_AS_VISIT:
            case Ci.nsINavHistoryQueryOptions.RESULTS_AS_FULL_VISIT:
              if (!("visited" in conf))
                conf.visited = {};
              conf.visited.includeAllVisits = true;
              break;
            case Ci.nsINavHistoryQueryOptions.RESULTS_AS_DATE_QUERY:
            case Ci.nsINavHistoryQueryOptions.RESULTS_AS_SITE_QUERY:
            case Ci.nsINavHistoryQueryOptions.RESULTS_AS_DATE_SITE_QUERY:
              // TODO, need to define how to make date grouping.
              break;
            case Ci.nsINavHistoryQueryOptions.RESULTS_AS_TAG_QUERY:
            case Ci.nsINavHistoryQueryOptions.RESULTS_AS_TAG_CONTENTS:
              conf.group = "tags";
              break;
          }
          break;
        case "excludeitems":
          if (!("bookmarked" in conf))
            conf.bookmarked = {};
          if (params["excludeitems"][0] == 1)
            conf.bookmarked.onlyContainers = true;
          break;
        case "excludequeries":
          if (!("bookmarked" in conf))
            conf.bookmarked = {};
          break;
        case "excludereadonlyfolders":
          if (!("bookmarked" in conf))
            conf.bookmarked = {};
          if (params["excludereadonlyfolders"][0] == 1)
            conf.bookmarked.excludeReadOnlyContainers = true;
          break;
        case "excludeitemifparenthasannotation":
          // Not supported, we should remove livemarks children from bookmarks
          // instead.
          break;
        case "expandqueries":
          // Not supported, the query should have onlyContainers instead.
          break;
        case "originaltitle":
          // Never been implemented, and it is not yet.
          break;
        case "includehidden":
          if (!("visited" in conf))
            conf.visited = {};
          if (params["includehidden"][0] == 1)
            conf.visited.includeHidden = true;
          break;
        case "redirectsmode":
          if (!("visited" in conf))
            conf.visited = {};
          switch(params["redirectsMode"][0]) {
            case Ci.nsINavHistoryQueryOptions.REDIRECTS_MODE_TARGET:
            conf.visited.excludeRedirectSources = true;
            break;
            case Ci.nsINavHistoryQueryOptions.REDIRECTS_MODE_SOURCE:
            conf.visited.excludeRedirectTargets = true;
            break;
          }
          break;
        case "maxresults":
            conf.limit = params["maxresults"][0];
          break;
        case "querytype":
          if (params["querytype"][0] == Ci.nsINavHistoryQueryOptions.QUERY_TYPE_BOOKMARKS &&
              !("bookmarked" in conf))
            conf.bookmarked = {};
          break;
        case "tag":
          if ("!tags" in params) {
            // TODO: handle !annotation=1, should split out an except query.
          }
          else {
            if (!("bookmarked" in conf))
              conf.bookmarked = {};
            conf.bookmarked.tags = params["tag"];
          }
          break;
        case "asyncenabled":
          // Ignored, this is always async.
          break;
      }
    }

    // Folder shortcuts.
    if (/place:folder=[^&]/.test(aUrl))
      conf.group = "containers";

    queryConfs.push(conf);
  });
  return queryConfs;
}


////////////////////////////////////////////////////////////////////////////////
//// QueryConf

function QueryConf(aQueryConf)
{
  // Safe initialize: use default values if inputs are invalid.
  for (let prop in aQueryConf) {
    this[prop] = aQueryConf[prop];
  }
}

QueryConf.prototype = {
  _phrase: new TextMatch(""),
  get phrase() this._phrase.value,
  set phrase(aVal)
  {
    if (checkType(aVal, "string"))
      this._phrase = new TextMatch(aVal);
    return this._phrase.value;
  },

  _host: new TextMatch(""),
  get host() this._host.value,
  set host(aVal)
  {
    if (checkType(aVal, "string"))
      this._host = new TextMatch(aVal);
    return this._host.value;
  },

  _uri: new TextMatch(""),
  get uri() this._uri.value,
  set uri(aVal)
  {
    if (checkType(aVal, "string"))
      this._uri = new TextMatch(aVal);
    return this._uri.value;
  },

  _annotated: [],
  get annotated() this._annotated,
  set annotated(aVal)
  {
    if (isValidArray(aVal, function(v) v.length > 0 && checkArrayElementsType(v, "string")))
      this._annotated = aVal;
    return this._annotated;
  },

  _bookmarked: null,
  get bookmarked() this._bookmarked,
  set bookmarked(aVal)
  {
    if (checkType(aVal, "object")) {
      let options = { tags: []
                    , folder: null
                    , position: null
                    , id: null
                    , createdBegin: null
                    , createdEnd: null
                    , modifiedBegin: null
                    , modifiedEnd: null
                    , onlyContainers: false
                    , excludeReadOnlyContainers: false
                    };

      if ("tags" in aVal &&
          isValidArray(aVal.tags, function(v) v.length > 0 && checkArrayElementsType(v, "string")))
        options.tags = aVal.tags;

      if ("folder" in aVal && aVal.folder > 0)
        options.folder = aVal.folder;

      if ("position" in aVal && aVal.position >= 0)
        options.position = aVal.position;

      if ("id" in aVal && checkType(aVal.id, "number"))
        options.id = aVal.id;

      if ("createdBegin" in aVal && checkType(aVal.createdBegin, "date"))
        options.createdBegin = aVal.createdBegin;

      if ("createdEnd" in aVal && checkType(aVal.createdEnd, "date"))
        options.createdEnd = aVal.createdEnd;

      if ("modifiedBegin" in aVal && checkType(aVal.modifiedBegin, "date"))
        modifiedBegin = aVal.modifiedBegin;
      if ("end" in aVal && checkType(aVal.modifiedEnd, "date"))
        modifiedEnd = aVal.modifiedEnd;

      if ("onlyContainers" in aVal &&
          checkType(aVal.onlyContainers, "boolean"))
        options.onlyContainers = aVal.onlyContainers;

      if ("excludeReadOnlyContainers" in aVal &&
          checkType(aVal.excludeReadOnlyContainers, "boolean"))
        options.excludeReadOnlyContainers = aVal.excludeReadOnlyContainers;

      this._bookmarked = options;
    }
    // Set simple bool for isBookmarked with no other parameters.
    else if(aVal) {
      this._bookmarked = true;
    }
    return this._bookmarked;
  },

  _visited: null,
  get visited() this._visited,
  set visited(aVal)
  {
    if (checkType(aVal, "object")) {
      let options = { countMin: null
                    , countMax: null
                    , transitions: []
                    , begin: null
                    , end: null
                    , exclude: []
                    , include: []
                    };

      if ("countMin" in aVal && checkType(aVal.countMin, "number"))
        options.countMin = aVal.countMin;
      if ("countMax" in aVal && checkType(aVal.countMax, "number"))
        options.countMax = aVal.countMax;

      if ("transitions" in aVal &&
          isValidArray(aVal.transitions, function(v) v.length > 0 && checkArrayElementsType(v, "number")))
        options.transitions = aVal.transitions;

      if ("begin" in aVal && checkType(aVal.begin, "date"))
        options.begin = aVal.begin;

      if ("end" in aVal && checkType(aVal.end, "date"))
        options.end = aVal.end;

      if ("excludeRedirectSources" in aVal &&
          checkType(aVal.excludeRedirectSources, "boolean"))
        options.excludeRedirectSources = aVal.excludeRedirectSources;

      if ("excludeRedirectTargets" in aVal &&
          checkType(aVal.excludeRedirectTargets, "boolean"))
        options.excludeRedirectTargets = aVal.excludeRedirectTargets;

      if ("includeHidden" in aVal && checkType(aVal.includeHidden, "boolean"))
        options.includeHidden = aVal.includeHidden;

      if ("includeAllVisits" in aVal && checkType(aVal.includeAllVisits, "boolean"))
        options.includeAllVisits = aVal.includeAllVisits;

      this._visited = options;
    }
    // Set simple bool for isVisited with no other parameters.
    else if(aVal) {
      this._visited = true;
    }
    return this._visited;
  },

  // TODO: not yet implemented for callers. Internally
  // it's used already, so just disabling the setter.
  _group: "none",
  get group() this._group,
  /*
  set group(aVal)
  {
    if (["none", "containers"
         //, "tags", "month", "year", "host"
        ].indexOf(aVal) != -1)
      this._group = aVal;
    return this._group;
  },
  */

  _sortBy: "none",
  get sortBy() this._sortBy,
  set sortBy(aVal)
  {
    let sortingOptions = ["none", "title", "time", "uri", "accessCount", "lastModified", "frecency"];
    if (checkType(aVal, "string") && sortingOptions.indexOf(aVal) != -1) {
      this._sortBy = aVal;
    }
    return this._sortBy;
  },

  _sortDir: "ASC",
  get sortDir() this._sortDir,
  set sortDir(aVal)
  {
    this._sortDir = ["asc", "desc"].indexOf(aVal) != -1 ? aVal.toUpperCase() : "ASC";
    return this._sortDir;
  },

  _limit: -1,
  get limit() this._limit,
  set limit(aVal)
  {
    if (checkType(aVal, "number"))
      this._limit = aVal;
    return this._limit;
  },

  /*
  _merge: "union",
  get merge() this._merge,
  set merge(aVal)
  {
    if (["union", "intersect", "except"].indexOf(aVal) != -1)
      this._merge = aVal;
    return this._merge;
  }
  */
}


////////////////////////////////////////////////////////////////////////////////
//// PlacesQuery

// Note: Multiple queryconf support is currently denied from callers
// as the API is not complete. However, the support is kept in the back-end
// so we're just wrapping the query conf in an array in two places
// in this ctor for now.
function PlacesQuery(aQueryConf)
{
  let queryConfs = [];

  // Allow passing a place: url.
  if (checkType(aQueryConf, "string") &&
      aQueryConf.substr(0, 6) == "place:") {
    queryConfs.push(deserializeLegacyPlaceUrl(aQueryConf));
    // TODO: check valid conf object here
  }
  // Allow array for future compat, but currently
  // only accepting single query.
  //else if (checkType(aQueryConf, "array"))
  //  queryConfs.push(new QueryConf(aQueryConf[0]));
  else if (checkType(aQueryConf, "object"))
    queryConfs.push(new QueryConf(aQueryConf));
  else
    throw Cr.NS_ERROR_INVALID_ARG;  // TODO: nice errors please.

  let pendingQuery = this;
  this.execute = function PQ_execute(aCallback, aThisObject)
  {
    // A callback is required, otherwise running the query would be useless.
    if (!aCallback || !checkType(aCallback, "function"))
      throw Cr.NS_ERROR_INVALID_ARG;  // TODO: nice errors please.

    let [sql, stmt] = QueryBuilder.build(queryConfs);

    // DEBUG
    //dump("\nDEBUG SQL PRINT\n" + sql + "\n\n");

    // Run query, call back.
    let stmtCallback = new StmtCallback(queryConfs, aCallback, aThisObject);
    pendingQuery._pending = stmt.executeAsync(stmtCallback);
    stmtCallback.pendingQuery = pendingQuery;
    stmt.finalize();
  }

  this.cancel = function PQ_cancel()
  {
    if (pendingQuery._pending) {
      pendingQuery._pending.cancel();
      delete pendingQuery._pending;
    }
  }
}

PlacesQuery.prototype = {}


////////////////////////////////////////////////////////////////////////////////
//// QueryBuilder

let QueryBuilder = {
  build: function QB_build(aQueryConfs)
  {
    // Get global options, we use the first query's ones.
    let globalGroup = aQueryConfs[0].group;
    let globalSortBy = aQueryConfs[0].sortBy;
    let globalSortDir = aQueryConfs[0].sortDir;
    let globalLimit = aQueryConfs[0].limit;

    // Optimizations will come later, but some query could be hard to silent.
    let sql = "/* do not warn (bug 522572) */";
    for (let i = 0; i < aQueryConfs.length; i++) {
      aQueryConfs[i]._qIndex = i;
      if (i > 0) {
        switch (aQueryConfs[i - 1].merge) {
          case "intersect":
            sql += " INSERSECT ";
            break;
          case "except":
            sql += " EXCEPT ";
            break;
          case "union":
          default:
            sql += " UNION ";
            break;
        }
      }
      sql += this._SQLFor(aQueryConfs[i], globalGroup);
    }

    if (globalSortBy || globalSortDir) {
      function getNeutralSorting() {
        if (globalGroup == "containers" || globalGroup == "tags")
          return "position";
        return "page_id";
      }
      const COLUMNS = { none: getNeutralSorting()
                      , title: "page_title COLLATE NOCASE"
                      , time: "visit_date"
                      , uri: "page_url"
                      , accessCount: "visit_count"
                      , lastModified: "lastModified"
                      , frecency: "frecency"
                      };
      sql += " ORDER BY " + COLUMNS[globalSortBy] + " " + globalSortDir;
    }

    // Check if we can apply a direct LIMIT to the query, if there is any sort
    // of post filtering or processing, we clearly can't.
    if (globalLimit != -1) {
      let canSQLLimit = globalGroup == "none";
      for (let i = 0; i < aQueryConfs.length && canSQLLimit; i++) {
        canSQLLimit = aQueryConfs[i]._postFilteringTasks.length == 0 &&
                      aQueryConfs[i]._postProcessingTasks.length == 0;
      }
      if (canSQLLimit)
        sql += " LIMIT " + globalLimit;
    }

    let stmt = DB.createAsyncStatement(sql);
    this._bind(stmt, aQueryConfs);

    return [sql, stmt];
  },

  _bind: function QB__bind(aStmt, aQueryConfs)
  {
    // Collect all binding params.
    let params = [];
    aQueryConfs.forEach(function(aQueryConf) {
      params = params.concat(aQueryConf._params);
    });

    params.forEach(function(aParam) {
      let value = aParam.value;
      if (checkType(value, "object") &&
          TextMatch.prototype.isPrototypeOf(value)) {
        // This is a LIKE clause, thus value must be escaped.
        aStmt.params[aParam.name] = value.getStringForLike(aStmt);
      }
      else {
        aStmt.params[aParam.name] = value;
      }
    });
  },

  _SQLFor: function QB__SQLFor(aQueryConf, aGroup)
  {
    aQueryConf._params = [];
    aQueryConf._postFilteringTasks = [];
    aQueryConf._postProcessingTasks = [];

    // Used in all queries.
    aQueryConf._params.push({ name: "tags_folder",
                              value: PlacesUtils.tagsFolderId });

    if (aQueryConf.visited && aQueryConf.visited.includeAllVisits)
      return this._SQLForVisitsQuery(aQueryConf, aGroup);

    if (aQueryConf.bookmarked)
      return this._SQLForBookmarksQuery(aQueryConf, aGroup);

    return this._SQLForPagesQuery(aQueryConf, aGroup);
  },

  _SQLForVisitsQuery: function QB__SQLForVisitsQuery(aQueryConf, aGroup)
  {
    let sql
    = "SELECT h.id AS page_id, h.url AS page_url, "
    +        "COALESCE(b.title, h.title) AS page_title, h.rev_host AS rev_host, "
    +        "h.visit_count AS visit_count, v.visit_date AS visit_date, "
    +        "f.url AS icon_url, v.session AS session, b.id AS item_id, "
    +        "b.dateAdded AS dateAdded, b.lastModified AS lastModified, "
    +        "b.parent AS parent_id, " + TAGS_SQL_FRAGMENT + " AS tags, "
    +        "b.position AS position, b.type AS item_type, "
    +        "h.frecency AS frecency, v.id AS visit_id, "
    +        "v.from_visit AS from_visit, "
    +        REFERRING_URI_SQL_FRAGMENT + " AS from_visit_uri, "
    +        "v.visit_type AS visit_type "
    + "FROM moz_places h "
    + "JOIN moz_historyvisits v ON v.place_id = h.id "
    + "LEFT JOIN moz_bookmarks b ON b.fk = h.id "
    + "LEFT JOIN moz_favicons f ON f.id = h.favicon_id "
    ;

    return sql + this._getConditions([], aQueryConf, "visits", aGroup);
  },

  _SQLForPagesQuery: function QB__SQLForPagesQuery(aQueryConf, aGroup)
  {
    let sql
    = "SELECT h.id AS page_id, h.url AS page_url, "
    +        "COALESCE(b.title, h.title) AS page_title, h.rev_host AS rev_host, "
    +        "h.visit_count AS visit_count, h.last_visit_date AS visit_date, "
    +        "f.url AS icon_url, NULL AS session, b.id AS item_id, "
    +        "b.dateAdded AS dateAdded, b.lastModified AS lastModified, "
    +        "b.parent AS parent_id, " + TAGS_SQL_FRAGMENT + " AS tags, "
    +        "b.position AS position, b.type AS item_type, "
    +        "h.frecency AS frecency, NULL AS visit_id, NULL AS from_visit, "
    +        "NULL AS from_visit_uri, NULL AS visit_type "
    + "FROM moz_places h "
    + "LEFT JOIN moz_bookmarks b ON b.fk = h.id "
    + "LEFT JOIN moz_favicons f ON f.id = h.favicon_id "
    ;

    return sql + this._getConditions([], aQueryConf, "pages", aGroup);
  },

  _SQLForBookmarksQuery: function QB__SQLForBookmarksQuery(aQueryConf, aGroup)
  {
    // If we are grouping, or querying a folder's contents, show containers.
    let showContainers = (aGroup != "none" ||
                         (aQueryConf.bookmarked && aQueryConf.bookmarked.folder));
    let join = showContainers ? "LEFT JOIN" : "JOIN";

    let sql
    = "SELECT h.id AS page_id, h.url AS page_url, "
    +        "COALESCE(b.title, h.title) AS page_title, h.rev_host AS rev_host, "
    +        "h.visit_count AS visit_count, h.last_visit_date AS visit_date, "
    +        "f.url AS icon_url, NULL AS session, b.id AS item_id, "
    +        "b.dateAdded AS dateAdded, b.lastModified AS lastModified, "
    +        "b.parent AS parent_id, " + TAGS_SQL_FRAGMENT + " AS tags, "
    +        "b.position AS position, b.type AS item_type, "
    +        "h.frecency AS frecency, NULL AS visit_id, NULL AS from_visit, "
    +        "NULL AS from_visit_uri, NULL AS visit_type "
    + "FROM moz_bookmarks b "
    + join + " moz_places h ON b.fk = h.id "
    + "LEFT JOIN moz_favicons f ON f.id = h.favicon_id "
    ;

    let conditions = []
    //if (aGroup == "none") {
    if (!showContainers) {
      // We want a flat list, exclude query containers.
      conditions.push("SUBSTR(page_url, 0, 6) <> 'place:'");
    }

    return sql + this._getConditions(conditions, aQueryConf, "bookmarks", aGroup);
  },

  _getConditions: function QB__getConditions(aConditions, aQueryConf, aBaseQuery, aGroup)
  {
    // We can use LIKE only for ASCII searches, for anything other we must
    // fallback to post-filtering.  Otherwise we should bundle a lib like ICU.
    // Moreover searching "bàr" won't match "bar" and viceversa.
    function needsRegExpLIKE(aText) /[^a-z0-9]/i.test(aText);


    if (aQueryConf.phrase) {
      let textMatch = aQueryConf._phrase;
      if (needsRegExpLIKE(aQueryConf.phrase)) {
        aQueryConf._postFilteringTasks.push(function filter(aResultItem) {
          let reTags = textMatch.getRegExp(true);
          let re = textMatch.getRegExp(false);
          return re.test(aResultItem.title) ||
                 re.test(aResultItem.uri) ||
                 reTags.test(aResultItem.tags.join(" "));
        });
      }
      else {
        let param = "phrase" + aQueryConf._qIndex;
        aConditions.push(
          "("
        +   "page_url LIKE :" + param + " ESCAPE '/' OR "
        +   "page_title LIKE :" + param + " ESCAPE '/' OR "
        +   "tags LIKE :" + param + " ESCAPE '/' "
        + ")"
        );
        aQueryConf._params.push({ name: param,
                                  value: textMatch });
      }
    }


    if (aQueryConf.host) {
      let textMatch = aQueryConf._host;
      if (needsRegExpLIKE(aQueryConf.host)) {
        aQueryConf._postFilteringTasks.push(function filter(aResultItem) {
          let re = textMatch.getRegExp(false);
          return re.test(aResultItem.host);
        });
      }
      else {
        let param = "revHost" + aQueryConf._qIndex;
        aConditions.push("(rev_host LIKE :" + param + " ESCAPE '/')");
        let value = textMatch.value.split("").reverse().join("");
        if (textMatch.exactMatch)
          value = "^" + value + ".$";
        else if (textMatch.matchBegin)
          value = value + ".$";
        else if (textMatch.matchEnd)
          value = "^" + value;
        aQueryConf._params.push({ name: param,
                                  value: new TextMatch(value) });
      }
    }


    if (aQueryConf.uri) {
      let textMatch = aQueryConf._uri;
      if (needsRegExpLIKE(aQueryConf.uri)) {
        aQueryConf._postFilteringTasks.push(function filter(aResultItem) {
          let re = textMatch.getRegExp(false);
          return re.test(aResultItem.uri);
        });
      }
      else {
        let param = "uri" + aQueryConf._qIndex;
        aConditions.push("(page_url LIKE :" + param + " ESCAPE '/')");
        aQueryConf._params.push({ name: param,
                                  value: textMatch });
      }
    }


    if (aQueryConf.bookmarked) {
      let options = aQueryConf.bookmarked;

      // Exclude bookmarks in tags folders.
      aConditions.push(
        "NOT EXISTS ("
      +   "SELECT 1 FROM moz_bookmarks parents "
      +   "WHERE parents.id = parent_id AND parents.parent = :tags_folder "
      +   "LIMIT 1 "
      + ") "
      );

      if (checkType(options, "object")) {

        if (options.tags.length > 0) {
          // tags filtering.
          let paramPrefix = "tag" + aQueryConf._qIndex;
          let params = [];
          for (let i = 0; i < options.tags.length; i++) {
            let param = paramPrefix + "_" + i
            params.push(":" + param);
            aQueryConf._params.push({ name: param,
                                      value: options.tags[i] });
          }
          let param = "tagsCount" + aQueryConf._qIndex;
          aQueryConf._params.push({ name: param,
                                    value: options.tags.length });
          aConditions.push(
            ":" + param + " = ( "
          +   "SELECT count(*) FROM moz_bookmarks tags_map "
          +   "JOIN moz_bookmarks tags ON tags_map.parent = tags.id "
          +   "WHERE tags.parent = :tags_folder "
          +     "AND tags.title IN (" + params.join(",") + ") "
          +     "AND tags_map.fk = page_id "
          + ") "
          );
        }

        if (options.folder) {
          // folder id filtering.
          let param = "folderId" + aQueryConf._qIndex;
          aConditions.push("parent_id = :" + param);
          aQueryConf._params.push({ name: param,
                                    value: options.folder });
          if (checkType(options.position, "number")) {
            // position in folder filtering.
            let param = "positionInFolder" + aQueryConf._qIndex;
            aConditions.push("position = :" + param);
            aQueryConf._params.push({ name: param,
                                      value: options.position });
          }
        }

        if (options.id) {
          // id filtering.
          let param = "itemId" + aQueryConf._qIndex;
          aConditions.push("item_id = :" + param);
          aQueryConf._params.push({ name: param,
                                    value: options.id });
        }

        if (options.createdBegin) {
          let param = "createdBeginTime" + aQueryConf._qIndex;
          let beginTime = options.createdBegin.getTime() * 1000;
          aConditions.push("dateAdded >= :" + param);
          aQueryConf._params.push({ name: param,
                                    value: beginTime });
        }
        if (options.createdEnd) {
          let param = "createdEndTime" + aQueryConf._qIndex;
          let endTime = options.createdEnd.getTime() * 1000;
          aConditions.push("dateAdded <= :" + param);
          aQueryConf._params.push({ name: param,
                                    value: endTime });
        }

        if (options.modifiedBegin) {
          let param = "modifiedBeginTime" + aQueryConf._qIndex;
          let beginTime = options.modifiedBegin.getTime() * 1000;
          aConditions.push("lastModified >= :" + param);
          aQueryConf._params.push({ name: param,
                                    value: beginTime });
        }
        if (options.modifiedEnd) {
          let param = "modifiedEndTime" + aQueryConf._qIndex;
          let endTime = options.modifiedEnd.getTime() * 1000;
          aConditions.push("lastModified <= :" + param);
          aQueryConf._params.push({ name: param,
                                    value: endTime });
        }

        if (options.excludeReadOnlyContainers) {
          // Exclude queries and folders annotated as read-only.
          aConditions.push("SUBSTR(page_url, 0, 6) <> 'place:'");
          aConditions.push(
            "NOT EXISTS( "
          +   "SELECT 1 FROM moz_items_annos a "
          +   "JOIN moz_anno_attributes n ON n.id = a.anno_attribute_id "
          +   "WHERE a.item_id = b.id AND n.name = :readOnlyAnno "
          +   "LIMIT 1 "
          + ")"
          );
          aQueryConf._params.push({ name: "readOnlyAnno",
                                    value: PlacesUtils.READ_ONLY_ANNO });
        }

        if (options.onlyContainers) {
            aConditions.push(
            "(item_type <> :bookmark_type OR "
          +   "(page_url >= 'place:' AND page_url < 'place;') "
          + ")"
          );
          aConditions.push("item_type <> :separator_type");
          aQueryConf._params.push({ name: "separator_type",
                                    value: PlacesUtils.bookmarks.TYPE_SEPARATOR });
        }

      }
    }


    if (aQueryConf.visited) {
      if (aBaseQuery != "visits") {
        aConditions.push(
          "EXISTS (SELECT id FROM moz_historyvisits WHERE place_id = h.id LIMIT 1)"
        );
      }
      let options = aQueryConf.visited;

      if (checkType(options, "object")) {
        if (options.countMin) {
          let param = "minVisitCount" + aQueryConf._qIndex;
          aConditions.push("visit_count >= :" + param);
          aQueryConf._params.push({ name: param,
                                    value: options.countMin });
        }
        if (options.countMax) {
          let param = "maxVisitCount" + aQueryConf._qIndex;
          aConditions.push("visit_count <= :" + param);
          aQueryConf._params.push({ name: param,
                                    value: options.countMax });
        }

        if (options.transitions.length > 0) {
          let paramPrefix = "transition" + aQueryConf._qIndex;
          if (aBaseQuery == "visits" && options.transitions.length == 1) {
            aConditions.push("visit_type = : " + paramPrefix);
            aQueryConf._params.push({ name: paramPrefix,
                                      value: options.transitions[0] });
          }
          else {
            let params = [];
            for (let i = 0; i < options.transitions.length; i++) {
              let param = paramPrefix + "_" + i
              params.push(":" + param);
              aQueryConf._params.push({ name: param,
                                        value: options.transitions[i] });
              aConditions.push(
                "EXISTS ( "
              +   "SELECT 1 FROM moz_historyvisits "
              +   "WHERE place_id = page_id AND visit_type = :" + param + " "
              +   "LIMIT 1 "
              + ")"
              );
            }
          }
        }

        if (options.begin) {
          let param = "visitedBeginTime" + aQueryConf._qIndex;
          let beginTime = options.begin.getTime() * 1000;
          aQueryConf._params.push({ name: param,
                                    value: beginTime });
          if (aBaseQuery == "visits") {
            aConditions.push("visit_date >= :" + param);
          }
          else {
            aConditions.push(
              "EXISTS( "
            +   "SELECT 1 FROM moz_historyvisits "
            +   "WHERE visit_date >= :" + param + " AND place_id = page_id "
            +   "LIMIT 1 "
            + ")"
            );
          }
        }
        if (options.end) {
          let param = "visitedEndTime" + aQueryConf._qIndex;
          let endTime = options.end.getTime() * 1000;
          aQueryConf._params.push({ name: param,
                                    value: endTime });
          if (aBaseQuery == "visits") {
            aConditions.push("visit_date <= :" + param);
          }
          else {
            aConditions.push(
              "EXISTS( "
            +   "SELECT 1 FROM moz_historyvisits "
            +   "WHERE visit_date <= :" + param + " AND place_id = page_id "
            +   "LIMIT 1 "
            + ")"
            );
          }
        }

        if (options.excludeRedirectSources) {
          aQueryConf._params.push({ name: "transition_redirect_permanent",
                                    value: Ci.nsINavHistoryService.TRANSITION_REDIRECT_PERMANENT });
          aQueryConf._params.push({ name: "transition_redirect_temporary",
                                    value: Ci.nsINavHistoryService.TRANSITION_REDIRECT_TEMPORARY });
          if (aBaseQuery == "visits") {
            aConditions.push(
              "NOT EXISTS ( "
            +   "SELECT id FROM moz_historyvisits "
            +   "WHERE from_visit = visit_id AND visit_type IN (:transition_redirect_permanent, :transition_redirect_temporary) "
            + ")"
            );
          }
          else {
            // Exclude pages that are only redirect sources.
            aConditions.push(
              "EXISTS ( "
            +   "SELECT 1 FROM moz_historyvisits srcs "
            +   "LEFT JOIN moz_historyvisits dests ON dests.from_visit = srcs.id "
            +   "WHERE srcs.place_id = page_id "
            +   "AND (dests.id IS NULL OR dests.visit_type NOT IN (:transition_redirect_permanent, :transition_redirect_temporary)) "
            +   "LIMIT 1 "
            + ")"
            );
          }
        }

        if (options.excludeRedirectTargets) {
          aQueryConf._params.push({ name: "transition_redirect_permanent",
                                    value: Ci.nsINavHistoryService.TRANSITION_REDIRECT_PERMANENT });
          aQueryConf._params.push({ name: "transition_redirect_temporary",
                                    value: Ci.nsINavHistoryService.TRANSITION_REDIRECT_TEMPORARY });
          if (aBaseQuery == "visits") {
            aConditions.push(
              "visit_type NOT IN (:transition_redirect_permanent, :transition_redirect_temporary)"
            );
          }
          else {
            // Exclude pages that are only redirect targets.
            aConditions.push(
              "EXISTS ( "
            +   "SELECT 1 FROM moz_historyvisits "
            +   "WHERE place_id = page_id "
            +     "AND visit_type NOT IN (:transition_redirect_permanent, :transition_redirect_temporary) "
            +   "LIMIT 1 "
            + ")"
            );
          }
        }

        if (!options.includeHidden) {
          aConditions.push("h.hidden = 0");
          if (aBaseQuery == "visits") {
            aConditions.push(
              "visit_type NOT IN (:transition_embed, :transition_framed_link)"
            );
            aQueryConf._params.push({ name: "transition_embed",
                                      value: Ci.nsINavHistoryService.TRANSITION_EMBED });
            aQueryConf._params.push({ name: "transition_framed_link",
                                      value: Ci.nsINavHistoryService.TRANSITION_FRAMED_LINK });
          }
        }
      }
    }

    
    if (aQueryConf.annotated.length > 0) {
      let paramPrefix = "annoName" + aQueryConf._qIndex;
      let params = [];
      for (let i = 0; i < aQueryConf.annotated.length; i++) {
        let param = paramPrefix + "_" + i;
        params.push(":" + param);
        aQueryConf._params.push({ name: param,
                                  value: aQueryConf.annotated[i] });
      }
      let param = "annosCount" + aQueryConf._qIndex;
      aQueryConf._params.push({ name: param,
                                value: aQueryConf.annotated.length });
      aConditions.push(
        ":" + param + " = ( "
      +   "SELECT count(*) FROM moz_anno_attributes n "
      +   "LEFT JOIN moz_annos a ON n.id = a.anno_attribute_id AND a.place_id = h.id "
      +   "LEFT JOIN moz_items_annos ia ON n.id =ia.anno_attribute_id AND ia.item_id = b.id "
      +   "WHERE name IN (" + params.join(",") + ") "
      +   "AND IFNULL(place_id, item_id) NOTNULL "
      + ") "
      );
    }


    return aConditions.length > 0 ? "WHERE " + aConditions.join(" AND ")
                                  : "";
  }
}

////////////////////////////////////////////////////////////////////////////////
//// StmtCallback

function StmtCallback(aQueryConfs, aCallback, aThisObject)
{
  this._queryConfs = aQueryConfs;
  this._callbackInfo = { cb: aCallback, scope: aThisObject };
  this._results = [];
  this._limit = aQueryConfs[0].limit;
  this._currentResultsCount = 0;
  this.pendingQuery = null;

  // Collect all post-filtering tasks.  These are run as soon as results are
  // available.  Filtered results are then immediately returned to the caller
  // unless post-processing has to happen.
  this._postFilteringTasks = [];
  this._queryConfs.forEach(function(aQueryConf) {
    this._postFilteringTasks =
      this._postFilteringTasks.concat(aQueryConf._postFilteringTasks.slice());
  }, this);

  // Collect all post-processing tasks.  These are run after all results have
  // been cached.  If any post-processing task is defined then no results are
  // returned to the caller till all post-processing is finished.
  this._postProcessingTasks = [];
  this._queryConfs.forEach(function(aQueryConf) {
    this._postProcessingTasks =
      this._postProcessingTasks.concat(aQueryConf._postProcessingTasks.slice());
  }, this);
}

StmtCallback.prototype = {
  handleResult: function SC_handleResult(aResultSet)
  {
    let row;
    let results = [];
    while ((row = aResultSet.getNextRow()) != null) {
      results.push(new ResultItem(row, this._queryConfs));
    }

    this._postFilter(results);

    this._currentResultsCount += results.length;
    if (this._limit != -1 && this._postProcessingTasks.length == 0 &&
        this._currentResultsCount >= this._limit) {
      // No reason for this query to return other results.
      if (this.pendingQuery)
        this.pendingQuery.cancel();
      // Remove exceeding results.
      let excess = this._currentResultsCount - this._limit;
      results.splice(results.length - excess, excess);
    }

    // If this query does not require postProcessing, just push results to the
    // caller.  Notice that pushing an empty result set means that we are done
    // so we must avoid it.
    if (this._postProcessingTasks.length == 0 && results.length > 0)
      this._callback(results);
    else
      this._results = this._results.concat(results);
  },

  handleError: function SC_handleError(aError)
  {
    Cu.reportError("PlacesQuery: An error occured while executing a query.");
  },

  handleCompletion: function SC_handleCompletion(aReason)
  {
    if ((aReason == Ci.mozIStorageStatementCallback.REASON_FINISHED ||
        aReason == Ci.mozIStorageStatementCallback.REASON_CANCELED) &&
        this._results.length > 0) {
      this._postProcess(this._results);

      if (this._limit != -1 && this._results.length > this._limit) {
        // Remove exceeding results.
        let excess = this._results.length - this._limit;
        this._results.splice(this._results.length - excess, excess);
      }
    }

    // Notify the caller we have finished pushing results, by pushing an empty
    // set.  This happens regardless completion reason.
    this._callback(this._results);
  },

  _postProcess: function SC__postProcess(aResults) {
    // Bail out if there is nothing to post-process.
    if (this._postProcessingTasks.length == 0)
      return;

    for (let i = 0; i < this._results.length; i++) {
      this._postProcessingTasks.forEach(function(aPPTask) {
        // Each post-processing task should be able to work on the full set.
        aPPTask(this._results); // TODO: define this better.
      }, this);
    }

    // Push results to the caller, if we have any.
    if (aResults.length)
      this._callback(aResults);
  },

  _postFilter: function SC__postFilter(aResults) {
    // Bail out if there is nothing to post-filter.
    if (this._postFilteringTasks.length == 0)
      return;

    for (let i = 0; i < aResults.length; i++) {
      this._postFilteringTasks.forEach(function(aPassFilter) {
        if (!aPassFilter(aResults[i])) {
          // Be sure to decrease i since we are removing one element.
          aResults.splice(i--, 1);
        }
      }, this);
    }
  },

  _callback: function SC__callback(aResults) {
    // Enqueue the call, so it runs out of the current task.
    Services.tm.mainThread.dispatch({
      _callbackInfo: this._callbackInfo,
      run: function() {
        let callback = this._callbackInfo.cb; 
        let scope = this._callbackInfo.scope ||
                    Cu.getGlobalForObject(this._callbackInfo.cb);
        // If there are results, call the callback for each individual result.
        if (aResults.length)
          aResults.forEach(callback, scope);
        // Otherwise, the query must be complete.
        else
          callback.call(scope, false);
      }
    }, Ci.nsIThread.DISPATCH_NORMAL);
  }
}


////////////////////////////////////////////////////////////////////////////////
//// ResultItem

function ResultItem(aResultRow, aQueryConfs){
  if (!(aResultRow instanceof Ci.mozIStorageRow))
    return;
  this.pageId = aResultRow.getResultByName("page_id");
  this.uri = aResultRow.getResultByName("page_url");
  this.title = aResultRow.getResultByName("page_title");
  let revHost = aResultRow.getResultByName("rev_host");
  this.host = revHost ? revHost.split("").reverse().join("").substr(1) : "";
  this.accessCount = aResultRow.getResultByName("visit_count");
  // TODO: if there is a time constraint time should be the last visit in
  // that time instead.
  this.time = new Date(aResultRow.getResultByName("visit_date")/1000);
  this.icon = aResultRow.getResultByName("icon_url");
  this.sessionId = aResultRow.getResultByName("session");
  this.itemId = aResultRow.getResultByName("item_id");
  this.isBookmarked = !!this.itemId;
  this.dateAdded = new Date(aResultRow.getResultByName("dateAdded")/1000);
  this.lastModified = new Date(aResultRow.getResultByName("lastModified")/1000);
  this.parentId = aResultRow.getResultByName("parent_id");
  let tags = aResultRow.getResultByName("tags");
  this.tags = tags ? tags.split(TAGS_SEPARATOR) : [];
  this.bookmarkIndex = aResultRow.getResultByName("position");
  this.frecency = aResultRow.getResultByName("frecency");
  this.visitId = aResultRow.getResultByName("visit_id");
  this.referringVisitId = aResultRow.getResultByName("from_visit");
  this.referringUri = aResultRow.getResultByName("from_visit_uri");
  this.transitionType = aResultRow.getResultByName("visit_type");
  let itemType = aResultRow.getResultByName("item_type");
  this.type = getNodeType(this, itemType);
  this.readableType = getReadableItemType(this, itemType);

  let currentResult = this;
  // Index of the query that generated this result.

  XPCOMUtils.defineLazyGetter(this, "query", function() {
    if (currentResult.readableType != "container")
      throw new Error("Cannot get query for a non container.");

    if (currentResult.type == Ci.nsINavHistoryResultNode.RESULT_TYPE_QUERY) {
      // PlacesQuery can deserialize most place: uris.
      // This is not completely correct, since options from the place: uri and
      // current ones should be merged.
      return new PlacesQuery(currentResult.uri);
    }

    if (currentResult.type == Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER) {
      let queryConfs = [].concat(aQueryConfs);
      queryConfs.forEach(function(aQueryConf) {
        aQueryConf.bookmarked.folder = currentResult.itemId;
      });
      return new PlacesQuery(queryConfs);
    }

    throw new Error("Cannot get query for this kind of container.");
  });
}

ResultItem.prototype = {}
