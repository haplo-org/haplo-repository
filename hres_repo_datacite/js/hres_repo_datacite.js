/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var SHOULD_NOT_EXPORT_CONTRIBUTORS = O.application.config["hres:repository:datacite_should_not_export_contributors"];

// --------------------------------------------------------------------------

// Provide DataCite OAI-PMH interface. Records are wrapped with some further metadata
P.implementService("hres:repository:datacite:oai-pmh:write-store-object-below-xml-cursor", function(item, cursor, options) {
    cursor.
        element("schemaVersion").text("4.3").up().  // The datacite schmema version implemented here
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

// Export record as an XML file
P.implementService("hres:repository:datacite:export-object-as-binary-data", function(item) {
    let xmlDocument = O.xml.document();
    let cursor = xmlDocument.cursor().
        element("datacite");
    writeObjectAsDataciteXML(item, cursor);
    return O.binaryData(xmlDocument.toString(), {
        filename: item.title+"_datacite.xml",
        mimeType: "application/xml"
    });
});

// Export record as an XML file
P.implementService("hres:repository:datacite:export-object-as-binary-data-multiple", function(items) {
    let xmlDocument = O.xml.document();
    let cursor = xmlDocument.cursor().
        element("datacite");
    _.each(items, item => {
        writeObjectAsDataciteXML(item, cursor);
    });
    return O.binaryData(xmlDocument.toString(), {
        filename: "search_export_datacite.xml",
        mimeType: "application/xml"
    });
});

var writeObjectAsDataciteXML = function(item, cursor, options) {
    options = options || {};
    var resource;
    // if we only want selected fields we can extend from there the existing element, otherwise
    // (if adding to a blank document, or an OAI-PMH response) we need to add the base "resource" element
    if(options.selectedFields) {
        resource = cursor.
            addNamespace("http://datacite.org/schema/kernel-4", "datacite", "http://schema.datacite.org/meta/kernel-4.3/metadata.xsd").
            cursorWithNamespace("http://datacite.org/schema/kernel-4");
    } else {
        resource = cursor.
            cursorSettingDefaultNamespace("http://datacite.org/schema/kernel-4").
            element("resource").
            addSchemaLocation("http://datacite.org/schema/kernel-4", "https://schema.datacite.org/meta/kernel-4.3/metadata.xsd");
    }

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
    var university = O.query().link(T.University, A.Type).execute()[0];
    var personElement = function(desc, elementPrefix, modifyElement, validateElement) {
        item.every(desc, function(v,d,q) {
            if(validateElement && !validateElement(v, d, q)) { return; }

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
                    resource.element("affiliation");
                    if("GridID" in A && university.first(A.GridID)) {
                        resource.attribute("affiliationIdentifier", university.first(A.GridID)).
                            attribute("affiliationIdentifierSchema", "GRID").
                            attribute("SchemeURI", "https://www.grid.ac/institutes/");
                    }
                    resource.text(university.title).
                        up();
                });
            }
            if(modifyElement) { modifyElement(resource, v, d, q); }
            resource.up();
        });
    };

    var setIdentifier = function() {
        simpleElement(A.DOI, "identifier", function(c, v) {
            if(P.DOI.isDOI(v)) {
                c.attribute("identifierType", "DOI");
            }
        });
    };

    var setResourceType = function () {
        if("Dataset" in T && !item.isKindOf(T["Dataset"])) {
            simpleElement(A.Type, "resourceType", function(c, v) {
                var t;
                _.each(RESOURCE_TYPE_GENERAL, (types, resourceTypeGeneral) => {
                    _.each(types, (type) => { if(item.isKindOf(type)) { t = resourceTypeGeneral; } });
                });
                c.attribute("resourceTypeGeneral", t || "Text");
            });
        } else {
            var t, 
                text = "",
                dataFiles = "DatasetFile" in A ? item.getAttributeGroupIds(A.DatasetFile) : [];

            _.find(dataFiles, groupId => {
                var group = item.extractSingleAttributeGroup(groupId);
                var dataType = "DataType" in A ? group.first(A.DataType) : null;
                if(dataType) {
                    dataType = dataType.load().title;
                    return _.find(RESOURCE_TYPE_GENERAL, (types, resourceTypeGeneral) => {
                        return _.find(types, (type) => {
                            if(O.isRef(type)) { type = type.load().title; }
                            if(type === dataType) { 
                                t = resourceTypeGeneral;
                                if(t === "Other") {
                                    text = dataType;
                                }
                                return true;
                            } 
                        });
                    });
                }
            });
            resource.element("resourceType").text(text).attribute("resourceTypeGeneral", t || "Text");
            resource.up();
        }
    };

    var setRelatedIdentifier = function() {
        var identifierDescs = [A.Url, A.ISBN, A.DOI, A.Handle, A.PubMedID, A.PubMedCentralID];
        if("RelatedOutput" in A) {
            resource.element("relatedIdentifiers");
            item.every(A.RelatedOutput, (v, d, q) => {
                var output = v.toString().split(": ");
                var value = output[output.length-1];
                var name = SCHEMA.getQualifierInfo(q).name;
                var identifier = v;
                name = name.split(" ");
                //Put into schema format (no spaces capital start of word)
                name = _.map(name, word => { return word[0].toUpperCase() + word.substr(1); }).join("");

                var type;
                if(O.isRef(v)) {
                    // If link is to item in repository then find a DataCite compliant identifier to use
                    var linkedObj = v.load();
                    var identifierDesc = _.find(identifierDescs, (desc) => !!linkedObj.first(desc));
                    if(identifierDesc) {
                        value = linkedObj.first(identifierDesc);
                        type = O.typecode(value);
                        identifier = value;
                    }
                } else {
                    type = output.length > 1 ? output[0] : O.typecode(identifier);
                }

                if(_.isNumber(type)) {
                    if(type === O.T_IDENTIFIER_URL) { type = "URL"; }
                    else if(type === O.T_IDENTIFIER_ISBN) { type = "ISBN"; }
                    if(P.DOI.isDOI(identifier)) { type = "DOI"; }
                    else if(P.Handle.isHandle(identifier)) { type = "Handle"; }
                    else if(P.PMID.isPMID(identifier)) { type = "PMID"; }
                }
                if(value && type) {
                    resource.element("relatedIdentifier").
                        attribute("relationType", name).
                        text(value).
                        attribute("relatedIdentifierType", type).
                        up();
                }
            });
            resource.up();
        }
    };

    var setCreator = function() {
        resource.element("creators");
        personElement(A.AuthorsCitation, "creator");
        resource.up();
    };

    var setTitle = function() {
        resource.element("titles");
        simpleElement(A.Title, "title");
        resource.up();
    };

    var setPublisher = function() {
        var pub = item.first(A.Publisher);
        if(pub) {
            var str;
            if(O.isRef(pub)) {
                str = pub.load().title;
            } else {
                str = pub.toString();
            }
            resource.element("publisher").text(str).up();
        }
    };

    var setPublicationYear = function() {
        if(item.first(A.Date)) {
        // To guarantee the element contains only the year information
        resource.element("publicationYear").
            text(new XDate(item.first(A.Date).start).toString("yyyy")).
            up();
        }
    };

    var setSubject = function() {
        resource.element("subjects");
        var subjectModifier;
        if(!O.serviceImplemented("hres:datacite:add-subjects-from-taxonomy-below-cursor")) {
            subjectModifier = function(c, v) {
                if(!O.isRef(v)) { return; }
                var url = v.load().first(A.Url);
                if(url) { c.attribute("valueURI", url.toString()); }
            };
        }
        elementMaybe("Keywords", "subject", subjectModifier);
        O.serviceMaybe("hres:datacite:add-subjects-from-taxonomy-below-cursor", resource, item);
        resource.up();
    };

    var setContributor = function() {
        resource.element("contributors");
        personElement(A.EditorsCitation, "contributor", function(c, v) {
            c.attribute("contributorType", "Editor");
        });
        if(!SHOULD_NOT_EXPORT_CONTRIBUTORS && "Contributors" in A) {
            personElement(A.Contributors, "contributor",
                // Modify element
                function(c, v, d, q) {
                    var info = SCHEMA.getQualifierInfo(q);
                    // Non-DataCite compliant qualifier should be exported as type 'Other'
                    var type = info.code.indexOf("datacite") !== -1 ? info.name.toString() : "Other";
                    var typeWords = type.split(" ");
                    type = _.map(typeWords, (word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
                    c.attribute("contributorType", type);
                },
                // Validate element
                function(v, d, q) {
                    var qual =  q ? SCHEMA.getQualifierInfo(q).code : null;
                    return !!qual;
                }
            );
        }
        resource.up();
    };

    var setDates = function() {
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
    };

    var setAlternateIdentifier = function() {
        resource.element("alternateIdentifiers");
        resource.element("alternateIdentifier").
            attribute("alternateIdentifierType", "HaploRef").
            text(item.ref.toString()).
            up();
        var permalink = O.serviceMaybe("hres:repository:common:public-url-for-object", item);
        if(permalink) {
            resource.element("alternateIdentifier").
                attribute("alternateIdentifierType", "Permalink").
                text(permalink).
                up();
        }
        resource.up();
    };

    var setRightsList = function() {
        resource.element("rightsList");
        elementMaybe("License", "rights", function(c, v) {
            if(!O.isRef(v)) { return; }
            var uri = v.load().first(A.Url);
            if(uri) { c.attribute("rightsURI", uri.toString()); }
        });
        resource.up();
    };

    var setDescription = function() {
        resource.element("descriptions");
        elementMaybe("Abstract", "description", function(c, v) {
            c.attribute("descriptionType", "Abstract");
        });
        elementMaybe("DataCollectionMethod", "description", function(c, v) {
            c.attribute("descriptionType", "Methods");
        });
        elementMaybe("DataProcessing", "description", function(c, v) {
            c.attribute("descriptionType", "TechnicalInfo");
        });
        resource.up();
    };

    var setGeoLocation = function() {
        // DataCite XML Elements in order of their attribute string representation
        var boundingBoxElements = ["southBoundLatitude", "westBoundLongitude", "northBoundLatitude", "eastBoundLongitude"];
        resource.element("geoLocations");
        if("GeographicLocation" in A) {
            var locations = item.getAttributeGroupIds(A.GeographicLocation);
            _.each(locations, locationID => {
                var location = item.extractSingleAttributeGroup(locationID);
                var placeName = location.first(A.GeographicCoverage) || "";

                resource.element("geoLocation");
                if(placeName) {
                    resource.element("geoLocationPlace").
                        text(placeName.toString()).
                        up();
                }
                var coordinates;
                if("BoundingBox" in A) {
                    var boundingBox = location.first(A.BoundingBox);
                    if(boundingBox) {
                        boundingBox = boundingBox.toString();
                        coordinates = boundingBox.split(" ");
                        // Every coordinate is required for DataCite schema
                        if(coordinates.length === 4) {
                            resource.element("geoLocationBox");
                            _.each(coordinates, (coordinate, i) => {
                                resource.element(boundingBoxElements[i]).
                                    text(coordinate).
                                    up();
                            });
                            resource.up();
                        }
                    }
                }
                if("LocationPoint" in A) {
                    var locationPoint = location.first(A.LocationPoint);
                    if(locationPoint) {
                        locationPoint = locationPoint.toString();
                        coordinates = locationPoint.split(" ");
                        if(coordinates.length === 2) {
                            resource.element("geoLocationPoint");
                            resource.element("pointLatitude").
                                text(coordinates[0]).
                                up();
                            resource.element("pointLongitude").
                                text(coordinates[1]).
                                up();
                            resource.up();
                        }
                    }
                }

                resource.up();
            });
        }

        if("GeographicCoverage" in A) {
            //List deprecated geographic coverage single element
            item.every(A.GeographicCoverage, (v,d,q,x) => {
                if(x) { return; }
                resource.element("geoLocation").
                    element("geoLocationPlace").
                    text(v.toString()).
                    up().
                    up();
            });
        }
        resource.up();
    };

    var setFundingReference = function() {
        let funderCount = item.every(A.Funder).length;
        let projectCount = item.every(A.Project).length;
        let useGrantID = (funderCount === 1) && (projectCount === 1);

        resource.element("fundingReferences");
        item.every(A.Funder, (v,d,q) => {
            let funderTitle = O.isRef(v) ? v.load().title : v;
            resource.
                element("fundingReference").
                element("funderName").
                text(funderTitle).
                up();
            if(useGrantID) {
                let project = item.first(A.Project).load();
                resource.
                    element("awardNumber").
                    text(project.first(A.GrantId)).
                    up();
                resource.
                    element("awardTitle").
                    text(project.title).
                    up();
            }
            resource.up();
        });
    };

    var setSize = function() {

    };

    var fieldsMap = {
        "identifier": setIdentifier,
        "resourceType": setResourceType,
        "relatedIdentifier": setRelatedIdentifier,
        "creator": setCreator,
        "title": setTitle,
        "publisher": setPublisher,
        "publicationYear": setPublicationYear,
        "subject": setSubject,
        "contributor": setContributor,
        "date": setDates,
        "alternateIdentifier": setAlternateIdentifier,
        "rightsList": setRightsList,
        "description": setDescription,
        "geoLocation": setGeoLocation,
        "fundingReference": setFundingReference,
        "size": setSize
    };

    if(options.selectedFields) {
        _.each(options.selectedFields, function(field) {
            fieldsMap[field]();
        });
    } else {
        _.each(fieldsMap, function(fn, field) {
            fn();
        });
        resource.up();
    }

};

//Function to map a type to its equivalent schema type, if not returns the text
var mapToTypesMaybe = function(typeStrings) {
    return _.compact(_.map(typeStrings, (str) => {
        if(str in T) { return T[str]; }
        else { return str; }
    }));
};
// Using the default repository schema. This is not guaranteed to be installed, to allow applications 
// to use different schemas if required
var RESOURCE_TYPE_GENERAL = {
    "Audiovisual": mapToTypesMaybe(["DigitalOrVisualMedia", "Video"]),
    "Collection": mapToTypesMaybe(["Archive"]),
    "DataPaper": [],
    "Dataset": mapToTypesMaybe(["Dataset"]),
    "Event": mapToTypesMaybe(["Exhibition", "Performance"]),
    "Image": mapToTypesMaybe(["Image"]),
    "InteractiveResource": mapToTypesMaybe(["Website", "OnlineEducationalResource"]),
    "Model": mapToTypesMaybe(["Design"]),
    "PhysicalObject": mapToTypesMaybe(["Artefact", "DevicesAndProducts"]),
    "Service": [],
    "Software": mapToTypesMaybe(["Software"]),
    "Sound": mapToTypesMaybe(["Audio", "Composition"]),
    "Text": mapToTypesMaybe(["JournalArticle", "Book", "BookChapter", "ConferenceItem", "Patent", "Report", "Thesis", "Text"]),
    "Workflow": [],
    "Other": mapToTypesMaybe(["Spreadsheet", "Slideshow"])
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
                if(!O.isRef(type)) { type = null; }
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
