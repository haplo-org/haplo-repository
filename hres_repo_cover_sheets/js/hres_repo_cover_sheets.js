/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// --------------------------------------------------------------------------
// Database

// this information is stored so that, when generating an updated cover sheet,
// we can append to the original file, not the file with the old sheet
P.db.table('coversheet', {
    output: {type:"ref", indexed:true},
    type: {type:"text", nullable:true, indexedWith:["output"]},
    document: {type:"text", nullable:true},
    // TODO: change to not nullable.
    originalFile: {type:"file", nullable:true},
    // TODO: change to not nullable?
    lastGeneratedFile: {type:"file", nullable:true}
});

P.implementService("hres:repository:add_cover_sheet", function(row) {
    P.db.coversheet.create({
        output: row.output,
        type: row.type,
        document: row.document,
        originalFile: row.originalFile,
        lastGeneratedFile: row.lastGeneratedFile
    }).save();
});


// --------------------------------------------------------------------------
// UI

// if the current file is the last generated file then it is the version with the cover sheet
var fileHasCoversheet = function(file, row) {
    if(!row || !row.lastGeneratedFile) { return; }
    return (row.lastGeneratedFile.digest === file.digest);
};

P.implementService("std:action_panel:output", function(display, builder) {
    if(O.currentUser.allowed(CanGenerateCoverSheet)) {
        const coversheetPanel = builder.panel(1000);
        display.object.every(A.File, (v,d,q,x) => {
            let type = "file";
            _.each(getFileTypes(), (typeSpec, key) => {
                if(x && (typeSpec.attr === x.desc)) { type = key; }
            });
            let coversheetButtonLabel = "Add to "+v.filename;
            let row = getSheetRow(display.object.ref, v, type);
            if(fileHasCoversheet(v, row)) {
                coversheetButtonLabel = "Edit "+v.filename;
            }
            coversheetPanel.link("default",
                "/do/hres-repo-cover-sheets/attach/"+display.object.ref+"/"+type+"/"+v.digest,
                coversheetButtonLabel
            );
        });
        if(!coversheetPanel.empty) {
            coversheetPanel.element(0, {title: "Cover sheets"});
        }
    }
});

P.respond("GET,POST", "/do/hres-repo-cover-sheets/attach", [
    {pathElement:0, as:"object"},
    {pathElement:1, as:"string", validate:validateFileType},
    {pathElement:2, as:"string"},
    {parameter:"remove", as:"string", optional:true}
], function(E, output, type, digest, remove) {
    CanGenerateCoverSheet.enforce();
    const typeInfo = getFileTypes()[type];
    let file = O.file(digest);
    let row = getSheetRow(output.ref, file, type);
    const isUpdate = !!fileHasCoversheet(file, row);
    let document = isUpdate ? JSON.parse(row.document) : preFillCoversheetForm(output, type);
    const form = typeInfo.form.handle(document, E.request);
    if(E.request.method === "POST") {
        if(remove === "yes") {
            removeCoversheet(output, file, type);
            return E.response.redirect(output.url());
        } else if(form.complete) {
            // if the current file already has a cover sheet then use the source file
            // rather than append to an already appended document
            if(isUpdate) {
                file = row.originalFile;
            }
            const redirectURL = generateAndPrependCoversheet(output, type, file, document, isUpdate);
            return E.response.redirect(redirectURL);
        }
    }
    const publisher = output.first(A.Publisher);
    E.render({
        type: SCHEMA.getAttributeInfo(typeInfo.attr).name.toLowerCase(),
        output: output,
        publisher: O.isRef(publisher) ? publisher : undefined,
        form: form,
        hasCoverSheet: isUpdate,
        remove: {
            text: "Would you like to remove the cover sheet?",
            options: [{
                label: "Remove",
                parameters: {
                    remove: "yes"
                }
            }]
        }
    }, "attach-cover-sheet");
});

// --------------------------------------------------------------------------
// File generation

var generateAndPrependCoversheet = function(output, type, file, document, isUpdate) {
    const title = output.title;
    const authorCitation = O.service("hres:author_citation:citation_string_from_object", output, A.AuthorsCitation);
    let pipeline = O.fileTransformPipeline("hres_repo_cover_sheets:attach_cover_sheet", {
        outputRef:output.ref.toString(),
        originalFileDigest: file.digest,
        type:type,
        isUpdate:isUpdate,
        // To save on SUCCESS.
        document: document
    });
    let statement;
    if(document && document.text) {
        statement = document.text.statement;
    }

    pipeline.file("manuscript", O.file(file));

    const spec = O.serviceMaybe("hres_repo_cover_sheets:cover_sheet_spec", output, getFileTypes()[type].attr) || {};
    const letterhead = spec.letterhead || O.service("hres_file_templates:get_template", output.first(A.Author), ["DEFAULT"]).file;
    pipeline.file("letterhead", letterhead);

    let view = {
        heading: O.application.name,
        subheading: _.map(output.every(A.Type), (type) => type.load().title).join(','),
        title: title,
        outputCitation: O.serviceMaybe("hres_bibliographic_reference:for_object", output),
        authors: authorCitation ? authorCitation.toString() : undefined,
        statement: statement,
        outputUrl: O.serviceMaybe("hres:repository:common:public-url-for-object", output),
        publicRepoUrl: O.serviceMaybe("hres:repository:common:public-url-hostname"),
        datestamp: new XDate().toString("dd/MM/yyyy HH:mm")
    };
    _.extend(view, spec.view);

    const formattedTextSpec = spec.formattedText ? spec.formattedText(view) : {
        html: P.template("transforms/cover_sheet").render(view),
        marginTop: 160, marginBottom: 50, marginLeft: 62, marginRight: 62,
        css: P.loadFile("cover_sheet.css").readAsString()
    };
    pipeline.transform("std:generate:formatted_text", formattedTextSpec);

    pipeline.transformPreviousOutput("std:pdf:overlay", {
        overlay: "letterhead",
        lastPage: 1
    });

    pipeline.rename("output", "coversheet");
    pipeline.transformPreviousOutput("std:concatenate", {
        files: ["coversheet", "manuscript"],
        fallbackHTML: "Couldn't concatenate cover sheet and manuscript ($FILENAME)"
    });
    const redirectURL = pipeline.urlForWaitThenRedirect(output.url(), {
        pageTitle: "Generating "+file.filename,
        backLink:output.url(),
        backLinkText:"Output"
    });
    pipeline.execute();
    return redirectURL;
};

P.fileTransformPipelineCallback("hres_repo_cover_sheets:attach_cover_sheet", {
    success(result) {
        if(result.data.outputRef) {
            const output = O.ref(result.data.outputRef).load();
            const type = result.data.type;
            const attr = getFileTypes()[type].attr;
            const originalFile = O.file(result.data.originalFileDigest);
            const createIfNotFound = true;
            const row = getSheetRow(output.ref, originalFile, type, createIfNotFound);
            const oldFile = result.data.isUpdate ? row.lastGeneratedFile : originalFile;
            row.document = JSON.stringify(result.data.document);
            // store a reference to the source file for generation so that we can update the cover sheet
            // later without appending to an appended document
            if(!result.data.isUpdate) {
                row.originalFile = originalFile;
            }
            const fileWithCoverSheet = result.file("output", encodeURIComponent(output.title)+".pdf");
            row.lastGeneratedFile = fileWithCoverSheet;
            // MUST save this before we append file to the object
            row.save();
            let newFileId = fileWithCoverSheet.identifier();
            let qualifier;
            let extension;
            let oldFileId;
            output.every(A.File, (v,d,q,x) => {
                if(v.digest === oldFile.digest) {
                    qualifier = q;
                    extension = x;
                    oldFileId = v;
                }
            });
            if(O.typecode(oldFileId) === O.T_IDENTIFIER_FILE) {
                // replace file extension with .pdf
                const newFilename = oldFileId.filename.replace(/\.[\w\-\~]+$/, ".pdf");
                newFileId.filename = newFilename;
                newFileId.trackingId = oldFileId.trackingId;
                // We don't want to bump up the file version when adding a coversheet - it's the
                // concept we've chosen to go with.
                newFileId.version = oldFileId.version;
                newFileId.logMessage = result.data.isUpdate ? 
                    "Updated cover sheet" :
                    "Automatically generated cover sheet added";
            }
            let mOutput = output.mutableCopy();
            mOutput.remove(A.File, (v,d,q) => {
                return (v.digest === oldFile.digest);
            });
            mOutput.append(newFileId, A.File, qualifier, extension);
            mOutput.save();
        }
    },
    error(result) {
        // TODO: do something
    }
});

P.implementService("hres_repo_cover_sheets:generate", function(output, fileIdentifier, groupDesc) {
    let type = "file";
    _.each(getFileTypes(), (typeSpec, key) => {
        if(typeSpec.attr === groupDesc) { type = key; }
    });
    let row = getSheetRow(output.ref, fileIdentifier, type, true);
    let file = O.file(fileIdentifier);
    const isUpdate = !!fileHasCoversheet(file, row);
    const document = isUpdate ? JSON.parse(row.document) : preFillCoversheetForm(output, type);
    if(isUpdate) {
        file = row.originalFile;
    }
    const redirectURL = generateAndPrependCoversheet(output, type, file, document, isUpdate);
    return redirectURL;
});

var removeCoversheet = function(output, file, type) {
    const attr = getFileTypes()[type].attr;
    const row = P.db.coversheet.select().
        where("output", "=", output.ref).
        where("type", "=", type).
        where("lastGeneratedFile", "=", file)[0];
    if(!row || !row.originalFile) { O.stop("No original file found"); }
    const originalFileId = row.originalFile.identifier();
    originalFileId.trackingId = file.trackingId;
    // We don't want to bump up the file version when removing a coversheet - it's the concept
    // we've chosen to go with.
    originalFileId.version = file.version;
    originalFileId.logMessage = "Removed cover sheet";
    let qualifier;
    let extension;
    let mOutput = output.mutableCopy();
    mOutput.remove(A.File, (v,d,q,x) => {
        if(v.digest === file.digest) {
            qualifier = q;
            extension = x;
            return true;
        }
    });
    mOutput.append(originalFileId, A.File, qualifier, extension);
    mOutput.save();
    row.deleteObject();
};

// --------------------------------------------------------------------------
// Defaults

var CanGenerateCoverSheet = O.action("hres_repo_cover_sheets:can_generate_cover_sheet").
    allow("group", Group.Administrators);

var coversheetForm = P.form({
    specificationVersion: 0,
    formId: "coversheetForm",
    formTitle: "Coversheet statements",
    elements: [
        {
            type: "document-text",
            rows: 10,
            path: "text.statement",
            label: "Edit the statement that will be printed on the coversheet"
        }
    ]
});

var fileTypes;

var getFileTypes = function() {
    if(!fileTypes) {
        let defaults = {
            "aam": {attr: A.AcceptedAuthorManuscript,
                statementAttr: A.AuthorManuscriptStatement, form: coversheetForm},
            "publishers": {attr: A.PublishersVersion,
                statementAttr: A.PublishersVersionStatement, form: coversheetForm},
            "file": {attr: A.File,
                statementAttr: A.AuthorManuscriptStatement, form: coversheetForm}
        };
        fileTypes = O.serviceMaybe("hres_repo_cover_sheets:file_types", defaults) || defaults;
    }
    return fileTypes;
};

var validateFileType = function(type) {
    return type in getFileTypes();
};

var preFillCoversheetForm = function(output, type) {
    let document = {};
    let statement = O.serviceMaybe("hres_repo_cover_sheets:statement_prefill", output, type, {
        fileTypes: getFileTypes(),
        interpolate: interpolate
        // if a client wants different statements for different qualifiers, add a refdictHierarchical
        // to this object as well, mapping types to qualifiers.
    });
    // depending on how the client plugin handles the statement, it may already have doc tags
    if(!statement || !statement.startsWith("<doc>")) {
        statement = "<doc>"+(statement || "")+"</doc>";
    }
    document.text = {
        statement: statement
    };
    return document;
};

// --------------------------------------------------------------------------
// Helper functions

var getSheetRow = function(outputRef, fileOrIdentifier, desc, createIfNotFound) {
    const q = P.db.coversheet.select().
        where("output", "=", outputRef).
        where("type", "=", desc).
        or((sq) => {
            let file = O.file(fileOrIdentifier);
            sq.where("originalFile", "=", file).
                where("lastGeneratedFile", "=", file);
        });
    if(q.length) {
        return q[0];
    } else if(createIfNotFound) {
        return P.db.coversheet.create({
            output: outputRef,
            type: desc
        });
    }
};

// handles common interpolations
var interpolate = function(str, output) {
    const type = output.first(A.Type);
    str = str.replace(/\[TYPE\]/g, type ? SCHEMA.getTypeInfo(type).name.toLowerCase() : "UNKNOWN TYPE");
    const author = output.first(A.Author);
    str = str.replace(/\[AUTHOR\]/g, author ? author.load().title : "UNKNOWN AUTHOR");
    str = str.replace(/\[AUTHOR_CITATION\]/g,
            O.service("hres:author_citation:citation_string_from_object", output, A.AuthorsCitation) || "NO AUTHOR CITATION");
    let journal = output.first(A.Journal);
    journal = journal ? (O.isRef(journal) ? journal.load().title : journal.toString()) : "NO JOURNAL";
    str = str.replace(/\[JOURNAL\]/g, journal);
    str = str.replace(/\[JOURNAL_CITATION\]/g, output.first(A.JournalCitation) || "NO JOURNAL CITATION");
    let year = output.first(A.Date);
    if(!year) { 
        const published = output.first(A.PublicationDates, Q.Published);
        if(published) { year = new XDate(published.start).getFullYear(); }
        else { year = "UNKNOWN YEAR"; }
    } else {
        year = new XDate(year.start).getFullYear();
    }
    str = str.replace(/\[YEAR\]/g, year);
    let publisher = output.first(A.Publisher);
    publisher = publisher ? (O.isRef(publisher) ? publisher.load().title : publisher.toString()) : "NO PUBLISHER";
    str = str.replace(/\[PUBLISHER\]/g, publisher);
    str = str.replace(/\[ISSN\]/g, output.first(A.Issn) || "NO ISSN");
    str = str.replace(/\[ISBN\]/g, output.first(A.Isbn) || "NO ISBN");
    str = P.template("paragraph").render({str: str});
    // start building a T_TEXT_DOCUMENT compatible string
    // add urls/stuff with formatting after rendering with std:text:paragraph so they won't be escaped
    str = "<doc>"+str+"</doc>";
    if(O.serviceImplemented("hres_bibliographic_reference:plain_text_for_object")) {
        const fullCitation = O.service("hres_bibliographic_reference:plain_text_for_object", output);
        str = str.replace(/\[FULL_CITATION\]/g, fullCitation || "NO CITATION");
    }
    if(O.serviceImplemented("hres_repo_cover_sheets:interpolate_additional_tags")) {
        str = O.service("hres_repo_cover_sheets:interpolate_additional_tags", str, output);
    }
    return str;
};

var STANDARD_TAGS = [
    ["TYPE", "Output type"],
    ["AUTHOR", "First author on output record"],
    ["AUTHOR_CITATION", "Author citation"],
    ["JOURNAL", "Journal in which output is published"],
    ["JOURNAL_CITATION", "Journal citation"],
    ["FULL_CITATION", "Full output citation"],
    ["YEAR", "Year published"],
    ["PUBLISHER", "Title of publisher"],
    ["ISSN", "ISSN"],
    ["ISBN", "ISBN"]
];

P.hook('hObjectEditor', function(response, object) {
    let availableTags = _.clone(STANDARD_TAGS);
    O.serviceMaybe("hres_repo_cover_sheets:add_available_tags", availableTags);
    if(object.isKindOf(T.Publisher)) {
        response.plugins.hres_repo_cover_sheets = {
            availableTags: availableTags,
            statementAttrs: [A.AuthorManuscriptStatement, A.PublishersVersionStatement]
        };
        P.template("include_publisher_statement_interpolations").render();
    }
});
