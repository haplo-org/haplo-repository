/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

if(O.featureImplemented("hres:doi")) {
    P.use("hres:doi");
}

var properties;
var propertiesForType;

var ensureProperties = function() {
    if(properties) { return; }
    properties = {
        "authors": {key:"authors"},
        "year": {after:'"."', key:"year"},
        "chapter_title": {after:'" in:"', key:"title"},
        "book_title": {desc:A.BookTitle},
        "title": {before:"<i>", after:"</i>", key:"title"},
        "title_no_italic": {key:"title"},
        "editors": {key:"editors", after:'" (ed.)"'},
        "event_title": {before:"<i>", after:'"."</i>', desc:A.Event},
        "event_location": {key:"event_location"},
        "event_dates": {key:"event_dates"},
        "place_of_pub": {desc:A.PlaceOfPublication},
        "publisher": {after:'"."', desc:A.Publisher},
        "journal": {before:"<i>", after:'"."</i>', desc:A.Journal},
        "journal_citation": {after:'"."', desc:A.JournalCitation},
        "pagerange": {before: '"pp. "', desc:A.PageRange},
        "issn": {desc:A.Issn},
        // DOIs frequently overflow in publications this gives them a selector so that can be handled
        "doi": {key:"doi", before: "<span class=\"citation-doi\">", after:"</span>" },
        "patent_id": {desc:A.PatentId},
        "type": {key:"type"},
        "institution": {desc:A.InstitutionName},
        "department": {desc:A.DepartmentName}
    };
    propertiesForType = O.refdictHierarchical();
    propertiesForType.set(T.Book, ["authors", "editors", "year", "title", "place_of_pub", "publisher"]);
    propertiesForType.set(T.BookChapter, ["authors", "year", "chapter_title", "editors", "book_title",
        "place_of_pub", "publisher", "pagerange"]);
    propertiesForType.set(T.JournalArticle, ["authors", "year", "title_no_italic", "journal",
        "journal_citation", "doi"]);
    propertiesForType.set(T.ConferenceItem, ["authors", "year", "title_no_italic", "editors",
        "event_title", "event_location", "event_dates", "place_of_pub", "publisher", "pagerange", "doi"]);
    propertiesForType.set(T.Report, ["authors", "year", "title", "place_of_pub", "publisher", "doi"]);
    propertiesForType.set(T.Artefact, ["authors", "year", "title", "place_of_pub", "publisher", "doi"]);
    propertiesForType.set(T.DigitalOrVisualMedia, ["authors", "year", "title", "place_of_pub", "doi"]);
    propertiesForType.set(T.Patent, ["authors", "year", "title", "patent_id"]);
    _.each([T.Performance, T.Exhibition], function(type) {
        propertiesForType.set(type, ["authors", "year", "title", "event_location", "event_dates", "doi"]);
    });
    propertiesForType.set(T.Thesis, ["authors", "year", "title", "type", "institution", "department", "doi"]);
    O.serviceMaybe("hres_bibliographic_reference:extend_reference_formats", properties, propertiesForType, Values);
};

var DEFAULT_PROPERTIES = ["authors", "year", "title", "place_of_pub", "publisher", "doi"];

// ---------------------------------------------------------------------------------------------------------------------

// As citations can be generated quite a few times when rendering a page, remove the
// service call overhead by caching an implementation function. This function replaces
// itself so that the callers don't need an if statement, at the expense of slightly
// less readable code.
var citationStringFromObject = function(a,b) {
    var fn = O.service("hres:author_citation:citation_string_from_object:as_function");
    citationStringFromObject = fn;
    return fn(a,b);
};

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
    return citationStringFromObject(this.object, A.AuthorsCitation);
});
Values.prototype.__defineGetter__("type", function() {
    return SCHEMA.getTypeInfo(this.object.firstType()).name;
});
Values.prototype.__defineGetter__("editors", function() {
    return citationStringFromObject(this.object, A.EditorsCitation);
});
Values.prototype.__defineGetter__("event_location", function() {
    var v = this.object.first(A.Event);
    if(!v || !O.isRef(v)) { return null; }
    var ev = v.load();
    // When importing the output may be saved with a preallocatedRef, which cannot be loaded
    if(!ev) { return null; }
    return ev.first(A.Location) ? ev.first(A.Location).toString() : null;
});
Values.prototype.__defineGetter__("event_dates", function() {
    var v = this.object.first(A.Event);
    if(!v || !O.isRef(v)) { return null; }
    var ev = v.load();
    // When importing the output may be saved with a preallocatedRef, which cannot be loaded
    if(!ev) { return null; }
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
Values.prototype.__defineGetter__("doi", function() {
    if("DOI" in A) {
        var v  = this.object.first(A.DOI);
        if(!v) { return null; }
        return v.toString();
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

var bibRefHtmlTemplateCache = {};

// TODO: Platform interface for on-the fly compliation of templates, requiring a privilege? Remove from developer.json when this is available.
// NOTE: Don't use this constructor elsewhere, it may be removed at any time.
var HaploTemplate = $HaploTemplate;

var bibRefHtmlDeferred = function(object) {
    ensureProperties();
    var values = new Values(object);
    var fields = propertiesForType.get(object.firstType()) || DEFAULT_PROPERTIES;
    var cacheKey = fields.join(',');
    var template = bibRefHtmlTemplateCache[cacheKey];
    if(!template) {
        var src = [];
        _.each(fields, function(f) {
            var instruction = properties[f];
            src.push(
                "ifContent() {\n",
                    instruction.before || '', "\n",
                    "markContent() {\n"
            );
                    if(instruction.desc) {
                        src.push('__OPTIMISE__:text:object-first-value:desc-int-as-string(object "'+instruction.desc+'")\n');
                    } else {
                        src.push("values."+instruction.key+"\n");
                    }
            src.push(
                    "}\n",
                    instruction.after || '',
                    '" "\n',
                "}\n"
            );
        });
        template = new HaploTemplate(src.join(''));
        bibRefHtmlTemplateCache[cacheKey] = template;
    }
    return template.deferredRender({object:object, values:values});
};

var bibRefHtml = function(object) {
    return bibRefHtmlDeferred(object).toString();   // use toString() rather than the 'proper' way to avoid unnnecessary code
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

P.implementService("hres_bibliographic_reference:for_object", function(object) {
    return bibRefHtmlDeferred(object);
});

P.implementService("hres_bibliographic_reference:for_object:as_function", function() {
    return bibRefHtmlDeferred;
});

P.implementService("hres_bibliographic_reference:plain_text_for_object", function(object) {
    return bibRefPlainText(object);
});
