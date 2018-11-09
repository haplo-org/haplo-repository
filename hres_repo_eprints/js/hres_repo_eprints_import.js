/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// --------------------------------------------------------------------------
// EPrints to StoreObject
P.implementService("hres:repository:eprints:apply-xml-to-object", function(cursor, object, eprintsName) {
    let intermediate = convertXMLToIntermediate(cursor, eprintsName);
    if(intermediate) {
        applyIntermediateToObject(intermediate, object);
    }
});

// --------------------------------------------------------------------------
// Testing

P.db.table("eprintsLogging", {
    log: { type: "json" },
    digest: { type: "text", nullable: true }
});

P.db.table("eprintsMetadata", {
    object: { type: "ref" },
    eprintId: { type: "text" }
});

var log = {};

var saveObjectWithLogging = function(object, eprintId) {
    // O.impersonating(O.SYSTEM, () => { object.save(); });
    log.eprints[eprintId].push("New object ref: "+object.ref+", title: "+object.title);
    let typeTitle = object.firstType().load().title;
    log.newObjects[typeTitle] = (log.newObjects[typeTitle] || 0) + 1;
};

P.implementService("hres:repository:eprints:save-object-with-logging", saveObjectWithLogging);

var xmlForm = P.form("xmlUpload", "form/xml_upload.json");

P.respond("GET,POST", "/do/hres-repo-eprints/upload-xml", [
], function(E) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    let document = {};
    let form = xmlForm.handle(document, E.request);
    if(form.complete) {
        O.background.run("hres_repo_eprints:import", document);
        E.response.redirect("/do/hres-repo-eprints/upload-xml");
    }
    let recentLogs = P.db.eprintsLogging.select().order("id", true).limit(5);
    recentLogs = _.map(recentLogs, log => {
        return {
            id: log.id,
            filename: log.digest ? O.file(log.digest).filename : undefined
        };
    });
    E.render({
        pageTitle: "EPrints import",
        form: form,
        recentLogs: recentLogs,
        status: P.data.eprintImportStatus
    });
});

P.backgroundCallback("import", function(document) {
    O.impersonating(O.SYSTEM, () => {
        P.data.eprintImportStatus = "RUNNING";
        log = {
            eprints: {},
            tags: { "__not_imported": [] },
            newObjects: {},
            outputsByType: {}
        }; // reset log
        let file = O.file(document.xmlFile[0]);
        let cursor = O.xml.parse(file).cursor();
        if(!cursor.firstChildElementMaybe("eprints")) { return; }
        let newCount = 0;
        cursor.eachChildElement("eprint", (c) => {
            let intermediate = convertXMLToIntermediate(c);
            if(intermediate) {
                let object = O.object();
                applyIntermediateToObject(intermediate, object);
                newCount++;
            }
        });
        log.date = new Date();
        log.totalEprintsImported = newCount;
        P.db.eprintsLogging.create({log:log, digest:file.digest}).save();
        P.data.eprintImportStatus = "DONE";
    });
});

var IGNORE_TAGS = [
    "eprintid",
    "rev_number",
    "eprint_status", // used, but not in mapping
    "userid",
    "dir",
    "datestamp",
    "lastmod",
    "status_changed",
    "metadata_visibility",
    "item_issues",
    "item_issues_count"
];

var getImportIgnoreTags = function() {
    O.serviceMaybe("hres:repository:eprints:import-ignore-tags", IGNORE_TAGS);
    return IGNORE_TAGS;
};

P.respond("GET", "/do/hres-repo-eprints/log", [
    {pathElement:0, as:"db", table:"eprintsLogging"}
], function(E, row) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    let log = row.log;
    let temp = {};
    _.each(log.eprints, (v, k) => { if(v.length) { temp[k] = v; } });
    log.eprints = temp;

    const ignoreTags = getImportIgnoreTags();
    let unimportedTags = _.difference(log.tags["__not_imported"], ignoreTags);
    log["ERROR:unimported_tags"] = unimportedTags;
    log = _.omit(log, "tags"); // don't want other info about tags here

    let file = row.digest ? O.file(row.digest) : undefined;
    E.render({
        backLink: "/do/hres-repo-eprints/upload-xml",
        backLinkText: "Upload XML",
        log: JSON.stringify(log, undefined, 2),
        file: file ? { name: file.filename, url: file.url() } : undefined
    });
});

// --------------------------------------------------------------------------
// Functions for tag to StoreObject value conversion

var setText = function(cursor, intermediate, attribute, textType) {
    attribute.value = O.text(textType ? textType : O.T_TEXT, cursor.getText());
    intermediate.attributes.push(attribute);
};

var setParagraph = function(cursor, intermediate, attribute) {
    setText(cursor, intermediate, attribute, O.T_TEXT_PARAGRAPH);
};

var setUrl = function(cursor, intermediate, attribute) {
    let url = cursor.getText();
    // don't repeat url if url is DOI and id_number is DOI
    if(url.indexOf("dx.doi.org") !== -1) {
        cursor.up();
        // id_number may not store DOI in other eprints implementations
        let doiAttrInfo = _.find(P.getHaploAttributeInfo(), (a) => { return a.name === "DOI"; });
        if(doiAttrInfo && cursor.firstChildElementMaybe(doiAttrInfo.tag)) {
            return;
        }
    }
    attribute.value = O.text(O.T_IDENTIFIER_URL, url);
    intermediate.attributes.push(attribute);
};

var setIsbn = function(cursor, intermediate, attribute) {
    setText(cursor, intermediate, attribute, O.T_IDENTIFIER_ISBN);
};

var setPersonCitation = function(cursor, intermediate, attribute) {
    let hasPersonInSystem = false;
    cursor.eachChildElement("item", (personCursor) => {
        let person = _.clone(attribute), id, name;
        person.properties = {};
        personCursor.eachChildElement((personDetailCursor) => {
            switch(personDetailCursor.getNodeName()) {
                case "id":
                    id = person.properties.id = personDetailCursor.getText();
                    break;
                case "name":
                    name = person.properties.name = {};
                    personDetailCursor.eachChildElement((personNameCursor) => {
                        person.properties.name[personNameCursor.getNodeName()] = personNameCursor.getText();
                    });
                    break;
            }
        });
        if(person.properties.id) {
            let email = O.text(O.T_IDENTIFIER_EMAIL_ADDRESS, id);
            let q = O.query().identifier(email, A.Email).execute();
            if(q.length) {
                person.value = {object:q[0]};
                hasPersonInSystem = true;
            } else {
                logWarning(intermediate, "Could not find user for id: "+id, "warning:no-user-for-email");
            }
        }
        if(!person.value) {
            person.value = {
                first: person.properties.name.given,
                last: person.properties.name.family
            };
        }
        intermediate.attributes.push(person);
    });
    if(!hasPersonInSystem) {
        logWarning(intermediate, "No user in system found for "+attribute.tag,
            "warning:"+attribute.tag+":no-user-found");
    }
};

// TODO: can this use the export type map?
var TYPE_MAP = {
    types: {
        "book": "Book",
        "book_section": "BookChapter",
        "monograph": "Report",
        "monograph.discussion_paper": "DiscussionPaper",
        "monograph.project_report": "ProjectReport",
        "monograph.technical_report": "TechnicalReport",
        "monograph.working_paper": "WorkingPaper",
        "artefact": "Artefact",
        "audio": {
            type: "DigitalOrVisualMedia",
            attr: { attr:"MediaType", behaviour:"hres:list:media-type:audio" }
        },
        "composition": "Composition",
        "conference_item": "ConferenceItem",
        "conference_item.paper": "ConferencePaper",
        "conference_item.poster": "ConferencePoster",
        "conference_item.keynote": "ConferenceKeynote",
        "exhibition": "Exhibition",
        "article": "JournalArticle",
        "patent": "Patent",
        "performance": "Performance",
        "thesis": "Thesis",
        "thesis.phd": "PhdThesis",
        "thesis.masters": "MastersThesis",
        "thesis.mphil": "MPhilThesis",
        "video": {
            type: "DigitalOrVisualMedia",
            attr: { attr:"MediaType", behaviour:"hres:list:media-type:video" }
        },
        "web_resource": "Website",
        "other": "Other"
    },
    subtypeKeys: ["monograph_type", "pres_type", "thesis_type"]
};

var DEFAULT_TYPE = T.Other;

var setType = function(cursor, intermediate, attribute) {
    let rootPath = cursor.getText();
    if(!_.contains(log.tags[attribute.tag], rootPath)) {
        log.tags[attribute.tag].push(rootPath);
        log.tags[attribute.tag].push(rootPath + " ("+intermediate.eprintId+")");
    }
    let searchPath, type;
    cursor.up();
    // quicker to cache?
    O.serviceMaybe("hres-repo-eprints:modify-import-type-map", TYPE_MAP);
    _.some(TYPE_MAP.subtypeKeys, (st) => {
        if(cursor.firstChildElementMaybe(st)) {
            searchPath = rootPath+'.'+cursor.getText();
            cursor.up();
            return true;
        }
    });
    if(!_.contains(log.tags[attribute.tag], searchPath)) {
        log.tags[attribute.tag].push(searchPath);
        log.tags[attribute.tag].push(searchPath + " ("+intermediate.eprintId+")");
    }
    const key = searchPath && TYPE_MAP.types[searchPath] in T ? searchPath : rootPath;
    if(key in TYPE_MAP.types) {
        type = TYPE_MAP.types[key];
        if(typeof type !== "string") {
            if(type.attr.attr in A) {
                intermediate.attributes.push(_.extend({}, attribute, {
                    desc: A[type.attr.attr],
                    value: O.behaviourRef(type.attr.behaviour)
                }));
            }
            type = type.type;
        }
        type = type in T ? T[type] : undefined;
    }
    if(type) {
        attribute.value = type;
    } else {
        logWarning(intermediate, "NO TYPE FOUND FOR TYPE "+(searchPath ? searchPath : rootPath),
            "warning:no-type");
        attribute.value = DEFAULT_TYPE;
    }
    intermediate.attributes.push(attribute);
};

var setEmbargoStatus = function(cursor, intermediate, attribute) {
    const status = cursor.getText();
    if(!_.contains(log.tags[attribute.tag], status)) {
        log.tags[attribute.tag].push(status);
        log.tags[attribute.tag].push(status + " ("+intermediate.eprintId+")");
    }
    if(status === "restricted") {
        cursor.up();
        if(cursor.firstChildElementMaybe("rioxx2_license_ref_input")) {
            if(cursor.firstChildElementMaybe("license_ref")) {
                intermediate.embargoLicenseURL = cursor.getText();
                cursor.up();
            }
            if(cursor.firstChildElementMaybe("start_date")) {
                intermediate.embargoStartDate = cursor.getText();
                cursor.up();
            }
            cursor.up();
        }
        cursor.firstChildElement("documents").firstChildElement("document");
        if(cursor.firstChildElementMaybe("date_embargo")) {
            intermediate.embargoEndDate = cursor.getText();
        }
    }
};

var setJournalCitation = function(cursor, intermediate, attribute) {
    // this assumes volume is found first to set this
    let properties = {
        volume: cursor.getText()
    };
    cursor.up();
    if(cursor.firstChildElementMaybe("number")) {
        properties.number = cursor.getText();
        cursor.up();
    }
    if(cursor.firstChildElementMaybe("pagerange")) {
        properties.pageRange = cursor.getText();
        cursor.up();
    }
    attribute.value = properties;
    intermediate.attributes.push(attribute);
};

var setPageRange = function(cursor, intermediate, attribute) {
    attribute.text = attribute.value = cursor.getText();
    cursor.up();
    // only set page range if volume and number aren't specified
    // otherwise it is a journal citation
    if(!cursor.firstChildElementMaybe("volume")) {
        if(!cursor.firstChildElementMaybe("number")) {
            intermediate.attributes.push(attribute);
        }
    }
};

var setBehaviourFromMap = function(cursor, intermediate, attribute, map) {
    let key = cursor.getText();
    if(!_.contains(log.tags[attribute.tag], key)) {
        log.tags[attribute.tag].push(key);
        log.tags[attribute.tag].push(key + " ("+intermediate.eprintId+")");
    }
    if(key in map) {
        attribute.value = O.behaviourRefMaybe(map[key]);
        intermediate.attributes.push(attribute);
    } else {
        logWarning(intermediate, "No status behaviour code found for status: "+key,
            "warning:status-behaviour");
    }
};

var OUTPUT_STATUS_MAP = {
    "unpub": "hres:list:output-status:unpublished",
    "inpress": "hres:list:output-status:in-press",
    "pub": "hres:list:output-status:published"
};

var setOutputStatus = function(cursor, intermediate, attribute) {
    setBehaviourFromMap(cursor, intermediate, attribute, OUTPUT_STATUS_MAP);
};

var REVIEW_MAP = {
    "TRUE": "hres:list:peer-review:reviewed",
    "FALSE": "hres:list:peer-review:not-reviewed"
};

var setPeerReview = function(cursor, intermediate, attribute) {
    setBehaviourFromMap(cursor, intermediate, attribute, REVIEW_MAP);
};

var setRefForTitle = function(intermediate, attribute, objectTitle, type) {
    let query = O.query().exactTitle(objectTitle).execute();
    if(query.length) {
        attribute.value = query[0];
    } else {
        let newObject = O.object();
        newObject.append(type, A.Type);
        newObject.append(objectTitle, A.Title);
        saveObjectWithLogging(newObject, intermediate.eprintId);
        attribute.value = newObject;
    }
    if(!attribute.value) {
        logWarning(intermediate, "No ref found for title: "+objectTitle,
            "warning:no-ref-for-title");
    }
};

var setPublisher = function(cursor, intermediate, attribute) {
    setRefForTitle(intermediate, attribute, cursor.getText(), T.Publisher);
    intermediate.attributes.push(attribute);
};

var setPublication = function(cursor, intermediate, attribute) {
    setRefForTitle(intermediate, attribute, cursor.getText(), T.Journal);
    intermediate.attributes.push(attribute);
};

var setDOI = function(cursor, intermediate, attribute, checkIfNew) {
    try {
        attribute.value = P.DOI.create(cursor.getText());
        if(checkIfNew) {
            let q = O.query().identifier(attribute.value, A.DOI).execute();
            attribute.properties = { existingObject: q.length ? q[0] : undefined };
        } else { 
            intermediate.attributes.push(attribute);
        }
    } catch(e) {
        attribute.properties = {};
        logWarning(intermediate, "Invalid DOI: "+cursor.getText(), "warning:invalid-doi-found");
        // log[intermediate.eprintId].push("Invalid DOI: "+cursor.getText());
    }
};

var setFile = function(cursor, intermediate, attribute) {
    // change desc depending on content in properties
};

var setYear = function(cursor, intermediate, attribute) {
    let year = new XDate(cursor.getText());
    if(year.valid()) {
        attribute.value = O.datetime(year, undefined, O.PRECISION_YEAR);
        intermediate.attributes.push(attribute);
    } else {
        logWarning(intermediate, "Could not set year: "+cursor.getText(),
            "warning:invalid-year");
    }
};

var dateMap = {
    "accepted":  {desc:"PublicationProcessDates",   qual:"Accepted"},
    "completed": {desc:"PublicationProcessDates",   qual:"Completed"},
    "published": {desc:"PublicationDates",          qual:"Published"},
    "published_online": {desc:"PublicationDates",   qual:"Online"}
};

// TODO: deposited date
var setDates = function(cursor, intermediate, attribute) {
    cursor.eachChildElement("item", (dateCursor) => {
        let dateAttribute = _.clone(attribute);
        let date, dateType;
        if(dateCursor.firstChildElementMaybe("date")) {
            date = dateCursor.getText();
            dateCursor.up();
        }
        if(dateCursor.firstChildElementMaybe("date_type")) {
            dateType = dateCursor.getText();
        }
        // is all of the following really required for adding a date?
        if(date && dateType in dateMap) {
            const dateInfo = dateMap[dateType];
            if(dateInfo && dateInfo.desc in A) {
                dateAttribute.desc = A[dateInfo.desc];
                if(dateInfo.qual in Q) { dateAttribute.qual = Q[dateInfo.qual]; }
                let dateParts = date.split('-');
                let precision;
                switch(dateParts.length) {
                    case 1:
                        precision = O.PRECISION_YEAR;
                        break;
                    case 2:
                        precision = O.PRECISION_MONTH;
                        break;
                    case 3:
                        precision = O.PRECISION_DAY;
                }
                date = new XDate(date);
                dateAttribute.value = O.datetime(date, undefined, precision);
                intermediate.attributes.push(dateAttribute);
            }
        }
        if(!dateAttribute.value) {
            logWarning(intermediate, "Not enough information to add date", "warning:invalid-date");
        }
    });
};

var setDepositedDate = function(cursor, intermediate, attribute) {
    let date = new XDate(cursor.getText());
    if(date.valid()) {
        attribute.value = O.datetime(date);
        attribute.qual = Q.Deposited;
        intermediate.attributes.push(attribute);
    } else {
        logWarning(intermediate, "Could not set deposited date: "+cursor.getText(), "warning:deposited-date");
    }
};

var setExternalEvent = function(cursor, intermediate, attribute) {
    // TODO: deduplication?
    // TODO: text cleaning on title and location?
    let event = O.object();
    event.append(T.ExternalEvent, A.Type);
    let eventTitle = cursor.getText();
    event.append(eventTitle, A.Title);
    cursor.up();
    if(cursor.firstChildElementMaybe("event_location")) {
        event.append(cursor.getText(), A.Location);
    }
    if(cursor.firstChildElementMaybe("event_dates")) {
        let eventDate = getEventDate(cursor);
        if(eventDate) {
            event.append(eventDate, A.EventDate);
        }
    }
    saveObjectWithLogging(event, intermediate.eprintId);
    attribute.value = event;
    intermediate.attributes.push(attribute);
};

// dates can look like: "22 Jul 2018" or "22 to end of 24 Jul 2018" or "22 Jul to end of 1 Aug 2018"
// or "30 Dec 2018 to end of 2 Jan 2019". The following checks for "to end of" to signal date range.
// If a range, validate the end date first, since that will be used to infer missing info from start.
var getEventDate = function(cursor) {
    let eventDate;
    if(O.serviceImplemented("hres:repository:event-date-import")) {
        eventDate = O.service("hres:repository:event-date-import", cursor);
    } else {
        let splitTerm = " to end of ";
        let datesString = cursor.getText().split(splitTerm);
        let startDate = new XDate(datesString[0]);
        if(datesString.length === 1 && startDate.valid()) {
            // if just one date, set value if valid
            eventDate = O.datetime(startDate);
        } else if(datesString.length > 1) {
            let endDate = new XDate(datesString[1]);
            if(endDate.valid()) {
                if(!startDate.valid()) {
                    // if not already valid, attempt to build start date by combining start and end date info
                    let endDateParts = datesString[1].split(' ');
                    let startDateParts = datesString[0].split(' ');
                    switch(startDateParts.length) {
                        case 1: // just day given
                            startDate = new XDate([startDateParts[0], endDateParts[1], endDateParts[2]].join(' '));
                            break;
                        case 2: // day and month given
                            startDate = new XDate([startDateParts[0], startDateParts[1], endDateParts[2]].join(' '));
                            break;
                    }
                }
                if(startDate.valid()) {
                    eventDate = O.datetime(startDate, endDate);
                }
            }
        }
    }
    return eventDate;
};

var setEventDate = function(cursor, intermediate, attribute) {
    attribute.value = getEventDate(cursor);
    if(!attribute.value) {
        logWarning(intermediate, "Could not set event date: "+cursor.getText(), "warning:event-date");
    } else {
        intermediate.attributes.push(attribute);
    }
};

var setFirstFileDeposit = function(cursor, intermediate, attribute) {
    let ffdDate = new XDate(cursor.getText());
    if(ffdDate.valid()) {
        cursor.up();
        if(cursor.firstChildElementMaybe("hoa_version_fcd")) {
            let version = cursor.getText();
            let ffdVer = {
                "AM": "hres:attribute:accepted-author-manuscript",
                "VoR": "hres:attribute:published-file"
            }[version];
            if(ffdVer) {
                intermediate.ffd = {
                    date: ffdDate.toDate(),
                    fileVersion: ffdVer
                };
            }
        }
    }
    if(!intermediate.ffd) {
        logWarning(intermediate, "Invalid/insufficient information to add first file deposit",
            "warning:first-file-deposit");
    }
};

var REF_EXCEPTION_TAG_LOOKUP = {
    "hoa_ex_tec_a": "technical-a",
    "hoa_ex_tec_b": "technical-b",
    "hoa_ex_tec_c": "technical-c",
    "hoa_ex_tec_d": "technical-d",
    "hoa_ex_dep_a": "deposit-a",
    "hoa_ex_dep_b": "deposit-b",
    "hoa_ex_dep_c": "deposit-c",
    "hoa_ex_dep_d": "deposit-d",
    "hoa_ex_dep_e": "deposit-e",
    "hoa_ex_dep_f": "deposit-f",
    "hoa_ex_acc_a": "access-a",
    "hoa_ex_acc_b": "access-b",
    "hoa_ex_acc_c": "access-c",
    "hoa_ex_acc_TRUE": "other"
};

var setREFException = function(cursor, intermediate, attribute) {
    let exceptionGroup = attribute.tag;
    let exceptionLetter = cursor.getText();
    log.tags[exceptionGroup].push(exceptionLetter);
    intermediate.exception = REF_EXCEPTION_TAG_LOOKUP[exceptionGroup+"_"+exceptionLetter];
};

// --------------------------------------------------------------------------

var PEOPLE_TAGS = ["creators", "editors", "book_creators"];

var haploAttributeInfo = [
    {name: "Title",                 tag: "title",           xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "Type",                  tag: "type",            xmlToIntermediate: setType,                 objectToIntermediate: P.typeAttr},
    {name: "Date",                  tag: "date",            xmlToIntermediate: setYear},
    {name: "Date",                  tag: "dates",           xmlToIntermediate: setDates}, // dates span several attributes, and
    {name: "PublicationProcessDates",tag: "dates",          objectToIntermediate: P.datesAttr}, // export needs to only look to one, but
    {name: "PublicationDates",      tag: "dates",           objectToIntermediate: P.datesAttr}, // import needs to look at all
    {name: "PublicationDates",      tag: "hoa_date_pub",    objectToIntermediate: P.publishedDate},
    {name: "PublicationProcessDates",tag: "datestamp",      xmlToIntermediate: setDepositedDate,        objectToIntermediate: P.depositedDateAttr},
    {name: "PublicationProcessDates",tag: "hoa_date_acc",   objectToIntermediate: P.acceptedDateAttr},
    {name: "Abstract",              tag: "abstract",        xmlToIntermediate: setParagraph,            objectToIntermediate: P.textAttr}, // TODO: paragraphAttr
    {name: "Keywords",              tag: "keywords",        xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "Publisher",             tag: "publisher",       xmlToIntermediate: setPublisher,            objectToIntermediate: P.refTitleAttr},
    {name: "Journal",               tag: "publication",     xmlToIntermediate: setPublication,          objectToIntermediate: P.refTitleAttr},
    {name: "Author",                tag: "creators",        xmlToIntermediate: setPersonCitation},
    {name: "Editor",                tag: "editors",         xmlToIntermediate: setPersonCitation},
    {name: "AuthorsCitation",       tag: "creators",        objectToIntermediate: P.personAttr},
    {name: "EditorsCitation",       tag: "editors",         objectToIntermediate: P.personAttr},
    {name: "BookTitle",             tag: "book_title",      xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "BookAuthor",            tag: "book_creators",   xmlToIntermediate: setPersonCitation},
    {name: "Edition",               tag: "edition",         xmlToIntermediate: setText},
    {name: "PlaceOfPublication",    tag: "place_of_pub",    xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "Isbn",                  tag: "isbn",            xmlToIntermediate: setIsbn,                 objectToIntermediate: P.textAttr},
    {name: "Issn",                  tag: "issn",            xmlToIntermediate: setIsbn,                 objectToIntermediate: P.textAttr},
    {name: "ResearchInstitute",     tag: "subjects",        objectToIntermediate: P.subjectsAttr}, // TODO: import subject
    {name: "File",                  tag: "documents",       xmlToIntermediate: setFile},
    {name: "JournalCitation",       tag: "volume",          xmlToIntermediate: setJournalCitation,      objectToIntermediate: P.journalCitationAttr},
    {name: "PageRange",             tag: "pagerange",       xmlToIntermediate: setPageRange,            objectToIntermediate: P.textAttr},
    {name: "DOI",                   tag: "id_number",       xmlToIntermediate: setDOI,                  objectToIntermediate: P.doiAttr},
    {name: "OutputStatus",          tag: "ispublished",     xmlToIntermediate: setOutputStatus,         objectToIntermediate: P.outputStatusAttr},
// TODO: deprecated - Event schema now on its own object
    {name: "EventTitle",            tag: "event_title",     xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "EventLocation",         tag: "event_location",  xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "EventDate",             tag: "event_dates",     xmlToIntermediate: setEventDate,            objectToIntermediate: P.textAttr},
// end TODO
    {name: "Event",                 tag: "event_title",     xmlToIntermediate: setExternalEvent},
    {name: "Series",                tag: "series",          xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "OutputMedia",           tag: "output_media",    xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "PeerReview",            tag: "refereed",        xmlToIntermediate: setPeerReview,           objectToIntermediate: P.peerReviewAttr},
    {name: "InstitutionName",       tag: "institution",     xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "DepartmentName",        tag: "department",      xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "Pages",                 tag: "pages",           xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "Notes",                 tag: "note",            xmlToIntermediate: setParagraph,            objectToIntermediate: P.textAttr},
    {name: "WebAddressUrl",         tag: "official_url",    xmlToIntermediate: setUrl,                  objectToIntermediate: P.textAttr},
    {name: "REFUnitOfAssessment",   tag: "hoa_ref_pan",                                                 objectToIntermediate: P.refUoaAttr},
    // if tag information results in change to database, not attribute, set database to true
    {database: true,                tag: "full_text_status",xmlToIntermediate: setEmbargoStatus,        objectToIntermediate: P.embargoAttrs},
    {database: true,                tag: "hoa_date_fcd",    xmlToIntermediate: setFirstFileDeposit,     objectToIntermediate: P.firstFileDepositAttr},
    {database: true,                tag: "hoa_ex_dep",      xmlToIntermediate: setREFException,         objectToIntermediate: P.refExceptionAttr},
    {database: true,                tag: "hoa_ex_tec",      xmlToIntermediate: setREFException},
    {database: true,                tag: "hoa_ex_acc",      xmlToIntermediate: setREFException},
    {database: true,                tag: "rev_number",      objectToIntermediate: P.versionNumber}
];

// remove any attributes that aren't defined in the application's schema
haploAttributeInfo = P.haploAttributeInfo = _.filter(haploAttributeInfo, (a) => {
    return a.name in A || a.database;
});

P.getHaploAttributeInfo = function() {
    // filter
    // cache?
    O.serviceMaybe("hres:repository:eprints:modify-attribute-info", haploAttributeInfo);
    return haploAttributeInfo;
};

var findAttrInfo = function(nodeName) {
    return _.find(P.getHaploAttributeInfo(), (a) => { return a.tag === nodeName; });
};

var logWarning = function(intermediate, warning, stat) {
    // intermediate can actually be intermediate or eprintid
    const eprintId = intermediate.eprintId || intermediate;
    log.eprints[eprintId].push(stat+": "+warning);
    if(log[stat]) { log[stat]++; }
    else{ log[stat] = 1; }
};

P.implementService("hres:repository:eprints:log-warning", function(intermediate, warning, stat) {
    logWarning(intermediate, warning, stat);
});

// TODO: use a "hres:repository:match-item-to-existing-in-list" service
var preventImport = function(cursor, intermediate, eprintId) {
    let idInfo = _.find(P.getHaploAttributeInfo(), (a) => { return a.tag === "id_number"; });
    let existingObject;
    if(O.serviceMaybe("hres:repository:eprints:prevent-import", cursor.cursor())) {
        logWarning(eprintId, "Import was stopped by a prevent-import service",
            "not_imported:prevent-import");
        return true;
    }
    if(idInfo && cursor.firstChildElementMaybe(idInfo.tag)) {
        let attribute = {};
        idInfo.xmlToIntermediate(cursor, intermediate, attribute, true);
        existingObject = attribute.properties.existingObject;
        cursor.up();
    }
    if(existingObject) { log.eprints[eprintId].push("Object already exists: "+existingObject.ref.toString()); }
    return !!existingObject;
};

// Convert from EPrints XML to intermediate
var convertXMLToIntermediate = function(cursor, eprintsName) {
    // call service for per-client customisations
    let eprintId = cursor.firstChildElement("eprintid").getText();
    log.eprints[eprintId] = [];
    cursor.up();
    let status = cursor.firstChildElement("eprint_status").getText();
    if(status !== "archive") {
        logWarning(eprintId, "Unknown status: "+status,
            "not_imported:eprint_status:"+status);
        return;
    }
    cursor.up();
    let intermediate = {
        attributes: [],
        eprintId: eprintId
    };
    if(preventImport(cursor, intermediate, eprintId)) { return; } // e.g. if the object already is in the system
    cursor.eachChildElement((c) => {
        const nodeName = c.getNodeName();
        if(!(nodeName in log.tags)) { log.tags[nodeName] = []; }
        const attrInfo = findAttrInfo(nodeName);
        if(attrInfo && attrInfo.xmlToIntermediate) {
            let attribute = {};
            attribute.tag = nodeName;
            attribute.desc = attrInfo.name ? A[attrInfo.name] : undefined;
            attrInfo.xmlToIntermediate(c.cursor(), intermediate, attribute);
        } else {
            if(!_.contains(log.tags["__not_imported"], nodeName)) {
                log.tags["__not_imported"].push(nodeName);
            }
        }
    });
    return intermediate;
};

// Convert from intermediate to StoreObject
var applyIntermediateToObject = function(intermediate, object) {
    _.each(intermediate.attributes, (attribute) => {
        if(PEOPLE_TAGS.indexOf(attribute.tag) !== -1) {
            O.service("hres:author_citation:append_citation_to_object",
                object, attribute.desc, attribute.qual, attribute.value);
        } else if(attribute.tag === "volume") {
            O.service("hres:journal_citation:append_citation_to_object",
                object, attribute.desc, attribute.qual, attribute.value);
        } else if(attribute.value) {
            object.append(attribute.value, attribute.desc, attribute.qual);
        } else {
            logWarning(intermediate, "Could not append a value for "+attribute.tag, "warning:no-value-for-tag");
            // log[intermediate.eprintId].push("Could not append a value for "+attribute.tag);
        }
    });
    let typeTitle = object.firstType().load().title;
    log.outputsByType[typeTitle] = (log.outputsByType[typeTitle] || 0) + 1;
    // TODO: not all clients will want the AcceptedIntoRepository label to be applied
    // O.impersonating(O.SYSTEM, () => { object.save(O.labelChanges().add(Label.AcceptedIntoRepository)); });
    // if(intermediate.eprintId && object.ref) {
    //     P.db.eprintsMetadata.create({ object: object.ref, eprintId: intermediate.eprintId }).save();
    // }
    // if(intermediate.embargoStartDate || intermediate.embargoEndDate) {
    //     let desc = intermediate.embargoDesc;
    //     O.serviceMaybe("hres_repo_embargoes:set_embargo", {
    //         object: object.ref,
    //         start: intermediate.embargoStartDate,
    //         end: intermediate.embargoEndDate,
    //         licenseURL: intermediate.embargoLicenseURL,
    //         desc: (!desc || desc === "all") ? null : parseInt(desc, 10)
    //     });
    // }
    // if(intermediate.ffd) {
    //     let existingFfd = O.serviceMaybe("hres_ref_repository:get_first_file_deposit", object);
    //     if(existingFfd) { // the db row created on object creation may not be historically accurate
    //         existingFfd.date = intermediate.ffd.date;
    //         existingFfd.fileVersion = intermediate.ffd.fileVersion;
    //         existingFfd.save();
    //     } else {
    //         intermediate.ffd.output = object.ref;
    //         O.serviceMaybe("hres_ref_repository:set_first_file_deposit", intermediate.ffd);
    //     }
    // }
    // if(intermediate.exception) {
    //     O.serviceMaybe("hres:repository:set_exception", {
    //         output: object.ref,
    //         exception: intermediate.exception
    //     });
    // }
};
