/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var oaireTypeList = O.refdictHierarchical();
oaireTypeList.set(T.Book, {label:"book", uri:"http://purl.org/coar/resource_type/c_2f33", generalType:"literature"});
oaireTypeList.set(T.BookChapter, {label:"book part", uri:"http://purl.org/coar/resource_type/c_3248", generalType:"literature"});
oaireTypeList.set(T.ConferenceItem, {label:"conference object", uri:"http://purl.org/coar/resource_type/c_3248", generalType:"other research product"});
oaireTypeList.set(T.JournalArticle, {label:"journal article", uri:"http://purl.org/coar/resource_type/c_6501", generalType:"literature"});
oaireTypeList.set(T.Patent, {label:"patent", uri:"http://purl.org/coar/resource_type/c_15cd", generalType:"other research product"});
oaireTypeList.set(T.Report, {label:"report", uri:"http://purl.org/coar/resource_type/c_93fc", generalType:"literature"});
oaireTypeList.set(T.Thesis, {label:"thesis", uri:"http://purl.org/coar/resource_type/c_46ec", generalType:"literature"});
oaireTypeList.set(T.Audio, {label:"sound", uri:"http://purl.org/coar/resource_type/c_18cc", generalType:"other research product"});
oaireTypeList.set(T.Composition, {label:"musical composition", uri:"http://purl.org/coar/resource_type/c_18cd", generalType:"other research product"});
oaireTypeList.set(T.DigitalOrVisualMedia, {label:"image", uri:"http://purl.org/coar/resource_type/c_c513", generalType:"other research product"});
oaireTypeList.set(T.Software, {label:"software", uri:"http://purl.org/coar/resource_type/c_5ce6", generalType:"software"});
oaireTypeList.set(T.Dataset, {label:"dataset", uri:"http://purl.org/coar/resource_type/c_ddb1", generalType:"dataset"});
oaireTypeList.set(T.OnlineEducationalResource, {label:"website", uri:"http://purl.org/coar/resource_type/c_7ad9", generalType:"other research product"});
oaireTypeList.set(T.Video, {label:"video", uri:"http://purl.org/coar/resource_type/c_12ce", generalType:"other research product"});
oaireTypeList.set(T.Website, {label:"website", uri:"http://purl.org/coar/resource_type/c_7ad9", generalType:"other research product"});

const OTHER_TYPE_DETAILS = {label:"other", uri:"http://purl.org/coar/resource_type/c_1843", generalType:"other research product"};

var oaireTypeListSetUp = false;

P.implementService("hres:repository:oaire:write-store-object-below-xml-cursor", function(item, cursor, options) {

    if(!oaireTypeListSetUp) {
        O.serviceMaybe("hres:repo_oaire:collect_repository_item_types", oaireTypeList);
        oaireTypeListSetUp = true;
    }

    // This service is passed a restricted copy of the item. This should be used where we don't explicitly need to
    // know about possibly restricted attributes, such as publisher's versions of files, where there may be embargoes. 
    // In those cases, use the urestricted item.
    let unrestrictedItem = item.ref.load();

    let element = function(v) {
        return (O.isRef(v) ? v.load().title : v.toString());
    };
    let simpleElement = function(c, desc, elementName, modifyElement) {
        item.every(desc, function(v,d,q) {
            c.element(elementName).text(element(v));
            if(modifyElement) { modifyElement(c, v, d, q); }
            c.up();
        });
    };
    let addPersonORCIDid = function(c, v) {
        let ref = O.service("hres:author_citation:get_ref_maybe", v);
        if(ref) {
            let person = ref.load();
            if(person.first(A.ORCID)) {
                c.element("nameIdentifier").
                    text(person.first(A.ORCID)).
                    attribute("nameIdentifierScheme", "ORCID").
                    attribute("schemeURI", "http://orcid.org").
                    up();
            }
        }
    };

    let addEmbargoedFiles = function(c, desc) {
        let embargoes = O.serviceMaybe("hres_repo_embargoes:get_embargo", item) || [];
        let now = new Date();
        let anyAreEmbargoed = false;
        unrestrictedItem.every(desc, (v,d,q,x) => {
            let fileUrl = options.fileToURL(v);
            let isEmbargoed;
            _.each(embargoes, (e) => {
                if((now > e.start && now < e.end) && (x.groupId === e.extensionGroup || !e.extensionGroup)) {
                    isEmbargoed = true;
                    anyAreEmbargoed = true;
                }
            });
            c.element("file").text(fileUrl);
            //TODO: deal better with different types of restrictions
            if(isEmbargoed) {
                c.attribute("accessRightsURI", "http://purl.org/coar/access_right/c_f1cf");
            } else {
                c.attribute("accessRightsURI", "http://purl.org/coar/access_right/c_abf2");
            }
            c.up();
        });
        return anyAreEmbargoed;
    };

    let getValueFromAttributeList = function(descs) {
        let title;
        _.find(descs, (d) => {
            let val = item.first(d);
            if(val) {
                title = element(val);
                return true;
            }
        });
        return title;
    };

    let formatElements = function(c, descs) {
        let formats = [];
        _.each(descs, (d) => {
            unrestrictedItem.every(d, (v,d,q) => {
                if(v.mimeType) {
                    formats.push(v.mimeType);
                }
            });
        });
        _.chain(formats).
            uniq().
            each((f) => {
                c.
                    element("format").
                    text(f).
                    up();
            });
    };

    let pageRangeElements = function(c, pageRange) {
        let split = pageRange.toString().split("-");
        c.element("citationStartPage").text(split[0]).up();
        if(split.length > 1) {
            c.element("citationEndPage").text(split[1]).up();
        }
    };

    let projects = item.every(A.Project);

    // oaire elements
    let oaire = cursor.
        addNamespace("http://namespace.openaire.eu/schema/oaire/", "oaire", "https://www.openaire.eu/schema/repo-lit/4.0/openaire.xsd").
        cursorWithNamespace("http://namespace.openaire.eu/schema/oaire/");

    let funders = item.every(A.Funder);
    if(funders.length) {
        let grantIDs = [];
        _.each(projects, (p) => {
            grantIDs = grantIDs.concat(p.load().every(A.GrantId));
        });
        oaire.element("fundingReferences");
        let referencesLength = Math.max(grantIDs.length, funders.length);
        let funder;
        for(var i = 0; i < referencesLength; i++) {
            if(i < funders.length) {
                funder = funders[i];
            }
            let grantId;
            if(i < grantIDs.length) {
                grantId = grantIDs[i];
            }
            if(funder) {
                oaire.element("fundingReference");
                oaire.element("funderName").text(element(funder)).up();
                if(grantId) {
                    oaire.element("awardNumber").text(grantId.toString()).up();
                }
                oaire.up();
            }
        }
        oaire.up();
    }
    
    let type = item.firstType();
    let rootType = SCHEMA.getTypeInfo(type).rootType;
    let typeDetails = oaireTypeList.get(rootType) || OTHER_TYPE_DETAILS;
    oaire.
        element("resourceType").
        text(typeDetails.label).
        attribute("resourceTypeGeneral", typeDetails.generalType).
        attribute("uri", typeDetails.uri).
        up();

    let embargoes = [];
    let embargoEnd;
    let embargoStart;
    let now = new Date();

    if(O.serviceImplemented("hres_repo_embargoes:get_embargo")) {
        embargoes = O.service("hres_repo_embargoes:get_embargo", item);
        if(embargoes && embargoes.length) {
            embargoes.each((row) => {
                if(row.end) {
                    if(!embargoEnd || row.end > embargoEnd) {
                        embargoEnd = row.end;
                    }
                }
                if(row.start) {
                    if(!embargoStart || row.start < embargoStart) {
                        embargoStart = row.start;
                    }
                }
            });
            embargoes.each((embargo) => {
                let licenseURL = embargo.licenseURL;
                if(licenseURL) {
                    oaire.
                        element("licenseCondition").
                        attribute("startDate", new XDate(embargo.start).toString("yyyy-MM-dd")).
                        attribute("uri", licenseURL).
                        text(embargo.licenseURL).
                        up();
                    }
            });
        }

        let start = embargoEnd || O.service("hres:repository:earliest_publication_date", item);
        if(start) {
            let license = item.first(A.License);
            if(license) {
                let licenseObject = license.load();
                let licenseName = licenseObject.title;
                let licenseURL = licenseObject.first(A.WebAddressUrl);
                oaire.
                    element("licenseCondition").
                    attribute("startDate", new XDate(start).toString("yyyy-MM-dd")).
                    text(licenseName);
                if(licenseURL) {
                    oaire.attribute("uri", licenseURL);
                }
                oaire.up();
            }
        }
    }

    let currentEmbargoExists = false;
    if(options && options.fileToURL) {
        currentEmbargoExists = addEmbargoedFiles(oaire, A.File);
    }

    if(unrestrictedItem.getAttributeGroupIds(A.PublishersVersion).length) {
        oaire.element("version").text("VoR").attribute("uri", "http://purl.org/coar/version/c_970fb48d4fbd8a85").up();
    } else if(unrestrictedItem.getAttributeGroupIds(A.AcceptedAuthorManuscript).length) {
        oaire.element("version").text("AM").attribute("uri", "http://purl.org/coar/version/c_ab4af688f83e57aa").up();
    }

    let citationTitle = getValueFromAttributeList([A.Journal, A.BookTitle, A.Conference]);
    if(citationTitle) {
        oaire.element("citationTitle").text(citationTitle).up();
    }

    let journalCitation = item.first(A.JournalCitation);
    if(journalCitation) {
        let fields = journalCitation.toFields().value;
        if(fields.volume) {
            oaire.element("citationVolume").text(fields.volume).up();
        }
        if(fields.number) {
            oaire.element("citationIssue").text(fields.number).up();
        }
        if(fields.pageRange) {
            pageRangeElements(oaire, fields.pageRange);
        }
    } else {
        let pageRange = item.first(A.PageRange);
        if(pageRange) {
            pageRangeElements(oaire, pageRange);
        }
    }

    simpleElement(oaire, A.Edition, "citationEdition");
    let event = item.first(A.Conference);
    if(event) {
        let location = event.load().first(A.Location);
        if(location) {
            oaire.element("citationConferencePlace").text(location).up();
        }
    }

    let conferenceDate = item.first(A.ConferenceDate);
    if(conferenceDate) {
        oaire.element("citationConferenceDate").text(new XDate(conferenceDate.start).toString("yyyy-MM-dd")).up();
    }

    // datacite elements

    let datacite = cursor.
        addNamespace("http://datacite.org/schema/kernel-4", "datacite", "http://schema.datacite.org/meta/kernel-4/metadata.xsd").
        cursorWithNamespace("http://datacite.org/schema/kernel-4");

    simpleElement(datacite, A.Title, "title", (c, d, v, q) => {
        if(q === Q.Alternative) {
            c.attribute("titleType", "AlternativeTitle");
        }
    });

    if(item.first(A.AuthorsCitation)) {
        datacite.element("creators");
        item.every(A.AuthorsCitation, (cite) => {
            datacite.element("creator");
            datacite.element("creatorName").text(cite).up();
            addPersonORCIDid(datacite, cite);
            datacite.up();
        });
        datacite.up();
    }

    if(item.first(A.EditorsCitation)) {
        datacite.element("contributors");
        item.every(A.EditorsCitation, (cite) => {
            datacite.element("contributor").attribute("contributorType", "Editor");
            datacite.element("contributorName").text(cite).up();
            addPersonORCIDid(datacite, cite);
            datacite.up();
        });
        datacite.up();
    }

    let publicationDates = item.first(A.PublicationDates) || item.first(A.Date);
    let publicationDate = publicationDates ? publicationDates.start : item.creationDate; // Publication date is a mandatory field
    if((embargoStart && embargoEnd) || publicationDate) {
        datacite.element("dates");
        if(embargoStart && embargoEnd) {
            datacite.
                element("date").
                text(new XDate(embargoStart).toString("yyyy-MM-dd")).
                attribute("dateType", "Accepted").
                up().
                element("date").
                text(new XDate(embargoEnd).toString("yyyy-MM-dd")).
                attribute("dateType", "Available").
                up();
        }
        if(publicationDate) {
            datacite.
                element("date").
                text(new XDate(publicationDate).toString("yyyy-MM-dd")).
                attribute("dateType", "Issued").
                up();
        }
        datacite.up();
    }

    let identifierType;

    if(item.first(A.DOI)) {
        datacite.
            element("identifier").
            text(P.DOI.asString(item.first(A.DOI))).
            attribute("identifierType", "DOI").
            up();
        identifierType = "DOI";
    } else {
        if(item.first(A.WebAddressUrl)) {
            datacite.
                element("identifier").
                text(item.first(A.WebAddressUrl)).
                attribute("identifierType", "URL").
                up();
            identifierType = "URL";
        }
    }
    simpleElement(datacite, A.ISSN, "alternateIdentifier", (c,v,d,q) => {
        c.attribute("alternateIdentifierType", "ISSN");
    });
    simpleElement(datacite, A.ISBN, "alternateIdentifier", (c,v,d,q) => {
        c.attribute("alternateIdentifierType", "ISBN");
    });
    if(identifierType !== "URL") {
        simpleElement(datacite, A.WebAddressUrl, "alternateIdentifier", (c,v,d,q) => {
            c.attribute("alternateIdentifierType", "URL");
        });
    }

    datacite.element("rights");
    if(currentEmbargoExists) {
        datacite.
            text("embargoed access").
            attribute("rightsURI", "http://purl.org/coar/access_right/c_f1cf");
    } else {
        datacite.
            text("open access").
            attribute("rightsURI", "http://purl.org/coar/access_right/c_abf2");
    }
    datacite.up();

    simpleElement(datacite, A.Keywords, "subject");

    // dc elements
    let dc = cursor.
        addNamespace("http://purl.org/dc/elements/1.1/", "dc", "http://www.openarchives.org/OAI/2.0/oai_dc.xsd").
        cursorWithNamespace("http://purl.org/dc/elements/1.1/");

    simpleElement(dc, A.Publisher, "publisher");
    simpleElement(dc, A.Abstract, "description");
    formatElements(dc, [A.PublishersVersion, A.AcceptedAuthorManuscript, A.File]);
});


