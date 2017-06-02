/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var PROPERTIES = {
    "authors": {key:"authors"},
    "year": {after:".", key:"year"},
    "chapter_title": {after:" in:", key:"title"},
    "book_title": {desc:A.BookTitle},
    "title": {before:"<i>", after:"</i>", key:"title"},
    "titleNoItalic": {key:"title"},
    "editors": {key:"editors", after:" (ed.)"},
    "journal": {before:"<i>", after:".</i>", desc:A.Journal},
    "event_title": {before:"<i>", after:".</i>", desc:A.EventTitle},
    "event_location": {desc:A.EventLocation},
    "event_dates": {desc:A.EventDate},
    "place_of_pub": {desc:A.PlaceOfPublication},
    "publisher": {after:".", key:"publisher"},
    "publicationDate": {key:"publicationDate"},
    "journalCitation": {after:".", desc:A.JournalCitation},
    "pagerange": {before: "pp. ", desc:A.PageRange},
    "issn": {desc:A.Issn},
    "doi": {key:"doi"},
    "patentId": {key:"patentId"},
    "type": {key:"type"},
    "institution": {desc:A.InstitutionName},
    "department": {desc:A.DepartmentName}
};

var DEFAULT_PROPERTIES = ["authors", "year", "title", "place_of_pub", "publisher", "doi"];
var PROPERTIES_FOR_TYPE = O.refdictHierarchical();
PROPERTIES_FOR_TYPE.set(T.Book, ["authors", "editors", "year", "title", "place_of_pub", "publisher"]);
PROPERTIES_FOR_TYPE.set(T.BookChapter, ["authors", "year", "chapter_title", "editors", "book_title",
    "place_of_pub", "publisher", "pagerange"]);
PROPERTIES_FOR_TYPE.set(T.JournalArticle, ["authors", "year", "titleNoItalic", "journal",
    "publicationDate", "journalCitation"]);
PROPERTIES_FOR_TYPE.set(T.ConferenceItem, ["authors", "year", "titleNoItalic", "editors",
    "event_title", "event_location", "event_dates", "place_of_pub", "publisher", "publicationDate",
    "pagerange", "doi"]);
PROPERTIES_FOR_TYPE.set(T.Report, ["authors", "year", "title", "place_of_pub", "publisher", "doi"]);
PROPERTIES_FOR_TYPE.set(T.Artefact, ["authors", "year", "title", "place_of_pub", "publisher"]);
PROPERTIES_FOR_TYPE.set(T.Audio, ["authors", "year", "title", "place_of_pub"]);
PROPERTIES_FOR_TYPE.set(T.Video, ["authors", "year", "title", "place_of_pub"]);
PROPERTIES_FOR_TYPE.set(T.Patent, ["authors", "year", "title", "patentId"]);
_.each([T.Performance, T.Exhibition], function(type) {
    PROPERTIES_FOR_TYPE.set(type, ["authors", "year", "title", "event_location"]);
});
PROPERTIES_FOR_TYPE.set(T.Thesis, ["authors", "year", "title", "type", "institution", "department"]);

// ---------------------------------------------------------------------------------------------------------------------

var TITLE_ENDS_IN_PUNCTUATION = /[\.\?\!\;\:]\s*$/;

var Values = function(object) {
    this.object = object;
    var title = object.title || '????';
    this.title = title.match(TITLE_ENDS_IN_PUNCTUATION) ? title : title+'.';
};
Values.prototype.__defineGetter__('year', function() {
    var date = this.object.first(A.Date);
    return date ? date.start.getFullYear() : null;
});
Values.prototype.__defineGetter__('authors', function() {
    return O.service("hres:author_citation:citation_string_from_object", this.object, A.AuthorsCitation);
});
Values.prototype.__defineGetter__("type", function() {
    return SCHEMA.getTypeInfo(this.object.firstType()).name;
});
Values.prototype.__defineGetter__("editors", function() {
    return O.service("hres:author_citation:citation_string_from_object", this.object, A.EditorsCitation);
});
Values.prototype.__defineGetter__("publisher", function() {
    var v = this.object.first(A.Publisher);
    if(!v) { return null; }
    return O.isRef(v) ? v.load().title : v.toString();
});

// ---------------------------------------------------------------------------------------------------------------------

P.bibRefHtml = function(object) {
    var values = new Values(object);
    var html = [];
    var fields = PROPERTIES_FOR_TYPE.get(object.firstType()) || DEFAULT_PROPERTIES;
    _.each(fields, function(f) {
        var instruction = PROPERTIES[f];
        var value, desc = instruction.desc;
        if(desc) {
            var v = object.first(desc);
            if(v) {
                value = v.toString();
            }
        } else {
            value = values[instruction.key];
        }
        if(value) {
            html.push(
                instruction.before || '',
                _.escape(value),
                instruction.after || '',
                " "
            );
        }
    });
    return html.join('');
};

// ---------------------------------------------------------------------------------------------------------------------

_.each(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), function(type) {
    P.renderSearchResult(type, function(object, renderer) {
        renderer.html(P.bibRefHtml(object), "column", undefined, 3);
    });
});

// ---------------------------------------------------------------------------------------------------------------------

var GenericDeferredRender = $GenericDeferredRender; // developer.json needs deleting when this goes
P.implementService("hres_bibliographic_reference:for_object", function(object) {
    var html = P.bibRefHtml(object);
    return new GenericDeferredRender(function() { return html; });
});
