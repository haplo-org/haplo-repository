/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// <meta> tags in page <head> provide useful information for search engines and other repository software.
//
// 1) Implement template function to easily include them in the repository custom layout.
//
// 2) Extensible way for other metadata providers to add additional tags through
//    hres:repository:common:gather-meta-tags service.
//
// This plugin implements the Dublin Core metadata terms.
//     http://dublincore.org/documents/2008/08/04/dc-html/
// Note that qualifiers are ignored, because DC recommendation don't ask for them (and see document history, no longer mentions qualifed DC).


P.globalTemplateFunction("hres:repository:common:html-meta-tags", function(context) {
    if(context.object && context.object.isKindOfTypeAnnotated("hres:annotation:repository-item")) {
        var tags = generateMetaTagsForObject(context);
        this.render(P.template("html-meta-tags").deferredRender(tags));
    }
});

// -------------------------------------------------------------------------

var generateMetaTagsForObject = function(context) {
    var object = context.object.restrictedCopy(O.currentUser);
    var publication = context.publication;
    var links = [
        {rel:"schema.DC", href:"http://purl.org/dc/elements/1.1/"},
        {rel:"schema.DCTERMS", href:"http://purl.org/dc/terms/"}
    ];
    // Always include a the canonocial pulished URL to this object.
    var tags = [{name:"DC.relation", content:context.publishedObjectUrl(object)}];

    var attribute = function(desc, name) {
        object.every(desc, function(v,d,q) {
            if(O.isRef(v)) {
                var o = v.load();
                tags.push({name:name, content:o.title});
            } else if(O.typecode(v) === O.T_DATETIME) {
                var start = v.start, content;
                if(v.precision === O.PRECISION_YEAR) {
                    content = ""+start.getFullYear();
                } else if(v.precision === O.PRECISION_MONTH) {
                    content = _.sprintf("%04d-%02d", start.getFullYear(), start.getMonth()+1);
                } else {
                    content = _.sprintf("%04d-%02d-%02d", start.getFullYear(), start.getMonth()+1, start.getDate());
                }
                tags.push({name:name, scheme:"DCTERMS.W3CDTF", content:content});
            } else {
                tags.push({name:name, content:v.toString()});
            }
        });
    };
    var attributeWithFallback = function(desc, name, fallbackDesc) {
        attribute(object.first(desc) ? desc : fallbackDesc, name);
    };

    attribute(A.Title, "DC.title");
    attributeWithFallback(A.AuthorsCitation, "DC.creator", A.Author);
    attributeWithFallback(A.EditorsCitation, "DC.contributor", A.Editor);
    if("Contributors" in A) {
        attribute(A.Contributors, "DC.contributor");
    }
    attribute(A.Date, "DC.date");
    attribute(A.Publisher, "DC.publisher");
    attribute(A.Type, "DC.type");
    object.every((v,d,q) => {
        if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
            tags.push({
                name: "DC.identifier",
                content: publication.urlForFileDownload(v)
            });
        }
    });
    tags.push({
        name: "DC.identifier",
        content: O.service("hres_bibliographic_reference:plain_text_for_object", object)
    });

    // DCTERMS tags
    let publishedDate =  O.serviceMaybe("hres:repository:earliest_publication_date", object);
    if(publishedDate) {
        tags.push({
            name: "DCTERMS.issued",
            content: new XDate(publishedDate).toString("yyyy-MM-dd")
        });
    }

    // "Non-standard tags" requested by Google Scholar
    // "Dublin Core equivalents are DC.relation.ispartof for journal and conference titles and the
    // non-standard tags DC.citation.volume, DC.citation.issue, DC.citation.spage (start page), 
    // and DC.citation.epage (end page) for the remaining fields
    //     https://scholar.google.com/intl/en/scholar/inclusion.html#indexing  (accessed 2018-09-05)
    var pageRageValues = function(string) {
        let split = string.split("-");   // Values are free text - best guess
        if(split.length > 1) {
            tags.push({ name:"DC.citation.spage", content:split[0].trim() });
            tags.push({ name:"DC.citation.epage", content:split[1].trim() });
        }
    };
    attribute(A.Journal, "DC.relation.ispartof");
    attribute(A.Event, "DC.relation.ispartof");
    let v = object.first(A.JournalCitation);
    if(v && O.isPluginTextValue(v, "hres:journal_citation")) {
        let fields = v.toFields().value;
        if(fields.volume) {
            tags.push({ name:"DC.citation.volume", content:fields.volume });
        }
        if(fields.number) {
            tags.push({ name:"DC.citation.issue", content: fields.number });
        }
        if(fields.pageRange) {
            pageRageValues(fields.pageRange);
        }
    }
    if(object.first(A.PageRange)) {
        pageRageValues(object.first(A.PageRange).toString());
    }

    O.serviceMaybe("hres:repository:common:gather-meta-tags", {
        object: object, // restricted version of object
        context: context,
        // Direct modification
        links: links,
        tags: tags,
        // Functions for adding attributes from object
        attribute: attribute
    });

    return {links:links, tags:tags};
};
