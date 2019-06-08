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
// Import management

P.db.table("eprintsLogging", {
    log: { type: "json" },
    digest: { type: "text", nullable: true }
});

P.db.table("eprintsMetadata", {
    object: { type: "ref" },
    eprintId: { type: "text" }
});

var log = {};

P.implementService("hres:repository:eprints:get-latest-log", function() {
    const query = P.db.eprintsLogging.select().order("id", true).limit(1);
    if(!query.count()) { O.stop("No eprints import logs found."); }
    return query[0];
});

var saveObjectWithLogging = function(object, eprintId) {
    O.impersonating(O.SYSTEM, () => { object.save(); });
    if(eprintId) {
        log.eprints[eprintId].push("New object ref: "+object.ref+", title: "+object.title);
    }
    let typeTitle = object.firstType().load().title;
    log.newObjects[typeTitle] = (log.newObjects[typeTitle] || 0) + 1;
};

P.implementService("hres:repository:eprints:save-object-with-logging", saveObjectWithLogging);

var xmlForm = P.xmlForm = P.form("xmlUpload", "form/xml_upload.json");

var getPreviousXmlFiles = P.getPreviousXmlFiles = function() {
    let files = [];
    if(P.data.fileForFileImport) {
        files.push(P.data.fileForFileImport);
    }
    let eprintsLogs = P.db.eprintsLogging.select().
        where("digest", "<>", null).order("id", true);
    eprintsLogs.each((log, idx) => {
        if(files.indexOf(log.digest) === -1) {
            files.push(log.digest);
        }
    });
    return _.map(files, digest => {
        let file = O.file(digest);
        return [digest, file.filename];
    });
};

P.respond("GET,POST", "/do/hres-repo-eprints/upload-xml", [
], function(E) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    let document = {};
    let form = xmlForm.instance(document);
    form.choices("previousXmlFiles", getPreviousXmlFiles());
    form.update(E.request);
    if(form.complete) {
        O.background.run("hres_repo_eprints:import", document);
        E.response.redirect("/do/hres-repo-eprints/admin");
    }
    E.render({
        pageTitle: "EPrints import",
        form: form
    });
});

P.backgroundCallback("import", function(document) {
    O.impersonating(O.SYSTEM, () => {
        P.data.eprintImportStatus = "RUNNING";
        log = {
            eprints: {},
            tags: { "__not_imported": [] },
            newObjects: {},
            outputsByType: {},
            start: new Date()
        }; // reset log
        let newCount = 0;
        let file;
        try {
            file = O.file(document.xmlFile.length ? document.xmlFile[0] : document.previousFile);
            let cursor = O.xml.parse(file).cursor();
            if(!cursor.firstChildElementMaybe("eprints")) { return; }
            let intermediates = [];
            cursor.eachChildElement("eprint", (c) => {
                let object = O.object();
                object.preallocateRef();
                let intermediate = convertXMLToIntermediate(c, undefined, object);
                if(intermediate) {
                    intermediates.push(intermediate);
                }
            });
            // save objects created in import process, before creating output objects
            let objectsFromClient = O.serviceMaybe("hres:repository:eprints:get-objects-to-save") || [];
            _.each(objectsToSave.concat(objectsFromClient), (o) => {
                const type = o.firstType();
                if(!type) {
                    if(!log.errors) { log.errors = []; }
                    log.errors.push("ERROR: no type for object, cannot save to Haplo: "+o.ref);
                    return;
                }
                saveObjectWithLogging(o);
            });
            _.each(intermediates, i => {
                if(i) {
                    applyIntermediateToObject(i, i.output);
                    newCount++;
                }
            });
            P.data.eprintImportStatus = "DONE";
        } catch(e) {
            P.data.eprintImportStatus = "ERROR";
            log["ERROR:unsuccessful_import"] = "EXCEPTION: Error during import: " +
                e.message + ". File: " + e.fileName + ", line: " + e.lineNumber +
                ", current eprintid: " + P.data.eprintId;
        }
        log.end = new Date();
        log.totalEprintsImported = newCount;
        P.db.eprintsLogging.create({log:log, digest:file&&file.digest}).save();
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
    "item_issues_count",
    "succeeds"
];

var getImportIgnoreTags = function() {
    O.serviceMaybe("hres:repository:eprints:import-ignore-tags", IGNORE_TAGS);
    return IGNORE_TAGS;
};

var prepareLog = function(row) {
    let log = row.log;
    let temp = {};
    _.each(log.eprints, (v, k) => { if(v.length) { temp[k] = v; } });
    log.eprints = temp;

    const ignoreTags = getImportIgnoreTags();
    let unimportedTags = _.difference(log.tags["__not_imported"], ignoreTags);
    if(unimportedTags.length) {
        log["ERROR:unimported_tags"] = unimportedTags;
    }
    log = _.omit(log, "tags"); // don't want other info about tags here
    log = JSON.stringify(log, undefined, 2);
    return log;
};

P.respond("GET", "/do/hres-repo-eprints/log", [
    {pathElement:0, as:"db", table:"eprintsLogging"}
], function(E, row) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    let file = row.digest ? O.file(row.digest) : undefined;
    E.render({
        log: prepareLog(row),
        file: file ? { name: file.filename, url: file.url() } : undefined,
        row: row.id
    });
});

P.respond("GET", "/do/hres-repo-eprints/download-log", [
    {pathElement:0, as:"db", table:"eprintsLogging"}
], function(E, row) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    E.response.body = prepareLog(row);
    E.response.kind = "json";
    E.response.headers['Content-Disposition'] = 'attachment; filename="eprint-import-'+row.id+'.json"';
});

P.respond("GET", "/do/hres-repo-eprints/regex-cheatsheet", [
    {pathElement:0, as:"string"}
], function(E, row) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    E.render({ row: row });
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

// TODO: if P.DOI.isDOI(url) || P.Handle.isHandle(url), then append to those attrs (if in system)
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
        if(!person.properties.name || !person.properties.name.given || !person.properties.name.family) {
            logWarning(intermediate, "Cannot cite person without given and family names specified", "error:person-missing-names");
            return;
        }
        if(person.properties.id) {
            let email = O.text(O.T_IDENTIFIER_EMAIL_ADDRESS, id);
            let q = O.query().identifier(email, A.Email).execute();
            if(q.length) {
                person.value = {object:q[0]};
                hasPersonInSystem = true;
            } else {
                if(O.serviceImplemented("hres:repository:eprints:create-past-researcher-for-id")) {
                    if(O.service("hres:repository:eprints:create-past-researcher-for-id", id)) {
                        let newPerson = O.object();
                        newPerson.appendType(T.ResearcherPast);
                        newPerson.appendTitle(O.text(O.T_TEXT_PERSON_NAME, {
                            title: "",
                            first: person.properties.name.given,
                            last: person.properties.name.family
                        }));
                        newPerson.append(O.text(O.T_IDENTIFIER_EMAIL_ADDRESS, id), A.Email);
                        saveObjectWithLogging(newPerson, intermediate.eprintId);
                        person.value = newPerson;
                    }
                }
            }
            if(!person.value) {
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
    if(attribute.tag === "creators" && !hasPersonInSystem) {
        logWarning(intermediate, "No user in system found for "+attribute.tag,
            "warning:"+attribute.tag+":no-user-found");
    }
};

var setExhibitorCitation = function(cursor, intermediate, attribute) {
    cursor.up();
    if("Exhibitor" in Q && cursor.getTextOfFirstChildElementMaybe("type") === "exhibition") {
        cursor.firstChildElement("exhibitors");
        attribute.qual = Q.Exhibitor;
        setPersonCitation(cursor, intermediate, attribute);
    }
};

var TYPE_MAP = {
    types: {
        "book": "Book",
        "book_section": "BookChapter",
        "monograph": "Report",
        "monograph.other": "Report",
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
        "thesis.pro_doc": "ProfDocThesis",
        "video": {
            type: "DigitalOrVisualMedia",
            attr: { attr:"MediaType", behaviour:"hres:list:media-type:video" }
        },
        "web_resource": "Website",
        "design": "Design",
        "design.other": "Design",
        "other": "Other"
    },
    subtypeKeys: ["monograph_type", "pres_type", "thesis_type"]
};

var DEFAULT_TYPE = T.Other;

var _typeMap;
var getTypeMap = function() {
    if(!_typeMap) {
        _typeMap = TYPE_MAP;
        O.serviceMaybe("hres-repo-eprints:modify-import-type-map", _typeMap);
    }
    return _typeMap;
};

// add the tag type combination to the logs
var logType = function(type, tag, eprintId) {
    if(!_.contains(log.tags[tag], type)) {
        log.tags[tag].push(type);
        log.tags[tag].push(type + " ("+eprintId+")");
    }
};

var setType = function(cursor, intermediate, attribute) {
    let rootPath = cursor.getText();
    cursor.up();
    logType(rootPath, attribute.tag, intermediate.eprintId);
    let type, searchPath;
    const typeMap = getTypeMap();
    // are there any subtypes that, when combined with the root type, are defined in the map?
    const hasDefinedSubtype = _.some(typeMap.subtypeKeys, (st) => {
        if(cursor.firstChildElementMaybe(st)) {
            searchPath = rootPath+'.'+cursor.getText();
            cursor.up();
            logType(searchPath, attribute.tag, intermediate.eprintId);
            return searchPath in typeMap.types;
        }
    });
    if(!hasDefinedSubtype) {
        if(searchPath) {
            logWarning(intermediate, "Falling back to root type after subtype not found in mapping",
                "warning:no-subtype:"+searchPath);
        }
        searchPath = rootPath in typeMap.types ? rootPath : undefined;
    }
    if(searchPath) {
        type = typeMap.types[searchPath];
        if(typeof type !== "string") {
            if(type.attr.attr in A) {
                intermediate.attributes.push(_.extend({}, attribute, {
                    desc: A[type.attr.attr],
                    value: O.behaviourRef(type.attr.behaviour)
                }));
            }
            type = type.type;
        }
        attribute.value = type in T ? T[type] : undefined;
    }
    if(!attribute.value) {
        logWarning(intermediate, "ERROR no type found for "+(searchPath || rootPath),
            "ERROR:no-type:"+(searchPath || rootPath));
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
        let data = {};
        cursor.up();
        if(cursor.firstChildElementMaybe("rioxx2_license_ref_input")) {
            if(cursor.firstChildElementMaybe("license_ref")) {
                data.license = cursor.getText();
                cursor.up();
            }
            if(cursor.firstChildElementMaybe("start_date")) {
                data.start = cursor.getText();
                cursor.up();
            }
        }
        intermediate.embargoData.push(data);
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
    "pub": "hres:list:output-status:published",
    "submitted": "hres:list:output-status:submitted"
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

var normalise = function(text) {
    return text.trim().toLowerCase().replace("&", "and").replace(/[^a-z0-9]/g, "");
};
P.implementService("hres-repo-eprints:normalise", normalise);
var objectsToSave = [];
var normalisedTitlesForType = O.refdict(function(type) {
    let lookup = {};
    let objs = O.query().link(type, A.Type).execute();
    _.each(objs, o => {
        let nTitle = normalise(o.title);
        if(!lookup[nTitle]) {
            lookup[nTitle] = o;
        }
    });
    return lookup;
});
P.implementService("hres-repo-eprints:getNormalisedTitlesForType", function(type) {
    return normalisedTitlesForType.get(type);
});
var updateTitleLookup = function(type, object, intermediate) {
    let lookup = normalisedTitlesForType.get(type);
    let title = object.title;
    if(!title) {
        logWarning(intermediate, "Could not update title lookups or create object with type: "+type+
            " did not have a title", "warning:object-not-created");
    }
    let nTitle = normalise(title);
    if(!lookup[nTitle]) {
        lookup[nTitle] = object;
        normalisedTitlesForType.set(type, lookup);
        object.preallocateRef(); // so that it can be appended to outputs, which happens before objects are saved
        objectsToSave.push(object);
    }
};
P.implementService("hres-repo-eprints:updateNormalisedTitlesForType", function(type, object, intermediate) {
    return updateTitleLookup(type, object, intermediate);
});

var setRefForTitle = function(intermediate, attribute, objectTitle, type) {
    let match = normalisedTitlesForType.get(type)[normalise(objectTitle)];
    if(match) {
        attribute.value = match;
    } else {
        let newObject = O.object();
        newObject.append(type, A.Type);
        newObject.appendTitle(objectTitle);
        updateTitleLookup(type, newObject);
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

var setDOI = function(cursor, intermediate, attribute) {
    try {
        attribute.value = P.DOI.create(cursor.getText());
        intermediate.attributes.push(attribute);
    } catch(e) {
        attribute.properties = {};
        logWarning(intermediate, "Invalid DOI: "+cursor.getText(), "warning:invalid-doi-found");
    }
};

var fileMap = {
    "published": "hres:attribute:published-file",
    "accepted": "hres:attribute:accepted-author-manuscript",
    "supplemental": "hres:attribute:supplemental-file"
};

var licenseMap = {
    "cc_by": "hres:list:license:cc-by",
    "cc_by_4": "hres:list:license:cc-by:4",
    "cc_by_sa": "hres:list:license:cc-by-sa",
    "cc_by_sa_4": "hres:list:license:cc-by-sa:4",
    "cc_by_nc": "hres:list:license:cc-by-nc",
    "cc_by_nc_4": "hres:list:license:cc-by-nc:4",
    "cc_by_nd": "hres:list:license:cc-by-nd",
    "cc_by_nd_4": "hres:list:license:cc-by-nd:4",
    "cc_by_nc_sa": "hres:list:license:cc-by-nc-sa",
    "cc_by_nc_sa_4": "hres:list:license:cc-by-nc-sa:4",
    "cc_by_nc_nd": "hres:list:license:cc-by-nc-nd",
    "cc_by_nc_nd_4": "hres:list:license:cc-by-nc-nd:4",
};

var setFile = function(cursor, intermediate, attribute) {
    cursor.eachChildElement("document", (dc) => {
        if(P.ignoreDocument(dc)) { return; }
        let fileAttr = _.clone(attribute);
        const contentType = dc.getTextOfFirstChildElementMaybe("content");
        let fileDesc;
        if(contentType && (contentType in fileMap) && (fileMap[contentType] in A)) {
            fileDesc = A[fileMap[contentType]];
        }
        let extension = {
            desc: fileDesc || fileAttr.desc
        };
        let exAttrs = [];
        let license = dc.getTextOfFirstChildElementMaybe("license");
        license = (license && licenseMap[license]) ? O.behaviourRef(licenseMap[license]) : undefined;
        if(license) {
            exAttrs.push({
                desc: A.License,
                value: license
            });
        }
        if(dc.firstChildElementMaybe("files")) {
            dc.eachChildElement("file", (fc) => {
                const url = fc.getAttribute("id");
                if(url) {
                    const query = P.db.downloadedFiles.select().
                        where('url', '=', url).
                        limit(1);
                    let digest = query.count() ? query[0].digest : undefined;
                    if(digest) {
                        exAttrs.push({
                            desc: A.File,
                            value: O.file(digest).identifier()
                        });
                    } else {
                        logWarning(intermediate, "Could not find file for url: "+url,
                            "error:no-file");
                    }
                } else {
                    logWarning(intermediate, "No url given for file",
                        "error:no-file-url");
                }
            });
         } else {
             logWarning(intermediate, "No files tag", "error:files-tag-missing");
         }
        dc.up();
        let securityLevel = dc.getTextOfFirstChildElementMaybe("security");
        let embargo;
        if(securityLevel === "staffonly") {
            embargo = {};
            embargo.end = dc.getTextOfFirstChildElementMaybe("date_embargo");
            dc.up(); // to documents
            dc.up(); // to eprint
            if(dc.firstChildElementMaybe("rioxx2_license_ref_input")) {
                if(dc.firstChildElementMaybe("license_ref")) {
                    embargo.license = dc.getText();
                    dc.up();
                }
                if(dc.firstChildElementMaybe("start_date")) {
                    embargo.start = dc.getText();
                }
            }
        } else if(securityLevel === "validuser") {
            if("AccessLevel" in A) {
                exAttrs.push({
                    desc: A.AccessLevel,
                    value: O.behaviourRef("hres:list:file-access-level:controlled")
                });
            } else {
                logWarning(intermediate, "Must install hres_repo_access_level_policy to enable validuser file security level",
                    "ERROR:missing-plugin:access-level-policy");
            }
        }
         if(exAttrs.length) {
            extension.attributes = exAttrs;
            extension.embargo = embargo;
            fileAttr.extension = extension;
            intermediate.attributes.push(fileAttr);
         }
     });
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
    "submitted": {desc:"PublicationProcessDates",   qual:"Submitted"},
    "accepted":  {desc:"PublicationProcessDates",   qual:"Accepted"},
    "completed": {desc:"PublicationProcessDates",   qual:"Completed"},
    "published": {desc:"PublicationDates",          qual:"Print"},
    "published_online": {desc:"PublicationDates",   qual:"Online"}
};

// return a valid datetime object if dateString is of standard format
var standardDateParse = function(dateString) {
    const formatWithPrecision = [
        ["YYYY-MM-DD", O.PRECISION_DAY],
        ["YYYY-MM", O.PRECISION_MONTH],
        ["YYYY", O.PRECISION_YEAR]
    ];
    let date;
    _.each(formatWithPrecision, f => {
        const dateMaybe = moment(dateString, f[0], true);
        if(dateMaybe.isValid()) {
            date = O.datetime(dateMaybe.toDate(), undefined, f[1]);
        }
    });
    return date;
};

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
                const dateMaybe = standardDateParse(date);
                if(dateMaybe) {
                    dateAttribute.value = dateMaybe;
                    intermediate.attributes.push(dateAttribute);
                } else {
                    logWarning(intermediate, "Invalid date format: "+date,
                        "warning:invalid-date-format");
                }
            }
        } else {
            logWarning(intermediate, "Not enough information to add date",
                "warning:invalid-date");
        }
    });
};

var setDateOfType = function(cursor, intermediate, attribute, dateType) {
    const dateInfo = dateMap[dateType];
    attribute.desc = A[dateInfo.desc];
    attribute.qual = Q[dateInfo.qual];
    const date = cursor.getText();
    const dateMaybe = standardDateParse(date);
    if(dateMaybe) {
        attribute.value = dateMaybe;
        intermediate.attributes.push(attribute);
    } else {
        logWarning(intermediate, "Invalid date format: "+date,
            "warning:invalid-date-format");
    }
};

var setPublishedDate = function(cursor, intermediate, attribute) {
    const date = cursor.getText();
    let setDate = true;
    cursor.up();
    if(cursor.firstChildElementMaybe("dates")) {
        cursor.eachChildElement("item", dc => {
            const dateType = dc.getTextOfFirstChildElementMaybe("date_type");
            if(dateType === "published_online" || dateType === "published") {
                if(dc.getTextOfFirstChildElementMaybe("date") === date) {
                    setDate = false;
                }
            }
        });
    }
    if(setDate) {
        setDateOfType(cursor, intermediate, attribute, "published");
    }
};

var setAcceptedDate = function(cursor, intermediate, attribute) {
    setDateOfType(cursor, intermediate, attribute, "accepted");
};

var setDepositedDate = function(cursor, intermediate, attribute) {
    let date = new XDate(cursor.getText());
    if(date.valid()) {
        attribute.value = O.datetime(date);
        attribute.qual = Q.Deposited;
        intermediate.attributes.push(attribute);
    } else {
        logWarning(intermediate, "Could not set deposited date: "+cursor.getText(),
            "warning:deposited-date");
    }
};

var setExternalEvent = function(cursor, intermediate, attribute) {
    let event = O.object();
    let eventTitle = cursor.getText();
    event.append(eventTitle, A.Title);
    cursor.up();
    if(cursor.firstChildElementMaybe("event_location")) {
        event.append(cursor.getText(), A.Location);
        cursor.up();
    }
    if(cursor.firstChildElementMaybe("event_dates")) {
        let eventDate = getEventDate(cursor);
        if(eventDate) {
            event.append(eventDate, A.EventDate);
        }
        cursor.up();
    }
    let type = T.ExternalEvent;
    if(cursor.firstChildElementMaybe("event_type")) {
        let t = cursor.getText();
        let eventType = {
            "conference": T.Conference,
            "exhibition": T.ExhibitionEvent,
            "workshop": T.Workshop
        }[t];
        type = eventType || type;
        if(!eventType) {
            logWarning(intermediate, "Unknown external event type: "+t,
                "warning:unknown-event-type");
        }
    }
    event.appendType(type);
    // check the same event doesn't already exist
    let eventQuery = O.query().
        link(T.ExternalEvent, A.Type).
        exactTitle(eventTitle).
        execute();
    const matchingEvent = _.find(eventQuery, e => e.valuesEqual(event));
    if(matchingEvent) {
        event = matchingEvent;
    } else {
        saveObjectWithLogging(event, intermediate.eprintId);
    }
    attribute.value = event;
    intermediate.attributes.push(attribute);
};

// TODO: this can be improved with the new O.dateParser next import implementation
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

var setFirstOpenAccess = function(cursor, intermediate, attribute) {
    let foaDate = new XDate(cursor.getText());
    if(foaDate.valid()) {
        intermediate.foa = foaDate.toDate();
    } else {
        logWarning(intermediate, "Cannot add first compliant Open Access with date: "+foaDate,
            "warning:first-open-access");
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
    const exception = REF_EXCEPTION_TAG_LOOKUP[exceptionGroup+"_"+exceptionLetter];
    const evidence = cursor.up().getTextOfFirstChildElementMaybe(exceptionGroup+"_txt");
    intermediate.exception = {
        exception: exception,
        evidence: evidence
    };
};

var setOtherREFException = function(cursor, intermediate, attribute) {
    intermediate.exception = {
        exception: "other",
        evidence: cursor.getText()
    };
};

var setFunders = function(cursor, intermediate, attribute) {
    cursor.eachChildElement("item", funderCursor => {
        let funderAttribute = _.clone(attribute);
        setRefForTitle(intermediate, funderAttribute, funderCursor.getText(), T.Funder);
        intermediate.attributes.push(funderAttribute);
    });
};

// --------------------------------------------------------------------------

var PEOPLE_TAGS = ["creators", "editors", "book_creators", "exhibitors"];

var haploAttributeInfo = [
    {name: "Title",                 tag: "title",           xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "Type",                  tag: "type",            xmlToIntermediate: setType,                 objectToIntermediate: P.typeAttr},
    {name: "Date",                  tag: "date",            xmlToIntermediate: setYear},
    {name: "Date",                  tag: "dates",           xmlToIntermediate: setDates}, // dates span several attributes, and
    {name: "PublicationProcessDates",tag: "dates",                                                      objectToIntermediate: P.datesAttr}, // export needs to only look to one, but
    {name: "PublicationDates",      tag: "dates",                                                       objectToIntermediate: P.datesAttr}, // import needs to look at all
    {name: "PublicationDates",      tag: "hoa_date_pub",    xmlToIntermediate: setPublishedDate,        objectToIntermediate: P.publishedDate},
    {name: "PublicationProcessDates",tag: "datestamp",      xmlToIntermediate: setDepositedDate,        objectToIntermediate: P.depositedDateAttr},
    {name: "PublicationProcessDates",tag: "hoa_date_acc",   xmlToIntermediate: setAcceptedDate,         objectToIntermediate: P.acceptedDateAttr},
    {name: "Abstract",              tag: "abstract",        xmlToIntermediate: setParagraph,            objectToIntermediate: P.textAttr},
    {name: "Keywords",              tag: "keywords",        xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "Publisher",             tag: "publisher",       xmlToIntermediate: setPublisher,            objectToIntermediate: P.refTitleAttr},
    {name: "Journal",               tag: "publication",     xmlToIntermediate: setPublication,          objectToIntermediate: P.refTitleAttr},
    {name: "Author",                tag: "creators",        xmlToIntermediate: setPersonCitation},
    {name: "Editor",                tag: "editors",         xmlToIntermediate: setPersonCitation},
    {name: "AuthorsCitation",       tag: "creators",                                                    objectToIntermediate: P.personAttr},
    {name: "EditorsCitation",       tag: "editors",                                                     objectToIntermediate: P.personAttr},
    {name: "BookTitle",             tag: "book_title",      xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "BookAuthorShadowed",    tag: "book_creators",   xmlToIntermediate: setPersonCitation},
    {name: "ContributorShadowed",   tag: "exhibitors",      xmlToIntermediate: setExhibitorCitation},
    {name: "BookAuthor",            tag: "book_creators",                                               objectToIntermediate: P.personAttr},
    {name: "Contributors",          tag: "contributors",                                                objectToIntermediate: P.contributorsAttr},
    {name: "Edition",               tag: "edition",         xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "PlaceOfPublication",    tag: "place_of_pub",    xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "Isbn",                  tag: "isbn",            xmlToIntermediate: setIsbn,                 objectToIntermediate: P.textAttr},
    {name: "Issn",                  tag: "issn",            xmlToIntermediate: setIsbn,                 objectToIntermediate: P.textAttr},
    {name: "ResearchInstitute",     tag: "subjects",        /*import to be implemented in client impl*/ objectToIntermediate: P.subjectsAttr},
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
    {name: "Event",                 tag: "event_title",     xmlToIntermediate: setExternalEvent,        objectToIntermediate: P.externalEventAttr},
    {name: "Series",                tag: "series",          xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "OutputMedia",           tag: "output_media",    xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "PeerReview",            tag: "refereed",        xmlToIntermediate: setPeerReview,           objectToIntermediate: P.peerReviewAttr},
    {name: "InstitutionName",       tag: "institution",     xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "DepartmentName",        tag: "department",      xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "Pages",                 tag: "pages",           xmlToIntermediate: setText,                 objectToIntermediate: P.textAttr},
    {name: "Notes",                 tag: "note",            xmlToIntermediate: setParagraph,            objectToIntermediate: P.textAttr},
    {name: "WebAddressUrl",         tag: "official_url",    xmlToIntermediate: setUrl,                  objectToIntermediate: P.textAttr},
    {name: "REFUnitOfAssessment",   tag: "hoa_ref_pan",                                                 objectToIntermediate: P.refUoaAttr},
    {name: "Funder",                tag: "funders",         xmlToIntermediate: setFunders,              objectToIntermediate: P.refTitleAttr},
    {name: "RetentionReviewDate",   tag: "retention_date",                                              objectToIntermediate: P.simpleDateAttr},
    {name: "RetentionReviewAction", tag: "retention_action",                                            objectToIntermediate: P.textAttr},
    {name: "DataCollectionMethod",  tag: "collection_method",                                           objectToIntermediate: P.textAttr},
    {name: "CollaboratingInstitution",tag: "collab_inst",                                               objectToIntermediate: P.textAttr},
    {name: "GrantID",               tag: "grant",                                                       objectToIntermediate: P.textAttr},
    // if tag information results in change to database, not attribute, set database to true
    {database: true,                tag: "full_text_status",xmlToIntermediate: setEmbargoStatus,        objectToIntermediate: P.embargoAttrs},
    {database: true,                tag: "hoa_date_fcd",    xmlToIntermediate: setFirstFileDeposit,     objectToIntermediate: P.firstFileDepositAttr},
    {database: true,                tag: "hoa_date_foa",    xmlToIntermediate: setFirstOpenAccess,      objectToIntermediate: P.firstOpenAccessAttr},
    {database: true,                tag: "hoa_ex_dep",      xmlToIntermediate: setREFException          /*This information is private, do not export*/},
    {database: true,                tag: "hoa_ex_tec",      xmlToIntermediate: setREFException},
    {database: true,                tag: "hoa_ex_acc",      xmlToIntermediate: setREFException},
    {database: true,                tag: "hoa_ex_oth_txt",  xmlToIntermediate: setOtherREFException},
    {database: true,                tag: "rev_number",                                                  objectToIntermediate: P.versionNumber}
];

var _haploAttributeInfo;

P.getHaploAttributeInfo = function() {
    if(!_haploAttributeInfo) {
        // remove any attributes that aren't defined in the application's schema
        haploAttributeInfo = _.filter(haploAttributeInfo, (a) => {
            return a.name in A || a.database;
        });
        O.serviceMaybe("hres:repository:eprints:modify-attribute-info", haploAttributeInfo);
        _haploAttributeInfo = haploAttributeInfo;
    }
    return _haploAttributeInfo;
};

var findAttrInfo = function(nodeName, allowMultiple) {
    return allowMultiple ? _.filter(P.getHaploAttributeInfo(), (a) => { return a.tag === nodeName; }) :
        _.find(P.getHaploAttributeInfo(), (a) => { return a.tag === nodeName; });
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

P.implementService("hres:repository:eprints:modify-log", function(modifyFn) {
    modifyFn(log);
});

var _matchServices;
var matchServices = function() {
    if(!_matchServices) {
        _matchServices = O.service("haplo:service-registry:query", [
            "conforms-to hres:repository:match-item-to-existing-in-list",
            "list-of repository-items"
        ]);
    }
    return _matchServices;
};

var preventImport = function(cursor, intermediate, eprintId) {
    if(O.serviceMaybe("hres:repository:eprints:prevent-import", cursor.cursor())) {
        logWarning(eprintId, "Import was stopped by a prevent-import service",
            "not_imported:prevent-import");
        return true;
    }
    const idTags = O.serviceMaybe("hres:repository:eprints:id-tags") || ["id_number"];
    let testObject = O.object();
    let testIntermediate = {
        attributes: [],
        eprintId: intermediate.eprintId
    };
    _.each(idTags, tag => {
        const info = findAttrInfo(tag);
        if(info && cursor.firstChildElementMaybe(info.tag)) {
            let attribute = {
                tag: tag,
                desc: info.name ? A[info.name] : undefined
            };
            info.xmlToIntermediate(cursor, testIntermediate, attribute);
            cursor.up();
        }
    });
    _.each(testIntermediate.attributes, a => testObject.append(a.value, a.desc, a.qual));
    const allRepositoryItems = O.query().
        link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), A.Type).
        execute();
    let matchObject;
    matchServices().eachService(matcher => {
        if(matchObject) { return; }
        matchObject = O.service(matcher.name, testObject, allRepositoryItems);
    });
    if(matchObject) {
        logWarning(eprintId, "Not importing because object already exists: "+matchObject.ref.toString(),
            "warning:object-exists");
    }
    return !!matchObject;
};

// Convert from EPrints XML to intermediate
var convertXMLToIntermediate = function(cursor, eprintsName, output) {
    // call service for per-client customisations
    let eprintId = cursor.firstChildElement("eprintid").getText();
    log.eprints[eprintId] = [];
    P.data.eprintId = eprintId; // for debugging, since can't rely on object key ordering
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
        eprintId: eprintId,
        embargoData: [],
        output: output
    };
    if(preventImport(cursor, intermediate, eprintId)) { return; } // e.g. if the object already is in the system
    // some tags are repeated in the haploAttributeInfo structure, with various combinations of import & export fns
    let tagsWithImportFunction = [];
    let tagsWithoutImportFunction = [];
    cursor.eachChildElement((c) => {
        const nodeName = c.getNodeName();
        if(!(nodeName in log.tags)) { log.tags[nodeName] = []; }
        const attrInfo = findAttrInfo(nodeName, true);
        if(attrInfo.length > 0) {
            _.each(attrInfo, i => {
                if(i && i.xmlToIntermediate) {
                    let attribute = {};
                    attribute.tag = nodeName;
                    attribute.desc = i.name ? A[i.name] : undefined;
                    i.xmlToIntermediate(c.cursor(), intermediate, attribute);
                    if(tagsWithImportFunction.indexOf(nodeName) === -1) {
                        tagsWithImportFunction.push(nodeName);
                    }
                } else {
                    if(tagsWithoutImportFunction.indexOf(nodeName) === -1) {
                        tagsWithoutImportFunction.push(nodeName);
                    }
                }
            });
        } else {
            if(tagsWithoutImportFunction.indexOf(nodeName) === -1) {
                tagsWithoutImportFunction.push(nodeName);
            }
        }
    });
    _.each(tagsWithoutImportFunction, tag => {
        if((tagsWithImportFunction.indexOf(tag) === -1) && (log.tags["__not_imported"].indexOf(tag) === -1)) {
            log.tags["__not_imported"].push(tag);
        }
    });
    return intermediate;
};

// Convert from intermediate to StoreObject
var applyIntermediateToObject = function(intermediate, object) {
    const peopleTags = O.serviceMaybe("hres:repository:eprints:get-people-tags") || PEOPLE_TAGS;
    _.each(intermediate.attributes, (attribute) => {
        if(peopleTags.indexOf(attribute.tag) !== -1) {
            O.service("hres:author_citation:append_citation_to_object",
                object, attribute.desc, attribute.qual, attribute.value);
        } else if(attribute.tag === "volume") {
            O.service("hres:journal_citation:append_citation_to_object",
                object, attribute.desc, attribute.qual, attribute.value);
        } else if(attribute.extension) { // an extension has to be created all in one go
            let ex = attribute.extension;
            let extension = object.newAttributeGroup(ex.desc);
            _.each(ex.attributes, exAttr => {
                object.append(exAttr.value, exAttr.desc, exAttr.qual, extension);
            });
            if(ex.embargo) {
                ex.embargo.extensionGroup = extension.groupId;
                ex.embargo.desc = ex.desc;
                intermediate.embargoData.push(ex.embargo);
            }
        } else if(attribute.value) {
            if(!object.has(attribute.value, attribute.desc, attribute.qual)) {
                object.append(attribute.value, attribute.desc, attribute.qual);
            } else {
                // check if the value is only appended in groups, not on the object directly
                let onlyInGroup = true;
                object.every(attribute.desc, attribute.qual, (v,d,q,x) => {
                    if(!onlyInGroup) { return; }
                    let valueMatch = O.isRef(attribute.value) ? (attribute.value == v) : (attribute.value === v);
                    if(!valueMatch) { return; }
                    onlyInGroup = !!x; // if x is defined, this value belongs to a group
                });
                if(onlyInGroup) {
                    object.append(attribute.value, attribute.desc, attribute.qual);
                }
            }
        } else {
            logWarning(intermediate, "Could not append a value for "+attribute.tag, "warning:no-value-for-tag");
        }
    });
    let typeTitle = object.firstType().load().title;
    log.outputsByType[typeTitle] = (log.outputsByType[typeTitle] || 0) + 1;
    // TODO: not all clients will want the AcceptedIntoRepository label to be applied
    O.impersonating(O.SYSTEM, () => { object.save(O.labelChanges().add(Label.AcceptedIntoRepository)); });
    if(intermediate.eprintId && object.ref) {
        P.db.eprintsMetadata.create({ object: object.ref, eprintId: intermediate.eprintId }).save();
    }
    _.each(intermediate.embargoData, embargoData => {
        // if has embargo data, want to throw error immediately if this service is not available
        O.service("hres_repo_embargoes:set_embargo", {
            object: object.ref,
            customStart: embargoData.start,
            embargoLength: embargoData.embargoLength,
            end: embargoData.end,
            licenseURL: embargoData.license,
            desc: embargoData.desc || null,
            extensionGroup: embargoData.extensionGroup || null
        });
    });
    if(intermediate.embargoData.length) {
        // without a specific start or publication date, the embargoes plugin sets embargo to today,
        // which isn't appropriate in an import
        const embargoes = O.service("hres_repo_embargoes:get_embargo", object);
        _.each(embargoes, (em) => {
            if(em.start.setHours(0,0,0,0) === new Date().setHours(0,0,0,0)) {
                logWarning(intermediate,
                    "Embargo start date unknown or set in the future, setting to today instead",
                    "WARNING:embargo:start-today");
            }
        });
    }
    if(intermediate.ffd) {
        let existingFfd = O.serviceMaybe("hres_ref_repository:get_first_file_deposit", object);
        if(existingFfd) { // the db row created on object creation may not be historically accurate
            existingFfd.date = intermediate.ffd.date;
            existingFfd.fileVersion = intermediate.ffd.fileVersion;
            existingFfd.save();
        } else {
            intermediate.ffd.output = object.ref;
            O.serviceMaybe("hres_ref_repository:set_first_file_deposit", intermediate.ffd);
        }
    }
    if(intermediate.foa) {
        O.serviceMaybe("hres_ref_repository:set_first_open_access", {
            output: object.ref,
            date: intermediate.foa
        });
    }
    if(intermediate.exception) {
        let exceptionRow = {
            output: object.ref,
            exception: intermediate.exception.exception
        };
        if(intermediate.exception.evidence) {
            exceptionRow.evidence = intermediate.exception.evidence;
        }
        O.serviceMaybe("hres:repository:set_exception", exceptionRow);
    }
};
