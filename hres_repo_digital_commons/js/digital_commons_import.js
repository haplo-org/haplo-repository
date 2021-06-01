/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.backgroundCallback("import", function(document) {
    let fileDigests = document.file.length ? document.file : [document.previousFile];
    let files = _.map(fileDigests, (digest) => { return O.file(digest); });
    let context = new ImportContext(files);
    context.importDigitalCommonsMetadata();
});

P.db.table("importLogging", {
    status: { type: "text", nullable: true },
    log: { type: "json" },
    digest: { type: "text", nullable: true }
});

P.db.table("legacyURLsForObjects", {
    object: { type: "ref" },
    digitalCommonsURL: { type: "text" }
});

// --------------------------------------------------------------------------
// ImportContext -- An instance of a data import
// --------------------------------------------------------------------------

var ImportContext = P.ImportContext = function(files) {
    this._files = files;

    this.log = {
        digitalCommonsRecords: {},
        fields: {
            controlledLists: {},
            notImported: {},
            missingControlledFieldValues: {}
        },
        errors: {},
        warnings: {},
        newObjects: {},
        outputsByType: {},
        attachedFiles: {},
        start: new Date()
    };
    const logRow = P.db.importLogging.create({
        status: "Starting...",
        log: this.log,
        digest: (this._files && this._files.length === 1) ? this._files[0].digest : null
    }).save();
    this.logID = logRow.id;

    this.intermediates = [];
    this.additionalStoreObjectsCreated = {
        saveBeforeOutputs: [],
        saveAfterOutputs: []
    };
    this._normalisedTitlesForType = O.refdict((type) => {
        let lookup = {};
        O.query().link(type, A.Type).execute().each((o) => {
            const normalised = this._normalise(o.title);
            if(!lookup[normalised]) {
                lookup[normalised] = o;
            }
        });
        return lookup;
    });
    this._personLookupList = [];
    O.query().link(T.Person, A.Type).execute().each((person) => this.addPersonToLookupList(person) );
    O.serviceMaybe("hres_repo_digital_commons:import:setup_context", this);
};

ImportContext.prototype = {

    importDigitalCommonsMetadata() {
        this._updateImportStatus("Reading data...");
        // Create intermediate from Digital Commons data
        if(this._files) {
            _.each(this._files, (file) => {
                let document = JSON.parse(file.readAsString("UTF-8"));
                this._importDigitalCommonsJSON(document);
            });
        } else {
            // only for test runner, where no files will be passed in
            this._importDigitalCommonsJSON(this.__TEST__document);
        }
        this._updateImportStatus("Saving data...");
        // Order is important for saving objects, where either: the intermediate collects additional information for
        // the additional object, so it must be saved second; or the output calculates data from the additional
        // object, so it must be saved first.
        _.each(this.additionalStoreObjectsCreated.saveBeforeOutputs, (toAdd) => this._saveAdditionalObject(toAdd));
        _.each(this.intermediates, (i) => this._saveIntermediate(i) );
        _.each(this.additionalStoreObjectsCreated.saveAfterOutputs, (toAdd) => this._saveAdditionalObject(toAdd));
        this._cleanLogForReporting();
        this._updateImportStatus("Complete");
    },

    getObjectForTitle(intermediate, title, type, options) {
        if(!options) { options = {}; }
        const normalised = this._normalise(title);
        const lookup = this._normalisedTitlesForType.get(type);
        let object = lookup[normalised];
        if(!object && !options.preventObjectCreation) {
            object = O.object();
            object.append(type, A.Type);
            object.append(title, A.Title);
            object.preallocateRef();
            if(options.saveBeforeOutputs) {
                this.additionalStoreObjectsCreated.saveBeforeOutputs.push({
                    object: object,
                    digitalCommonsURL: intermediate.digitalCommonsURL
                });
            } else {
                this.additionalStoreObjectsCreated.saveAfterOutputs.push({
                    object: object,
                    digitalCommonsURL: intermediate.digitalCommonsURL
                });
            }
            lookup[normalised] = object;
            this._normalisedTitlesForType.set(type, lookup);
        }
        return object;
    },

    addPersonToLookupList(object) {
        const fields = object.firstTitle().toFields();
        if(!fields.first) {
            this.warn({digitalCommonsURL:"none"}, "person-title-without-name-fields", "A person object was found with a title not split into name fields: "+object.ref);
            return;
        }
        if(this.getPerson(fields)) { return; }    // ensure only one person for each first/last name combo
        this._personLookupList.push({
            firstNames: this._normalise(fields.first),
            lastName: this._normalise(fields.last),
            ref: object.ref
        });
    },

    getPerson(nameInfo) {
        // gathering of the name details has failed - return
        if(!((nameInfo.first && nameInfo.last) || nameInfo.fullName)) { return; }
        let first;
        let last;
        if(nameInfo.first && nameInfo.last) {
            first = nameInfo.first;
            last = nameInfo.last;
        } else {
            const names = nameInfo.fullName.split(" ");
            first = names[0];
            last = names[names.length-1]; // ignore any possible middle names, as they're often just initials in DC
        }
        const person = _.find(this._personLookupList, (p) => {
            return (p.lastName === this._normalise(last) &&
                p.firstNames.includes(this._normalise(first)));  // Haplo objects might include a middle name, so check the DC first name is included
        });
        return person ? person.ref : null;
    },

    // Logging
    logUnmappedField(field) {
        if(this.ignoredFields.includes(field)) { return; }
        if(!(field in this.log.fields.notImported)) { this.log.fields.notImported[field] = 0; }
        this.log.fields.notImported[field]++;
    },

    logControlledListEntry(intermediate, field, entry, isMapped) {
        if(isMapped) {
            if(!(field in this.log.fields.controlledLists)) { this.log.fields.controlledLists[field] = []; }
            if(!this.log.fields.controlledLists[field].includes(entry)) {
                // On separate lines to make checking for existing entries simpler
                this.log.fields.controlledLists[field].push(entry);
                this.log.fields.controlledLists[field].push("^^^^ (first seen in "+intermediate.digitalCommonsURL+")");
            }
        } else {
            if(!(field in this.log.fields.missingControlledFieldValues)) { this.log.fields.missingControlledFieldValues[field] = []; }
            if(!this.log.fields.missingControlledFieldValues[field].includes(entry)) {
                this.log.fields.missingControlledFieldValues[field].push(entry);
            }
            this.error(intermediate, "missing-controlled-field-value", "Unknown entry in controlled list field: "+entry);
        }
    },

    logFileAdded(intermediate, fileType) {
        if(!(fileType in this.log.attachedFiles)) { this.log.attachedFiles[fileType] = 0; }
        this.log.attachedFiles[fileType]++;
    },

    error(intermediate, code, message) {
        const digitalCommonsURL = intermediate.digitalCommonsURL;
        if(!(digitalCommonsURL in this.log.digitalCommonsRecords)) { this.log.digitalCommonsRecords[digitalCommonsURL] = []; }
        this.log.digitalCommonsRecords[digitalCommonsURL].push("error:"+code+": "+message);
        if(!(code in this.log.errors)) { this.log.errors[code] = 0; }
        this.log.errors[code]++;
    },

    warn(intermediate, code, message) {
        const digitalCommonsURL = intermediate.digitalCommonsURL;
        if(!(digitalCommonsURL in this.log.digitalCommonsRecords)) { this.log.digitalCommonsRecords[digitalCommonsURL] = []; }
        this.log.digitalCommonsRecords[digitalCommonsURL].push("warning:"+code+": "+message);
        if(!(code in this.log.warnings)) { this.log.warnings[code] = 0; }
        this.log.warnings[code]++;
    },

    // private functions

    _importDigitalCommonsJSON(document) {
        _.each(document, (record) => {
            const intermediate = new Intermediate(this);
            intermediate.fromDigitalCommons(record);
            this.intermediates.push(intermediate);
        });
    },

    _updateImportStatus(status) {
        let row = P.db.importLogging.load(this.logID);
        row.status = status;
        row.log = this.log;
        row.save();
    },

    _normalise(text) {
        return text.trim().toLowerCase().replace("&", "and").replace(/[^a-z0-9]/g, "");
    },

    _cleanLogForReporting() {
        this.log.end = new Date();
        // removes empty entries from log
        let tmp = {};
        _.each(this.log.digitalCommonsRecords, (v, k) => { if(v.length) { tmp[k] = v; } });
        this.log.digitalCommonsRecords = tmp;
        if(!_.isEmpty(this.log.fields.notImported)) {
            this.log.errors["unmapped-fields"] = this.log.fields.notImported.length;
        }
    },

    _saveIntermediate(intermediate) {
        if(intermediate.save()) {
            const type = SCHEMA.getTypeInfo(intermediate.object.firstType()).name;
            this.log.outputsByType[type] = (this.log.outputsByType[type] || 0) + 1;
        }
    },

    _saveAdditionalObject(toAdd) {
        const object = toAdd.object;
        const digitalCommonsURL = toAdd.digitalCommonsURL;
        try {
            O.impersonating(O.SYSTEM, () => { object.save(); });
        } catch(e) {
            throw new Error(e.message+"; thrown when attempting to save object with title "+object.title);
        }
        if(digitalCommonsURL) {
            if(!(digitalCommonsURL in this.log.digitalCommonsRecords)) { this.log.digitalCommonsRecords[digitalCommonsURL] = []; }
            this.log.digitalCommonsRecords[digitalCommonsURL].push("New object ref: "+object.ref+", title: "+object.title);
        }
        let typeTitle = SCHEMA.getTypeInfo(object.firstType()).name;
        this.log.newObjects[typeTitle] = (this.log.newObjects[typeTitle] || 0)+1;
    }

};

// --------------------------------------------------------------------------
// Lookups for the import context

ImportContext.prototype.ignoredFields = [
    "download_format",
    "download_link", // use fulltext_url instead
    "site_link",
    "parent_key",
    "parent_link",
    "author_inst",
    "site_key",
    "virtual_ancestor_key",
    "virtual_ancestor_link",
    "ancestor_link",
    "include_in_network",
    "institution_title",
    "fields_digest",
    "mtime",
    "is_digital_commons",
    "publication_link",
    "author",
    "institution",
    "publication_title",
    "url",
    "exclude_from_oai",
    "context_key",
    "discipline_key_0",
    "discipline_key_1",
    "discipline_terminal_key",
    "discipline",
    "discipline_1",
    "discipline_0",
    "publication_key",
    "ancestor_key",
    "discipline_2",
    "discipline_key_2",
    "configured_field_t_grant",  // Made up of the grant_numX and grant_purl fields
    "fulltext_url"
];

// Fieldinfo to build intermediate
ImportContext.prototype.dcFieldInfo = [
    {name:"Title",              field:"title",                          dcToIntermediate:"setText" /*, objectToIntermediate:"textAttr"*/},
    {name:"Type",               field:"document_type",                  dcToIntermediate:"setType"},
    {name:"DOI",                field:"doi",                            dcToIntermediate:"setDOI"},
    {name:"ISSN",               field:"configured_field_t_issn",        dcToIntermediate:"setISBN"},
    {name:"Abstract",           field:"abstract",                       dcToIntermediate:"setHTMLParagraph"},
    {name:"Date",               field:"publication_date",               dcToIntermediate:"setYear"},
    {name:"Journal",            field:"configured_field_t_source_publication", dcToIntermediate:"setJournal"},
    // DC autofills a "false" value here - check with client on a case by case basis whether it's in use or just autofilled
    // {name:"PeerReview",         field:"peer_reviewed",                  dcToIntermediate:"setPeerReview"},
    {name:"Publisher",          field:"configured_field_t_publisher",   dcToIntermediate:"setPublisher"},
    {name:"ISBN",               field:"configured_field_t_isbn",        dcToIntermediate:"setISBN"},
    {name:"Pages",              field:"configured_field_t_extent",      dcToIntermediate:"setArrayText"},
    {name:"Event",              field:"configured_field_t_conference_name", dcToIntermediate:"setEvent"},
    {name:"Series",             field:"configured_field_t_book_series", dcToIntermediate:"setArrayText"},
    {name:"BookTitle",          field:"configured_field_t_chapter_title",dcToIntermediate:"setArrayText"},
    {name:"QualificationName",  field:"configured_field_t_degree_name", dcToIntermediate:"setArrayText"},
    {name:"URL",                field:"configured_field_t_source_fulltext_url",dcToIntermediate:"setURL"},
    {name:"URL",                field:"configured_field_t_source_link", dcToIntermediate:"setURL"},
    {name:"PlaceOfPublication", field:"configured_field_t_publisher_location", dcToIntermediate:"setPlaceOfPublication"},
    {structuredDestination:true,field:"author_display",                 dcToIntermediate:"setAuthorFullName",   multivalue:true},
    {structuredDestination:true,field:"author_display_lname",           dcToIntermediate:"setAuthorLastName",   multivalue:true},
    {name:"ScopusEID",          field:"configured_field_t_scopus_eid",  dcToIntermediate:"setScopusEID"},
    {structuredDestination:true,field:"configured_field_t_editor1",     dcToIntermediate:"setEditorCitation"},
    {structuredDestination:true,field:"configured_field_t_editor2",     dcToIntermediate:"setEditorCitation"},
    {structuredDestination:true,field:"configured_field_t_editor3",     dcToIntermediate:"setEditorCitation"},
    {structuredDestination:true,field:"configured_field_t_distribution_license", dcToIntermediate:"setLicense"},
    {structuredDestination:true,field:"corporate_author",               dcToIntermediate:"setCorporateAuthor",  multivalue: true},
    {name:"Notes",              field:"comments",                       dcToIntermediate:"setHTMLParagraph"},
    {name:"GrantId",            field:"configured_field_t_grant_num",   dcToIntermediate:"setArrayText"},
    {name:"GrantId",            field:"configured_field_t_grant_num2",  dcToIntermediate:"setArrayText"},
    {name:"GrantNotes",         field:"configured_field_t_grant_purl",  dcToIntermediate:"setHTMLParagraphArray"},
    // Fields that map to a structured destination don't have a desc name set, and are saved to their
    // destinations individually
    {structuredDestination:true, field:"embargo_date",              dcToIntermediate:"setEmbargo"},
    {structuredDestination:true, field:"configured_field_t_volnum", dcToIntermediate:"setJournalCitationVolume"},
    {structuredDestination:true, field:"configured_field_t_issnum", dcToIntermediate:"setJournalCitationIssue"}
];

ImportContext.prototype.dcToHaploTypeMap = {
    "article": T.JournalArticle,
    "data": T.Dataset,
    "bookchapter": T.BookChapter,
    "book": T.Book,
    "conference": T.ConferenceItem,
    "thesis": T.Thesis,
    "report": T.Report
};

ImportContext.prototype.licenseLookup = {
    "http://creativecommons.org/licenses/by/4.0/": "hres:list:license:cc-by:4",
    "http://creativecommons.org/licenses/by/3.0/": "hres:list:license:cc-by:3",
    "http://creativecommons.org/licenses/by-nc-nd/4.0/": "hres:list:license:cc-by-nc-nd:4",
    "http://creativecommons.org/licenses/by-nc/4.0/": "hres:list:license:cc-by-nc:4",
    "http://creativecommons.org/licenses/by-nc-nd/3.0/": "hres:list:license:cc-by-nc-nd:3",
    "http://creativecommons.org/licenses/by-nc/3.0/": "hres:list:license:cc-by-nc:3",
    "http://creativecommons.org/licenses/by-nc-sa/4.0/": "hres:list:license:cc-by-nc-sa:4",
    "http://creativecommons.org/licenses/by-nd/3.0/": "hres:list:license:cc-by-nd:3",
    "http://creativecommons.org/licenses/by-sa/4.0/": "hres:list:license:cc-by-sa:4",
    "http://creativecommons.org/licenses/by-nc-sa/3.0/": "hres:list:license:cc-by-nc-sa:3"
};

ImportContext.prototype.htmlReplacements = {
    "p": "",
    "\/p": "\r\n\r\n",
    "a": "",    // a tags are handled differently - hrefs will be extracted and rendered as text
    "\/a": "",
    "br": "\r\n",
    "\/br": "",
    "strong": "",
    "\/strong": "",
    "em": "",
    "\/em": "",
    "i": "",
    "\/i": "",
    "b": "",
    "\/b": "",
    "h1": "",
    "\/h1": "",
    "h2": "",
    "\/h2": "",
    "h3": "",
    "\/h3": "",
    "h4": "",
    "\/h4": "",
    "ol": "",       // NOTE: Numbered lists will lost numbering by this transformation
    "\/ol": "",
    "ul": "",
    "\/ul": "",
    "li": "- ",
    "\/li": "\r\n"
    // Note: other tags will need to be cleaned manually from inspection of the import log
};

// --------------------------------------------------------------------------
// Intermediate - superset structure of Digital Commons and Haplo metadata
// --------------------------------------------------------------------------

var Intermediate = function(context) {
    this.context = context;
    this.object = O.object();
    this.digitalCommonsURL = null;      // The Digital Commons identifier -- to be updated!

    // The transformed intermediate data structure
    this._attributes = [];

    // Extension or replacement points for the various "setX" functions
    this._extendedSetMethods = {};      // Calls the default method and then a second, custom method
    this._replacementSetMethods = {};   // Replaces the default method

    // Structured data collected through processing entire record - saved at end of each record
    this._authors = [];
    this._editors = [];
    this._embargoData = {};
    this._journalCitationData = {};
    this._publisherDetails = {};
    this._publishedFileExtension = {
        groupDesc: A.PublishedFile,
        attributes: []
    };
    this._additionalFiles = [];
    O.serviceMaybe("hres_repo_digital_commons:import:setup_intermediate", this);
};

Intermediate.prototype = {

    fromDigitalCommons(record) {
        // "url" field is the unique identifier for items within DC. Error if not present
        if(!record.url) {
            this.context.error("UNK", "no-digital-commons-url", "No url field in the Digital Commons data for this record");
            return;
        }
        this.digitalCommonsURL = record.url;
        _.each(record, (data, field) => {
            let fieldInfo = this._findFieldInfo(field);
            if(fieldInfo && fieldInfo.dcToIntermediate) {
                // Most DC array values are single value, despite being arrays. Indicate explicitly if they need to 
                // be processed as multivalue arrays.
                if(fieldInfo.multivalue) {
                    _.each(data, (entry) => {
                        this._singleValueDCToIntermediate(fieldInfo, entry);
                    });
                } else {
                    this._singleValueDCToIntermediate(fieldInfo, data);
                }
            } else {
                this.context.logUnmappedField(field);
            }
        });
    },

    save() {
        this._applyIntermediateToObject();
        try {
            O.impersonating(O.SYSTEM, () => { this.object.save(O.labelChanges([Label.AcceptedIntoRepository])); });
        } catch(e) {
            this.context.error(this, "cannot-save-object", "Unable to save storeObject: "+e.message);
            return false;
        }
        // TODO: Save DB data - eg. embargoes
        this._saveEmbargo();
        P.db.legacyURLsForObjects.create({
            object: this.object.ref,
            digitalCommonsURL: this.digitalCommonsURL
        }).save();
        return true;
    },

    replaceSetMethod(name, fn) {
        this._replacementSetMethods[name] = fn;
    },

    extendSetMethod(name, fn) {
        this._extendedSetMethods[name] = fn;
    },

// Field import methods

    setText(text, attribute, textType) {
        if(!text.trim()) { return; }
        attribute.value = O.text(textType || O.T_TEXT, text.trim());
    },

    setArrayText(array, attribute, textType) {
        this.checkSingleValue(array, attribute.field);
        this.setText(array[0], attribute, textType);
    },

    setType(types, attribute) {
        let type = types[0];    // Other entries seem to be human-readable names for the types
        let haploType = this.context.dcToHaploTypeMap[type];
        if(haploType) {
            attribute.value = haploType;
        }
        this.context.logControlledListEntry(this, attribute.field, type, !!haploType);
    },

    setURL(array, attribute) {
        this.checkSingleValue(array, attribute.field);
        let url = array[0];
        if(url.startsWith("https://doi.org/")) {
            // Override destination desc
            attribute.desc = A.DOI;
            url = url.replace("https://doi.org/", "");
            this.setDOI(url, attribute);
        } else {
            this.setText(url, attribute, O.T_IDENTIFIER_URL);
        }
    },

    setDOI(text, attribute) {
        try {
            attribute.value = P.DOI.create(text);
        } catch(e) {
            this.context.error(this, "invalid-doi", "Invalid DOI: "+text);
        }
    },

    setScopusEID(array, attribute) {
        this.checkSingleValue(array, attribute.field);
        try {
            attribute.value = P.ScopusEID.create(array[0]);
        } catch(e) {
            this.context.error(this, "invalid-scopus-eid", "Invalid Scopus EID: "+array[0]);
        }
    },

    setISBN(array, attribute) {
        this.checkSingleValue(array, attribute.field);
        this.setText(array[0], attribute, O.T_IDENTIFIER_ISBN);
    },

    setHTMLParagraph(text, attribute) {
        _.each(this.context.htmlReplacements, (replacement, tag) => {
            if(tag === "a") {
                // matches all <a> tags with an href. Assumes href is listed before any subsequent html attributes
                const aTagsRegex = /<a(\shref="[a-zA-Z0-9-=:@._?\/]+?")?[\sa-zA-Z0-9-=:@._?=\/\"\\]*>/g;
                // Iterate over all links found in the text
                _.each(text.match(aTagsRegex), (fullATag) => {
                    // Extract the URL from the href attribute
                    const hrefSection = fullATag.match(/href="([a-zA-Z0-9-=:@._?\/]+?)"/);
                    if(hrefSection) {
                        const url = hrefSection[1]; // extracted by capturing group in regex above
                        // Replace the full tag with just the URL in square brackets, as text
                        text = text.replace(fullATag, "["+url+"] ");
                    } else {
                        this.context.error(this, "cannot-replace-href", "Couldn't extract the href for insertion into paragraph text, from tag: "+fullATag);
                        text = text.replace(fullATag, "");
                    }
                });
            } else {
                // matches tag plus anything that looks like a valid HTML attribute, within two angle brackets
                const htmlTagRegex = new RegExp('<'+tag+'[\\sa-zA-Z0-9-=:@._\\/\\"\\\\]*>', 'g');
                text = text.replace(htmlTagRegex, replacement);
            }
        });
        if(text.match(/<(.+?)>/g)) { this.context.warn(this, "html-in-paragraph-text", "Paragraph text includes HTML tags: "+attribute.field); }
        this.setText(text.trim(), attribute, O.T_TEXT_PARAGRAPH);
    },

    setHTMLParagraphArray(array, attribute) {
        this.checkSingleValue(array, attribute.field);
        this.setHTMLParagraph(array[0], attribute);
    },

    setYear(text, attribute) {
        const date = this._getDate(text);
        if(date) {
            attribute.value = O.datetime(date, undefined, O.PRECISION_YEAR);
        }
    },

    setAuthorFullName(fullName, attribute) {
        const sortValue = this._authors.length;     // Non-corporate authors are specified in order
        const existingAuthor = _.find(this._authors, (author) => {
            if(!author.last || author.fullName) { return; }
            return fullName.endsWith(author.last);
        });
        if(existingAuthor) {
            existingAuthor.fullName = fullName;
        } else {
            this._authors.push({ fullName: fullName, sort: sortValue });
        }
    },

    setAuthorLastName(lastName, attribute) {
        const sortValue = this._authors.length;     // Non-corporate authors are specified in order
        const existingAuthor = _.find(this._authors, (author) => {
            if(author.last || !author.fullName) { return; }
            return author.fullName.endsWith(lastName);
        });
        if(existingAuthor) {
            existingAuthor.last = lastName;
        } else {
            this._authors.push({ last: lastName, sort: sortValue });
        }
    },

    setCorporateAuthor(title, attribute) {
        const organisation = this.context.getObjectForTitle(this, title, T.Organisation, {saveBeforeOutputs: true});
        if(organisation) {
            // Corporate authors should go at the end of the author list
           this._authors.push({ object: organisation, sort: 99999 });
        }
    },

    setEditorCitation(array, attribute) {
        this.checkSingleValue(array, attribute.field);
        const citation = array[0];
        const editorNumber = attribute.field.replace("configured_field_t_editor", "");
        this._editors.push({
            cite: citation,
            sort: parseInt(editorNumber, 10)
        });
    },

    setEvent(array, attribute) {
        this._setLinkedObjectFromTitle(array, attribute, T.ExternalEvent);
    },

    setJournal(array, attribute) {
        this._setLinkedObjectFromTitle(array, attribute, T.Journal);
    },

    setPublisher(array, attribute) {
        this._setLinkedObjectFromTitle(array, attribute, T.Publisher);
        this._publisherDetails.publisher = this.context.getObjectForTitle(this, array[0], T.Publisher);
    },

    setPlaceOfPublication(array, attribute) {
        this.checkSingleValue(array, attribute.field);
        const locationText = array[0];
        let country;
        _.each(locationText.split(","), (text) => {
            country = this.context.getObjectForTitle(this, text, T.Country, {preventObjectCreation: true});
        });
        if(country) {
            this._publisherDetails.country = country;
        } else {
            this.context.warn(this, "unknown-country", "An unknown country was found: "+array[0]);
        }
        // If there's additional location information in the field, add it to the output directly
        this.setText(locationText, attribute);
    },

    setPeerReview(isPeerReviewed, attribute) {
        // check booleans directly so bad data is logged
        if(isPeerReviewed === true) {
            attribute.value = O.behaviourRef("hres:list:peer-review:reviewed");
        } else if(isPeerReviewed === false) {
            attribute.value = O.behaviourRef("hres:list:peer-review:not-reviewed");
        }
        this.context.logControlledListEntry(this, attribute.field, isPeerReviewed, _.isBoolean(isPeerReviewed));
    },

    setJournalCitationVolume(volume, attribute) {
        this._journalCitationData.volume = volume;
    },

    setJournalCitationIssue(issue, attribute) {
        this._journalCitationData.number = issue;
    },

    setEmbargo(dateText, attribute) {
        const embargoEnd = this._getDate(dateText);
        const epoch = new XDate(1970, 0, 1);
        // The "null" value is exported from DC as 1970-01-01
        if(Math.abs(epoch.diffDays(embargoEnd)) > 1) {
            this._embargoData.end = embargoEnd;
        }
    },

    setLicense(array, attribute) {
        if(array.length !== 2) {
            this.context.error(this, "multiple-licenses", "Multiple licenses were found for the record");
        }
        // licenses are supplied as eg. ["CC-BY", "http://creativecommons.com/etc"]
        if(array[1]) {
            const behaviour = this.context.licenseLookup[array[1]];
            if(behaviour) {
                this.addPublishedFileExtensionAttribute({
                    field: attribute.field,
                    value: O.behaviourRef(behaviour),
                    desc: A.License
                });
            }
            this.context.logControlledListEntry(this, attribute.field, array[1], !!behaviour);
        }
    },

    // Utility
    checkSingleValue(array, field) {
        // Don't report errors where array has repeated identical elements
        if(_.uniq(array).length > 1) {
            this.context.error(this, "unexpected-multivalue:"+field, "The field "+field+" is expected to have only 1 entry, but multiple were found");
        }
    },

    addPublishedFileExtensionAttribute(toAdd) {
        const alreadyAdded = _.find(this._publishedFileExtension.attributes, (attr) => {
            return (attr.desc === toAdd.desc);
        });
        if(alreadyAdded) {
            this.context.error(this, "file-extension-unexpected-multivalue", "The desc "+SCHEMA.getAttributeInfo(toAdd.desc).name+" is expected to appear only once, but was set multiple times");
        } else {
            this._publishedFileExtension.attributes.push(toAdd);
        }
    },

    // private methods

    _singleValueDCToIntermediate(fieldInfo, data) {
        let attribute = {
            field: fieldInfo.field
        };
        if(fieldInfo.structuredDestination) {
            // Data saved elsewhere separately. NB: noAttributeValueExpected can be set elsewehere as well
            attribute.noAttributeValueExpected = true;
        } else {
            attribute.desc = A[fieldInfo.name];
        }
        const fnName = fieldInfo.dcToIntermediate;
        if(fnName in this._replacementSetMethods) {
            this._replacementSetMethods[fnName](data, attribute);
        } else if(fnName in this._extendedSetMethods) {
            this[fnName](data, attribute);
            this._extendedSetMethods[fnName](data, attribute);
        } else {
            this[fnName](data, attribute);
        }
        this._attributes.push(attribute);
    },

    _setLinkedObjectFromTitle(array, attribute, linkedObjectType) {
        this.checkSingleValue(array, attribute.field);
        const object = this.context.getObjectForTitle(this, array[0], linkedObjectType);
        if(object) {
            attribute.value = object.ref;
        }
    },

    _saveEmbargo() {
        if(!(this._embargoData.end || this._embargoData.isIndefinite)) { return; }
        if(!this._embargoData.start) {
            this.context.warn(this, "inferred-embargo-start", "No embargo start date found. Embargo start will be inferred as today.");
        }
        O.service("hres_repo_embargoes:set_embargo", {
            object: this.object.ref,
            start: this._embargoData.start,
            end: this._embargoData.end
        });
    },

    _getDate(text) {
        const parser = O.dateParser("yyyy-MM-dd'T'HH:mm:ss'Z'");
        const date = parser(text);
        if(date) {
            return date;
        } else {
            this.context.error(this, "invalid-date", "Invalid date format: "+text);
        }
    },

    _findFieldInfo(field) {
        return _.find(this.context.dcFieldInfo, (f) => (f.field === field));
    },

    _appendAttributeToObject(attr, extensionMaybe) {
        if(attr.value) {
            if(_.isArray(attr.value)) {
                _.each(attr.value, (v) => {
                    this._appendSingleAttributeValueToObject(attr, v, extensionMaybe);
                });
            } else {
                this._appendSingleAttributeValueToObject(attr, attr.value, extensionMaybe);
            }
        } else if(!attr.noAttributeValueExpected) {
            this.context.warn(this, "no-value-for-field", "Could not append a value for "+attr.field);
        }
    },

    _appendSingleAttributeValueToObject(attr, value, extensionMaybe) {
        if(attr.personField) {
            O.service("hres:author_citation:append_citation_to_object", this.object, attr.desc, attr.qual, attr.value);
        } else if(!this.object.has(value, attr.desc, attr.qual)) {
            // NOTE: this is fine as DC only includes a single attached file, so we don't expect multiple 
            // attribute groups to be appended (which otherwise could easily have the save v,d,q)
            this.object.append(value, attr.desc, attr.qual, extensionMaybe);
        }
    },

    _addAuthorsAndEditors() {
         _.each(_.sortBy(this._authors, 'sort'), (author) => {
            const citation = {};
            if(author.object) {
                citation.object = author.object;
            } else {
                if(author.last && author.fullName) {
                    author.first = author.fullName.replace(author.last, "").trim();
                    citation.cite = author.last+", "+author.first;      // To exactly match the Digital Commons citation scheme
                } else if(author.fullName) {
                    this.context.warn(this, "missing-author-details", "Missing author last name: "+author.fullName);
                    const fields = author.fullName.split(" ");
                    const last = fields[fields.length-1];
                    citation.cite = last+", "+author.fullName.replace(last, "").trim();
                } else if(author.last) {
                    this.context.warn(this, "missing-author-details", "Missing author fullName: "+author.last);
                    citation.cite = author.last;
                }
                const person = this.context.getPerson(author);
                if(person) { citation.ref = person; }
            }
            this._attributes.push({
                desc: A.Author,
                personField: true,
                value: citation
            });
        });
        _.each(_.sortBy(this._editors, 'sort'), (editor) => {
            this._attributes.push({
                desc: A.Editor,
                personField: true,
                value: {
                    cite: editor.cite
                }
            });
        });
    },

    _setFile(row, attribute) {
        if(attribute.isPublishedFile) {
            this.addPublishedFileExtensionAttribute({
                field: attribute.field,
                value: O.file(row.digest).identifier(),
                desc: A.File
            });
            this.context.logFileAdded(this, "publishedFile");
        } else {
            this._additionalFiles.push({
                field: attribute.field,
                value: O.file(row.digest).identifier(),
                desc: A.File,
                groupDesc: attribute.groupDesc
            });
            this.context.logFileAdded(this, "supplementalFile");
        }
        attribute.noAttributeValueExpected = true;
    },

    _addFiles() {
        const filePath = this.digitalCommonsURL.replace("http://"+P.LEGACY_APPLICATION+"/", "");
        P.db.downloadedFiles.select().
            where("url", "LIKE", "http://"+P.FILE_WEB_SERVER+"/"+filePath+"/%").
            each((row, index) => {
                if(!row.digest) {
                    this.context.error(this, "cannot-append-file", "File "+row.url+" has not been downloaded correctly, so cannot be appended");
                    return;
                }
                if(index === 0) {
                    this._setFile(row, {
                        field: "file"+index,
                        isPublishedFile: true
                    });
                } else {
                    this._setFile(row, {
                        field: "file"+index,
                        groupDesc: A.SupplementalFile
                    });
                }
            }
        );
    },

    _applyIntermediateToObject() {
        this._addAuthorsAndEditors();
        this._addFiles();
        // Gives client implementations a point to process structured destination fields after all fields have been read
        if(this.processIntermediatePreApply) {
            this.processIntermediatePreApply();
        }
        _.each(this._attributes, (attr) => {
            this._appendAttributeToObject(attr);
        });
        // Add data from named structured destinations
        if(!_.isEmpty(this._journalCitationData)) {
            if(this._journalCitationData.volume) {
                O.service("hres:journal_citation:append_citation_to_object", this.object, A.JournalCitation, undefined, this._journalCitationData);
            } else {
                this.context.error(this, "no-volume-for-journal-citation", "A volume number is required to append a journal citation value");
            }
        }
        const country = this._publisherDetails.country;
        if(country) {
            const publisher = this._publisherDetails.publisher;
            if(publisher) {
                if(!publisher.has(country.ref, A.Location)) {
                    if(publisher.isMutable()) {
                        // created by import, will be saved later
                        publisher.append(country.ref, A.Location);
                    } else {
                        // Hopefully shouldn't happen...
                        this.context.error(this, "cannot-append-country", "Can't append country "+country+" to publisher, as the publisher object "+publisher.ref+" is not mutable");
                    }
                }
            } else {
                this.context.error(this, "publisher-country-without-publisher", "A publisher country was set for this record, but no publisher was found");
            }
        }
        if(this._publishedFileExtension.attributes.length) {
            const extension = this.object.newAttributeGroup(this._publishedFileExtension.groupDesc);
            _.each(this._publishedFileExtension.attributes, (attr) => {
                this._appendAttributeToObject(attr, extension);
            });
        }
        _.each(this._additionalFiles, (file) => {
            const extension = this.object.newAttributeGroup(file.groupDesc);
            this._appendAttributeToObject(file, extension);
        });
    }

};
