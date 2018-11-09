/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// --------------------------------------------------------------------------

// Provide DataCite OAI-PMH interface. Records are wrapped with some further metadata
P.implementService("hres:repository:datacite:oai-pmh:write-store-object-below-xml-cursor", function(item, cursor, options) {
    cursor.
        element("schemaVersion").text("4.0").up().  // The datacite schmema version implemented here
        // TODO: Add datacentreSymbol - from the specification: "The symbol of the datacentre that registered this record."
        // For a UK institution this will look something like BL.NAME
        // Might need to restrict records in this format to objects where the DOI has been minted by this repository
        // element("datacentreSymbol").text("TODO").up().
        element("payload");
    writeObjectAsDataciteXML(item, cursor, options);
    cursor.up();
});

// Convert from StoreObject to DataCite XML
P.implementService("hres:repository:datacite:write-store-object-below-xml-cursor", function(item, cursor, options) {
    writeObjectAsDataciteXML(item, cursor, options);
});

var writeObjectAsDataciteXML = function(item, cursor, options) {
    var resource = cursor.
        cursorSettingDefaultNamespace("http://datacite.org/schema/kernel-4").
        element("resource").
        addSchemaLocation("http://datacite.org/schema/kernel-4", "http://schema.datacite.org/meta/kernel-4/metadata.xsd");

    var simpleElement = function(desc, elementName, modifyElement) {
        item.every(desc, function(v,d,q) {
            var str;
            if(O.isRef(v)) {
                str = v.load().title;
            } else if(P.DOI.isDOI(v)) {
                str = P.DOI.asString(v);
            } else {
                str = v.toString();
            }
            resource.element(elementName).text(str);
            if(modifyElement) { modifyElement(resource, v); }
            resource.up();
        });
    };

    var elementMaybe = function(descStr, elementName, modifyElement) {
        if(descStr in A) {
            simpleElement(A[descStr], elementName, modifyElement);
        }
    };

    var personElement = function(desc, elementPrefix, modifyElement) {
        item.every(desc, function(v,d,q) {
            resource.element(elementPrefix);
            var ref, personName;
            if(O.isRef(v)) {
                ref = v;
            } else {
                personName = O.service("hres:author_citation:get_citation_text", v);
                if(personName) {
                    ref = O.service("hres:author_citation:get_ref_maybe", v);
                }
            }
            if(personName) {
                resource.element(elementPrefix+"Name").text(personName).up();
            }
            if(ref) {
                var o = ref.load();
                var title = o.firstTitle();
                if(O.typecode(title) === O.T_TEXT_PERSON_NAME) {
                    var fields = o.firstTitle().toFields();
                    if(!personName) {
                        resource.element(elementPrefix+"Name").text(fields.last+", "+fields.first).up();
                    }
                    if(fields.first) { resource.element("givenName").text(fields.first).up(); }
                    if(fields.last) { resource.element("familyName").text(fields.last).up(); }
                } else {
                    if(!personName) {
                        resource.element(elementPrefix+"Name").text(o.title).up();
                    }
                }
                o.each(A.ORCID, function(v,d,q) {
                    resource.element("nameIdentifier").
                        attribute("schemeURI", "http://orcid.org/").
                        attribute("nameIdentifierScheme", "ORCID").
                        text(v.toString()).
                        up();
                });
                o.each(A.ResearchInstitute, function(v,d,q) {
                    resource.element("affiliation").
                        text(v.load().title).
                        up();
                });
            }
            if(modifyElement) { modifyElement(resource, v); }
            resource.up();
        });
    };

    simpleElement(A.DOI, "identifier", function(c, v) {
        if(P.DOI.isDOI(v)) {
            c.attribute("identifierType", "DOI");
        }
    });

    simpleElement(A.Type, "resourceType", function(c, v) {
        let t;
        _.each(RESOURCE_TYPE_GENERAL, (types, resourceTypeGeneral) => {
            _.each(types, (type) => { if(item.isKindOf(type)) { t = resourceTypeGeneral; } });
        });
        c.attribute("resourceTypeGeneral", t || "Text");
    });

    resource.element("creators");
    personElement(A.AuthorsCitation, "creator");
    resource.up();

    resource.element("titles");
    simpleElement(A.Title, "title");
    resource.up();

    simpleElement(A.Publisher, "publisher");
    simpleElement(A.Date, "publicationYear");
    resource.element("subjects");
    elementMaybe("Keywords", "subject");
    resource.up();

    resource.element("contributors");
    personElement(A.EditorsCitation, "contributor", function(c, v) {
        c.attribute("contributorType", "Editor");
    });
    resource.up();

    if("PublicationProcessDates" in A) {
        if(item.first(A.PublicationProcessDates, Q.Accepted)) {
            resource.element("dates");
            resource.element("date").
                attribute("dateType", "Accepted").
                text(new XDate(item.first(A.PublicationProcessDates, Q.Accepted).start).toString("yyyy-MM-dd")).
                up();
            resource.up();
        }
    }

    resource.element("alternateIdentifiers");
    resource.element("alternateIdentifier").
        attribute("alternateIdentifierType", "HaploRef").
        text(item.ref.toString()).
        up();
    resource.up();

    resource.element("rightsList");
    elementMaybe("License", "rights");
    resource.up();
    resource.element("descriptions");
    elementMaybe("Abstract", "description", function(c, v) {
        c.attribute("descriptionType", "Abstract");
    });
    resource.up();

};

var mapToTypesMaybe = function(typeStrings) {
    return _.compact(_.map(typeStrings, (str) => {
        if(str in T) { return T[str]; }
    }));
};
// Using the default repository schema. This is not guaranteed to be installed, to allow applications 
// to use different schemas if required
var RESOURCE_TYPE_GENERAL = {
    "Audiovisual": mapToTypesMaybe(["DigitalOrVisualMedia", "Video"]),
    "Dataset": mapToTypesMaybe(["Dataset"]),
    "Event": mapToTypesMaybe(["Exhibition", "Performance"]),
    "InteractiveResource": mapToTypesMaybe(["Website", "OnlineEducationalResource"]),
    "Model": mapToTypesMaybe(["Design"]),
    "PhysicalObject": mapToTypesMaybe(["Artefact", "DevicesAndProducts"]),
    "Software": mapToTypesMaybe(["Software"]),
    "Sound": mapToTypesMaybe(["Audio", "Composition"]),
    "Text": mapToTypesMaybe(["JournalArticle", "Book", "BookChapter", "ConferenceItem", "Patent", "Report", "Thesis"])
};


// --------------------------------------------------------------------------
// Convert from DataCite XML to StoreObject

P.implementService("hres:repository:datacite:apply-xml-to-object", function(xml, object) {
    let cursor = xml.cursor();
    if(!cursor.firstChildElementMaybe("resource")) { return; }
 
    var applyPerson = function(c, elementPrefix, desc) {   
        let name = {};
        if(c.firstChildElementMaybe("givenName")) {
            name.first = c.getText();
            c.up();
            c.firstChildElementMaybe("familyName");
            name.last = c.getText();
            c.up();
        } else {
            c.firstChildElementMaybe(elementPrefix+"Name");
            let s = c.getText().split(",");
            name.first = s[1].trim();
            name.last = s[0].trim();
            c.up();
        }
        if(c.firstChildElementMaybe("nameIdentifier")) {
            if(c.getAttribute("nameIdentifierScheme") === "ORCID") {
                let orcid = P.ORCID.create(c.getText());
                let q = O.query().identifier(orcid, A.ORCID).execute();
                let person;
                if(q.length) {
                    person = q[0];
                } else {
                    person = O.object();
                    person.appendType(T.ExternalResearcher);
                    person.appendTitle(O.text(O.T_TEXT_PERSON_NAME, name));
                    person.append(orcid, A.ORCID);
                    O.withoutPermissionEnforcement(() => {
                        person.save();
                    });
                }
                O.service("hres:author_citation:append_citation_to_object", object, desc, null, {object: person});
            }
            c.up();
        } else {
            O.service("hres:author_citation:append_citation_to_object", object, desc, null, name);
        }
    };

    // DOI
    if(!cursor.firstChildElementMaybe("identifier")) { return; }
    if(cursor.getAttribute("identifierType") !== "DOI") { return; }
    object.append(P.DOI.create(cursor.getText()), A.DOI);
    cursor.up();
    // Titles
    if(cursor.firstChildElementMaybe("titles")) {
        cursor.eachChildElement("title", (c) => object.appendTitle(c.getText()));
        cursor.up();
    }
    // Creators
    if(cursor.firstChildElementMaybe("creators")) {
        cursor.eachChildElement("creator", (c) => {
            applyPerson(c, "creator", A.Author);
        });
        cursor.up();
    }
    // Publisher
    if(cursor.firstChildElementMaybe("publisher")) {
        let text = cursor.getText();
        if(text && ("Publisher" in T)) {
            let q = O.query().link(T.Publisher, A.Type).freeText(text).execute();
            if(q.length) {
                object.append(q[0].ref, A.Publisher);
            } else {
                object.append(O.text(O.T_TEXT, text), A.Publisher);
            }
        }
        cursor.up();
    }
    // Year
    if(cursor.firstChildElementMaybe("publicationYear")) {
        let publicationYear = cursor.getText();
        if(publicationYear.match(/^\d+$/)) {
            var dt = O.datetime(new Date(parseInt(publicationYear,10),0), undefined, O.PRECISION_YEAR);
            object.append(dt, A.Date);
        }
        cursor.up();
    }
    // Type
    if(cursor.firstChildElementMaybe("resourceType")) {
        let type;
        let resourceType = cursor.getText().toLowerCase();
        if(("JournalArticle" in T) && resourceType.match(/journal\s*article/)) {
            type = T.JournalArticle;
        } else if(("BookChapter" in T) && resourceType.match(/book\s*chapter/)) {
            type = T.BookChapter;
        } else if(("ConferenceItem" in T) && -1 !== resourceType.indexOf("conference")) {
            type = T.ConferenceItem;
        } else if(("Book" in T) && -1 !== resourceType.indexOf("book")) {
            type = T.Book;
        }
        if(!type) {
            let resourceTypeGeneral = cursor.getAttribute("resourceTypeGeneral");
            if(resourceTypeGeneral) {
                // Note: Since this is a one-to-many mapping, we pick the most likely from an ordered list
                type = RESOURCE_TYPE_GENERAL[resourceTypeGeneral][0];
            }
        }
        if(type) {
            object.append(type, A.Type);
        }
        cursor.up();
    }

    if(cursor.firstChildElementMaybe("descriptions")) {
        // Abstract
        cursor.eachChildElement((c) => {
            if(c.getAttribute("descriptionType") === "Abstract" && ("Abstract" in A)) {
                object.append(O.text(O.T_TEXT_MULTILINE, c.getText()), A.Abstract);
            }
        });
        cursor.up();
    }

    if(cursor.firstChildElementMaybe("dates")) {
        cursor.eachChildElement((c) => {
            if(c.getAttribute("dateType") === "Accepted" && ("PublicationProcessDates" in A)) {
                object.append(new XDate(c.getText()).toDate(), A.PublicationProcessDates, Q.Accepted);
            }
        });
        cursor.up();
    }

    if(cursor.firstChildElementMaybe("contributors")) {
        cursor.eachChildElement((c) => {
            if(c.getAttribute("contributorType") === "Editor") {
                applyPerson(c, "contributor", A.Editor);
            }
        });
        cursor.up();
    }

    if(cursor.firstChildElementMaybe("subjects")) {
        cursor.eachChildElement((c) => {
            if("Keywords" in A) {
                object.append(O.text(O.T_TEXT, c.getText()), A.Keywords);
            }
        });
        cursor.up();
    }

    return true;
});
