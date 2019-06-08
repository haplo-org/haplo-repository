/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


if(O.featureImplemented("hres:doi")) { P.use("hres:doi"); }

P.implementService("hres:orcid:integration:authenticated_scopes:discover", function(scopes) {
    scopes.push("/activities/update");
});

// ------------ System triggers for pushing output records to ORCID ---------

var pushDataToORCIDForUser = function(user, object) {
    O.service("hres:orcid:integration:push_data", user, {
        kind: "work",     // Update single record
        identifier: object.ref.toString(),
        xml: getXMLDocumentForObject(object)
    });
};

var deleteRecordFromORCIDForUser = function(user, object) {
    O.service("hres:orcid:integration:delete", user, {
        kind: "work",
        identifier: object.ref.toString()
    });
};

P.hook("hPostObjectChange", function(response, object, operation, previous) {
    if(O.service("hres:repository:is_repository_item", object) &&
        object.labels.includes(Label.AcceptedIntoRepository)) {
        // Update to existing object - needs possible deletion logic
        if(previous) {
            [A.Author, A.Editor].forEach((desc) => {
                // Trigger an update to ORCID outputs record for deposited records, for all
                // contributors with an active user account
                object.every(desc, (v,d,q) => {
                    let user = O.user(v);
                    if(user && user.isActive) {
                        if(object.labels.includes(Label.DELETED) && !previous.labels.includes(Label.DELETED)) {
                            deleteRecordFromORCIDForUser(user, object);
                        } else {
                            pushDataToORCIDForUser(user, object);
                        }
                    }
                });
                // Delete from records of removed contributors
                // Note won't be called when the object is deleted.
                if(!object.valuesEqual(previous, desc)) {
                    previous.every(desc, (v,d,q) => {
                        let user = O.user(v);
                        if(user && user.isActive && !object.has(v,d,q)) {
                            deleteRecordFromORCIDForUser(user, object);
                        }
                    });
                }
            });
        } else { // Newly created object, probably from import since it's already been AcceptedIntoRepository
            [A.Author, A.Editor].forEach((desc) => {
                // Trigger an update to ORCID for all contributors with an active user account
                object.every(desc, (v,d,q) => {
                    let user = O.user(v);
                    if(user && user.isActive) {
                        pushDataToORCIDForUser(user, object);
                    }
                });
            });
        }
    }
});

P.implementService("hres:orcid:integration:obtained_orcid", function(user, orcid) {
    // TODO: Use the bulk /works endpoint
    O.service("hres:repository:store_query").
        link(user.ref).
        allLabels([Label.AcceptedIntoRepository]).
        execute().
        each((object) => { pushDataToORCIDForUser(user, object); });
});

// -------------- Data transforms -----------------------------------------

// Note ORCID has about twice this number of output categories, which we don't map to
// Plan: Only update type when syncing from ORCID if object type isn't any of those in the array
var ORCID_TYPE_MAP = {
    "artistic-performance": [T.Composition, T.Performance],
    "book-chapter": [T.BookChapter],
    "book": [T.Book],
    "conference-paper": [T.ConferencePaper, T.ConferenceItem],
    "conference-poster": [T.ConferencePoster],
    "dissertation": [T.Thesis],
    "invention": [T.Design],
    "journal-article": [T.JournalArticle],
    "lecture-speech": [T.Audio, T.ConferenceKeynote],
    "other": [T.Other, T.Artefact, T.DigitalOrVisualMedia, T.Exhibition, T.Video],
    "patent": [T.Patent],
    "report": [T.Report],
    "research-tool": [T.DevicesAndProducts],
    "website": [T.Website]
};
if("Dataset" in T) {
    ORCID_TYPE_MAP["data-set"] = [T.Dataset];
}

var getXMLDocumentForObject = function(object) {

    let singleElement = function(c, el, d) {
        let v = object.first(d);
        if(v) {
            let text = (O.isRef(v) ? v.load().title : v.toString());
            c.element(el).text(text).up();
        }
    };
    let addContributor = function(c, v, isAuthor, isFirst) {
        let contributor = c.element("contributor");
        let ref = O.service("hres:author_citation:get_ref_maybe", v);
        if(ref && ref.load().first(A.ORCID)) {
            let orcid = ref.load().first(A.ORCID);
            contributor.cursorWithNamespace("http://www.orcid.org/ns/common").
                element("contributor-orcid").
                    element("uri").text(P.ORCID.url(orcid)).up().
                    element("path").text(P.ORCID.asString(orcid)).up().
                    up();
        }
        contributor.
            element("credit-name").text(O.service("hres:author_citation:get_citation_text", v)).up().
            element("contributor-attributes").
                element("contributor-sequence").text(isFirst ? "first" : "additional").up().
                element("contributor-role").text(isAuthor ? "author" : "editor").up().
                up();
        c.up();
    };
    let addIdentifier = function(c, v, idType, data) {
        if(!data) { data = {}; }
        c.element("external-id").
            element("external-id-type").text(idType).up().
            element("external-id-value").text(data.value || v.toString()).up();
            if(data.url) {
                c.element("external-id-url").text(data.url).up();
            }
        c.element("external-id-relationship").text(!!data.isRelatedId ? "part-of" : "self").up().up();
    };

    let xmlDocument = O.xml.document();
    let work = xmlDocument.cursor().
        cursorSettingDefaultNamespace("http://www.orcid.org/ns/work").
        element("work").
            addNamespace("http://www.orcid.org/ns/common", "common").
            addSchemaLocation("http://www.orcid.org/ns/work", "/work-2.0.xsd").
            addSchemaLocation("http://www.orcid.org/ns/common", "/common-2.0.xsd");

    work.element("title");
    work.cursorWithNamespace("http://www.orcid.org/ns/common").
        element("title").text(object.firstTitle().toString()).up();
    work.up();
    singleElement(work, "journal-title", A.Journal);
    singleElement(work, "short-description", A.Abstract);
    
    // TODO: Structured citation goes here, when we have eg. Bibtex citation format support

    let exactType, kindOfType;
    _.each(ORCID_TYPE_MAP, (types, orcidString) => {
        _.each(types, (type) => {
            if(object.firstType == type) {
                exactType = orcidString;
            }
            if(object.isKindOf(type)) {
                kindOfType = orcidString;
            }
        });
    });
    work.element("type").text(exactType || kindOfType || "other").up();

    let common = work.cursorWithNamespace("http://www.orcid.org/ns/common");
    let published = O.service("hres:repository:earliest_publication_date", object);
    if(published) {
        let p = new XDate(published);
        common.element("publication-date").
            element("year").text(p.toString("yyyy")).up().
            element("month").text(p.toString("MM")).up().
            element("day").text(p.toString("dd")).up().
            up();
    }

    common.element("external-ids");
    if("DOI" in A && object.first(A.DOI)) {
        let doi = object.first(A.DOI);
        addIdentifier(common, doi, "doi", {
            value: P.DOI.asString(doi),
            url: P.DOI.url(doi)
        });
    }
    if("PubMedID" in A && object.first(A.PubMedID)) {
        addIdentifier(common, object.first(A.PubMedID), "pmid");
    }
    if(object.first(A.ISSN)) {
        addIdentifier(common, object.first(A.ISSN), "issn", {isRelatedId:true});
    }
    if(object.first(A.ISBN)) {
        addIdentifier(common, object.first(A.ISBN), "isbn", {isRelatedId: object.isKindOf(T.BookChapter)});
    }
    addIdentifier(common, object.url(true), "source-work-id");

    if(object.first(A.Url)) {
        work.element("url").text(object.first(A.Url)).up();
    }

    work.element("contributors");
    let first = true;
    object.every(A.AuthorsCitation, (v,d,q) => {
        addContributor(work, v, true, first);
        first = false;
    });
    object.every(A.EditorsCitation, (v,d,q) => {
        addContributor(work, v, false, first);
        first = false;
    });
    work.up();

    return xmlDocument;
};
