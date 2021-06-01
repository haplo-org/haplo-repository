/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var NOTES = {},
    ADDITIONAL_NOTES = {};

var _ensureNotes = function() {
    if(_.isEmpty(NOTES)) {
        NOTES[A.AuthorsCitation] = "authcite";
        NOTES[A.EditorsCitation] = "edcite";
        NOTES[A.PublicationDates] = "pubdt";
        NOTES[A.AcceptedAuthorManuscript] = "aam";
        NOTES[A.WebAddressUrl] = 'url';
        NOTES[A.Author] = 'author';
        if("RefUnitOfAssessment" in A) {
            NOTES[A["RefUnitOfAssessment"]] = 'refunit';
        }
        NOTES[A.File] = 'file';
        NOTES[A.Issn] = 'issn';
        NOTES[A.Isbn] = 'isbn';
        NOTES[A.Keywords] = 'keywords';
        NOTES[A.PageRange] = 'pagerange';
        if("PublicationProcessDates" in A) {
            NOTES[A.PublicationProcessDates] = 'processdates';
        }
    }
    if(_.isEmpty(ADDITIONAL_NOTES)) {
        O.serviceMaybe("hres:repository:add_object_editor_guidance", NOTES, ADDITIONAL_NOTES);
    }
};


var AUTHOR_ATTR_FIELDS = [A.Author, A.BookEditor];
// Hook into object editor to add the notes
P.hook('hObjectEditor', function(response, object) {
    _ensureNotes();
    if(O.serviceMaybe("hres:repository:is_repository_item", object)) {
        response.plugins.hres_repo_object_editor = {
            objType: object.firstType().toString(),
            notes:NOTES,
            authorAttrs:AUTHOR_ATTR_FIELDS,
            publisherAttr:A.Publisher,
            metadataKeys:P.REPOSITORY_METADATA_KEYS,
            additionalNotes: ADDITIONAL_NOTES
        };
        if(O.application.config["hres_repo_object_editor:lookup_publisher_and_journals_by_start"]) {
            response.plugins["hres_repo_object_editor_lookup_publishers"] = {"descs":[A.Publisher]};
            response.plugins["hres_repo_object_editor_lookup_journals"] = {"descs":[A.Journal]};
            P.template("include-journal-publisher-lookup-editor-plugin").render();
        }
        P.template("include_repo_editor_plugin").render();
    }
});

/*HaploDoc
node: repository/hres_repo_object_editor
title: Repository Object Editor
sort: 1
--

h2(service). "hres:repository:add_object_editor_guidance"

Implement this service to add additional guidance to the object editor (Or override default guidance).

h3(arguments). Arguments

Service takes two javascript object as argumens, @NOTES@ and @ADDITIONAL_NOTES@.

|@NOTES@|Is a map of attribute desc to a lookup key.|
|@ADDITIONAL_NOTES@|Is a map of lookup keys to guidance, which also allows this to overwrite default guidance.|

h3(usage). Usage: 

<pre>language=javascript
P.implementService("hres:repository:add_object_editor_guidance", function(NOTES, ADDITIONAL_NOTES) {
    NOTES[A.Title] = "title";
    ADDITIONAL_NOTES["title"] = "Some custom guidance text for the title";
    ADDITIONAL_NOTES["authcite"] = "Overwriting the default authors citation guidance text";
});
</pre>
*/

// --------------------------------------------------------------------------
// Lookup publisher/journal by start of name
// --------------------------------------------------------------------------

 var normalise = function(string) {
     return string.toLowerCase().replace(/[^a-z0-9]/g, "");
 };

 var _publisherTitleSearchCache;
 var _journalTitleSearchCache;
 var _populateCache = function(cache, type) {
     O.query().link(type, A.Type).sortByTitle().execute().each(function(object) {
         cache.push([
             normalise(object.title), [
                 object.ref.toString(),
                 object.title,
                 object.title
             ]
         ]);
     });
 };

 var _ensureCaches = function() {
     if(_journalTitleSearchCache && _publisherTitleSearchCache) { return; }
     _journalTitleSearchCache = [];
     _publisherTitleSearchCache = [];
     _populateCache(_journalTitleSearchCache, T.Journal);
     _populateCache(_publisherTitleSearchCache, T.Publisher);
 };

 P.hook("hPostObjectChange", function(response, object, operation, previous) {
     if(object.isKindOf(T.Journal) || object.isKindOf(T.Publisher)) {
         // Clear caches
         _journalTitleSearchCache = undefined;
         _publisherTitleSearchCache = undefined;
     }
 });

 var getTitleStartMatches = function(type, text) {
     _ensureCaches();
     const cache = (type == T.Journal) ? _journalTitleSearchCache : _publisherTitleSearchCache;
     const query = normalise(text);
     const results = [];
     for(let i = 0; i < cache.length; i++) {
         if(cache[i][0].startsWith(query)) {
             results.push(cache[i][1]);
         }
         if(results.length === 10) { break; }
     }
     return results;
 };

 var getJournalOrPublisherResponse = function(type, text) {
     const results = getTitleStartMatches(type, text);
     const resultRefs = _.pluck(results, "0");
     const length = results.length;
     if(length < 10) {
        const queryString = _.map(text.split(/\s+/), (word) => word+"*").join(" ");
         O.query().
             link(type, A.Type).
             freeText(queryString, A.Title).
             sortByTitle().
             // Double the results length to ensure no duplicates falling back to 10 if there are none
             limit(length*2 || 10).
             execute().
             each((object) => {
                if(_.contains(resultRefs, object.ref.toString())) { return; }
                 results.push([
                     object.ref.toString(),
                     object.title,
                     object.title
                 ]);
                 return results.length === 10; // Ends iteration at maximum number of results
             });
     }
     return results;
 };

 P.respond("GET", "/api/hres-repo-object-editor/lookup-journal", [
     {parameter:"text", as:"string"}
 ], function(E, text) {
     const response = getJournalOrPublisherResponse(T.Journal, text);
     E.response.body = JSON.stringify(response);
     E.response.kind = "json";
 });

 P.respond("GET", "/api/hres-repo-object-editor/lookup-publisher", [
     {parameter:"text", as:"string"}
 ], function(E, text) {
     const response = getJournalOrPublisherResponse(T.Publisher, text);
     E.response.body = JSON.stringify(response);
     E.response.kind = "json";
 });
