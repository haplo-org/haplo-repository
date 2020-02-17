/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var rioxxTypeList = O.refdictHierarchical();
rioxxTypeList.set(T.Book, "Book");
rioxxTypeList.set(T.BookChapter, "Book chapter");
rioxxTypeList.set(T.ConferenceItem, "Conference Paper/Proceeding/Abstract");
rioxxTypeList.set(T.JournalArticle, "Journal Article/Review");
rioxxTypeList.set(T.Patent, "Technical Standard");
rioxxTypeList.set(T.Report, "Working paper");
rioxxTypeList.set(T.Thesis, "Thesis");

P.implementService("hres:repository:rioxx:write-store-object-below-xml-cursor", function(item, cursor, options) {
    writeObjectAsRIOXXXML(item, cursor, options);
});

P.implementService("hres:repository:rioxx:export-object-as-binary-data", function(item) {
    let xmlDocument = O.xml.document();
    let cursor = xmlDocument.cursor().
        element("rioxx");
    writeObjectAsRIOXXXML(item, cursor);
    return O.binaryData(xmlDocument.toString(), {
        filename: item.title+"_rioxx.xml",
        mimeType: "application/xml"
    });
});

P.implementService("hres:repository:rioxx:export-object-as-binary-data-multiple", function(items) {
    let xmlDocument = O.xml.document();
    let cursor = xmlDocument.cursor().
        element("rioxx");
    _.each(items, item => {
        writeObjectAsRIOXXXML(item, cursor);
    });
    return O.binaryData(xmlDocument.toString(), {
        filename: "search_export_rioxx.xml",
        mimeType: "application/xml"
    });
});

var writeObjectAsRIOXXXML = function(item, cursor, options) {

    let element = function(v) {
        return (O.isRef(v) ? v.load().title : v.toString());
    };
    let simpleElement = function(c, desc, elementName, modifyElement) {
        item.every(desc, function(v,d,q) {
            c.element(elementName).text(element(v));
            if(modifyElement) { modifyElement(c, v); }
            c.up();
        });
    };
    let addPersonORCIDid = function(c, v) {
        let ref = O.service("hres:author_citation:get_ref_maybe", v);
        if(ref) {
            let person = ref.load();
            if(person.first(A.ORCID)) {
                c.attribute("id", P.ORCID.url(person.first(A.ORCID)));
            }
        }
    };

    // This service is passed a restricted copy of the item. This should be used where we don't explicitly need to
    // know about possibly restricted attributes, such as publisher's versions of files, where there may be embargoes. 
    // In those cases, use the urestricted item.
    let unrestrictedItem = item.ref.load();

    // rioxxterms elements
    let rioxxterms = cursor.
        addNamespace("http://www.rioxx.net/schema/v2.0/rioxxterms/", "rioxxterms", "http://www.rioxx.net/schema/v2.0/rioxx/rioxxterms.xsd").
        cursorWithNamespace("http://www.rioxx.net/schema/v2.0/rioxxterms/");
    simpleElement(rioxxterms, A.AuthorsCitation, "author", addPersonORCIDid);
    simpleElement(rioxxterms, A.EditorsCitation, "contributor", addPersonORCIDid);
    // TODO: rioxxterms:apc
    // TODO: rioxxterms:project
    simpleElement(rioxxterms, A.Date, "publication_date");
    rioxxterms.
        element("type").
        text(rioxxTypeList.get(item.firstType()) || "Other").
        up();
    let version = "NA";
    if(!!unrestrictedItem.getAttributeGroupIds(A.PublishersVersion).length) {
        version = "VoR";
    } else if(!!unrestrictedItem.getAttributeGroupIds(A.AcceptedAuthorManuscript).length) {
        version = "AM";
    }
    rioxxterms.element("version").text(version).up();
    if(item.first(A.DOI)) {
        rioxxterms.
            element("version-of-record").
            text(P.DOI.asString(item.first(A.DOI))).
            up();
    }

    // dc elements
    O.service("hres:repository:dc:write-store-object-below-xml-cursor", item, cursor, options);

    // dcterms elements. Only dateAccepted mandated by the RIOXX schema
    let dcterms = cursor.
        addNamespace("http://purl.org/dc/terms/", "dcterms", "http://dublincore.org/schemas/xmls/qdc/dcterms.xsd").
        cursorWithNamespace("http://purl.org/dc/terms/");
    if(item.first(A.PublicationProcessDates, Q.Accepted)) {
        dcterms.
            element("dateAccepted").
            text(new XDate(item.first(A.PublicationProcessDates, Q.Accepted).start).toString("yyyy-MM-dd")).
            up();
    }

    // ali elements
    let ali = cursor.
        addNamespace("http://ali.niso.org/2014/ali/1.0", "ali", "http://www.rioxx.net/schema/v2.0/rioxx/ali.xsd").
        cursorWithNamespace("http://ali.niso.org/2014/ali/1.0");
    if(O.serviceImplemented("hres_repo_embargoes:get_embargo")) {
        let embargoes = O.service("hres_repo_embargoes:get_embargo", item);
        let embargoEnd;
        if(embargoes && embargoes.length) {
            embargoes.each((row) => {
                if(row.end) {
                    if(!embargoEnd || row.end > embargoEnd) {
                        embargoEnd = row.end;
                    }
                }
            });
            if(embargoEnd) {
                ali.element("free_to_read").attribute("start_date", new XDate(embargoEnd).toString("yyyy-MM-dd")).up();
            }
            embargoes.each((embargo) => {
                ali.
                    element("license_ref").
                    attribute("start_date", new XDate(embargo.start).toString("yyyy-MM-dd")).
                    text(embargo.licenseURL || "http://www.rioxx.net/licenses/under-embargo-all-rights-reserved").
                    up();
            });
        }
        let start = embargoEnd || O.service("hres:repository:earliest_publication_date", item);
        if(start) {
            ali.
                element("license_ref").
                attribute("start_date", new XDate(start).toString("yyyy-MM-dd")).
                text(item.first(A.License) ? element(item.first(A.License)) : "http://www.rioxx.net/licenses/all-rights-reserved").
                up();
        }
    } else {
        let hasExposedFiles = false;
        item.restrictedCopy(O.currentUser).every(function(v,d,q) {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) { hasExposedFiles = true; }
        });
        if(hasExposedFiles) {
            ali.element("free_to_read").up();
        }
    }
};
