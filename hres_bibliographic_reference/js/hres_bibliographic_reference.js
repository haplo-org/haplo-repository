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
    "event_title": {before:"<i>", after:".</i>", key:"event"},
    "event_location": {key:"event_location"},
    "event_dates": {key:"event_dates"},
    "place_of_pub": {desc:A.PlaceOfPublication},
    "publisher": {after:".", key:"publisher"},
    "journal": {before:"<i>", after:".</i>", key:"journal"},
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
Values.prototype.__defineGetter__("journal", function() {
    var v = this.object.first(A.Journal);
    if(!v) { return null; }
    return O.isRef(v) ? v.load().title : v.toString();
});
Values.prototype.__defineGetter__("event", function() {
    var v = this.object.first(A.Event);
    if(!v) { return null; }
    return O.isRef(v) ? v.load().title : v.toString();
});
Values.prototype.__defineGetter__("event_location", function() {
    var v = this.object.first(A.Event);
    if(!v || !O.isRef(v)) { return null; }
    var ev = v.load();
    return ev.first(A.Location) ? ev.first(A.Location).toString() : null;
});
Values.prototype.__defineGetter__("event_dates", function() {
    var v = this.object.first(A.Event);
    if(!v || !O.isRef(v)) { return null; }
    var ev = v.load();
    var d = ev.first(A.EventDate);
    if(!d) { return null; }
    if(O.typecode(d) === O.T_DATETIME) {
        if(d.specifiedAsRange) {
            return dateRangeAsCitationString(d.start, d.end, d.precision);
        } else {
            return (new XDate(d.start)).toString(precisionFormatString(d.precision));
        }
    } else {
        return d.toString();
    }
});
var dateRangeAsCitationString = function(start, end, precision) {
    // Don't repeat same information. eg. "27 - 29 Jun 2017", not "27 Jun 2017 - 29 Jun 2017"
    var formatString = precisionFormatString(precision);
    switch(precision) {
        case O.PRECISION_YEAR:
            break;
        case O.PRECISION_MONTH:
            if(start.getFullYear() === end.getFullYear()) {
                formatString = formatString.replace("yyyy", '');
            }
            break;
        default:
            // Dateranges end the first millisecond of the day *after* the range, so first adjust for that
            end.setDate(end.getDate()-1);
            if(start.getFullYear() === end.getFullYear()) {
                formatString = formatString.replace("yyyy", '');
            }
            if(start.getMonth() === end.getMonth()) {
                formatString = formatString.replace("MMM", '');
            }
            break;
    }
    return (new XDate(start)).toString(formatString.trim())+" - "+
        (new XDate(end)).toString(precisionFormatString(precision));
};
var precisionFormatString = function(precision) {
    switch(precision) {
        case O.PRECISION_MONTH:
            return "MMM yyyy";
        case O.PRECISION_YEAR:
            return "yyyy";
        default:
            return "dd MMM yyyy";
    }
};

// ---------------------------------------------------------------------------------------------------------------------

 var bibRefHtml = function(object) {
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

var bibRefPlainText = function(object) {
    return bibRefHtml(object).replace(/<.*?>/g, '');
};

// ---------------------------------------------------------------------------------------------------------------------

_.each(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), function(type) {
    P.renderSearchResult(type, function(object, renderer) {
        renderer.html(bibRefHtml(object), "column", undefined, 3);
    });
});

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.fact("citation",     "text",     "Citation");
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    row.citation = bibRefPlainText(object);
});

P.implementService("std:reporting:dashboard:repository_overview:setup_export", function(dashboard) {
    dashboard.columns(5, ["citation"]);
});

P.implementService("std:reporting:dashboard:outputs_in_progress:setup_export", function(dashboard) {
    dashboard.columns(5, ["citation"]);
});

// ---------------------------------------------------------------------------------------------------------------------

var GenericDeferredRender = $GenericDeferredRender; // developer.json needs deleting when this goes
P.implementService("hres_bibliographic_reference:for_object", function(object) {
    var html = bibRefHtml(object);
    return new GenericDeferredRender(function() { return html; });
});

P.implementService("hres_bibliographic_reference:plain_text_for_object", function(object) {
    return bibRefPlainText(object);
});
