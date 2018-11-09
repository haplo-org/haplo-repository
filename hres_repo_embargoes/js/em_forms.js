/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.db.table('embargoDocuments', {
    object: { type: 'ref' },
    document: { type: 'text' }
});

var saveEmbargoToDb = function(object, desc, data) {
    var start;
    if(!!data.customStart) {
        start = new Date(data.customStart);
    } else if(object.first(A.PublicationDate)) {
        start = O.service("hres:repository:earliest_publication_date", object);
    } else {
        // Fallback to today
        start = new Date();
    }
    var end;
    if(data.embargoLength !== "Indefinite") {
        var length = parseInt(data.embargoLength, 10);
        end = new XDate(start).addMonths(length);
    }
    P.db.embargoes.create({
        object: object.ref,
        desc: (desc === "all") ? null : parseInt(desc, 10),
        licenseURL: data.licenseURL || null,
        start: start,
        end: end || null
    }).save();
};

var saveEmbargoData = function(object, document) {
    var oldData = P.getEmbargoData(object);
    if(oldData) {
        oldData.deleteAll();
    }
    _.each(document.embargoes, function(data) {
        // Save blanket embargoes as a single entry, as this makes all UI easier
        if(data.appliesTo && data.appliesTo.indexOf("all") !== -1) {
            saveEmbargoToDb(object, "all", data);
        } else {
            _.each(data.appliesTo, function(desc) {
                saveEmbargoToDb(object, desc, data);
            });
        }
    });
};

var DISPLAY_ATTRIBUTES = [
    A.Type,
    A.Title,
    A.PublicationDate,
    A.Issn,
    A.Isbn,
    A.Publisher,
    A.Journal
];

var RESTRICTED_ATTRIBUTES = [
    A.AcceptedAuthorManuscript, A.PublishersVersion, A.File
];

var getFileChoices = function() {
    var choices = [["all", "All"]];
    _.each(RESTRICTED_ATTRIBUTES, function(desc) {
        choices.push([desc.toString(), SCHEMA.getAttributeInfo(desc).name]);
    });
    return choices;
};

// Load and modify embargo form; can't use instance choices for multiple files
var embargoFormJSON = JSON.parse(P.loadFile('form/embargo.json').readAsString());
var attributesChoiceElement = _.find(embargoFormJSON.elements[0].elements, function(f) { return f.choices === "attributes"; });
attributesChoiceElement.choices = getFileChoices();
var embargoForm = P.form(embargoFormJSON);

P.respond("GET,POST", "/do/hres-repo-embargoes/edit", [
    {pathElement:0, as:"object"}
], function(E, output) {
    P.CanEditEmbargoes.enforce();

    var displayObject = O.object();
    _.each(DISPLAY_ATTRIBUTES, function(attr) {
        output.every(attr, function(v,d,q) {
            displayObject.append(v,d,q);
        });
    });
    var publicationDate = O.service("hres:repository:earliest_publication_date", output);

    var document = {};
    var existingDocumentQuery = P.db.embargoDocuments.select().where("object", "=", output.ref);
    if(existingDocumentQuery.length) {
        document = JSON.parse(existingDocumentQuery[0].document);
    }
    var form = embargoForm.instance(document);
    form.choices("embargoLengths",
        ["Indefinite"].concat(_.map(_.range(1,49), function(i) { return i.toString(); }))
    );
    form.update(E.request);

    if(E.request.method === "POST") {
        if(existingDocumentQuery.length) {
            existingDocumentQuery.deleteAll();
        }
        P.db.embargoDocuments.create({
            object: output.ref,
            document: JSON.stringify(document)
        }).save();
        saveEmbargoData(output, document);
        P.relabelForEmbargoes(output);
        E.response.redirect(output.url());
        return;
    }

    // Get choices for display
    var usedAttributes = _.select(RESTRICTED_ATTRIBUTES, function(d) { return !!output.first(d); });

    E.renderIntoSidebar({
        elements: [{
            label: "Delete all embargoes",
            href: "/do/hres-repo-embargoes/delete/"+output.ref,
            indicator: "standard"
        }]
    }, "std:ui:panel");
    E.render({
        output: output.ref,
        usedAttributes: usedAttributes.join(','),
        displayObject: displayObject,
        publicationDate: publicationDate,
        form: form
    }, "edit-embargoes");
});

P.respond("GET,POST", "/do/hres-repo-embargoes/delete", [
    {pathElement:0, as:"object"}
], function(E, output) {
    P.CanEditEmbargoes.enforce();
    
    if(E.request.method === "POST") {
        P.db.embargoes.select().where("object", "=", output.ref).deleteAll();
        P.db.embargoDocuments.select().where("object", "=", output.ref).deleteAll();
        P.relabelForEmbargoes(output);
        E.response.redirect(output.url());
    }
    E.render({
        pageTitle: "Delete all embargoes: "+output.title,
        backLink: "/do/hres-repo-embargoes/edit/"+output.ref,
        backLinkText: "Cancel",
        text: "Warning: This will unlock all files for all users.",
        options: [
            { label: "Delete" }
        ]
    }, "std:ui:confirm");
});

P.respond("GET,POST", "/do/hres-repo-embargoes/sherpa-information", [
    {pathElement:0, as:"object"}
], function(E, output) {
    var document = {};
    var existingDocumentQuery = P.db.embargoDocuments.select().where("object", "=", output.ref);
    if(existingDocumentQuery.length) {
        document = JSON.parse(existingDocumentQuery[0].document);
    }

    if(E.request.method === "POST") {
        if(existingDocumentQuery.length) {
            existingDocumentQuery.deleteAll();
        }
        P.db.embargoDocuments.create({
            object: output.ref,
            document: JSON.stringify(document)
        }).save();
        saveEmbargoData(output, document);
        P.relabelForEmbargoes(output);
        E.response.redirect(output.url());
        return;
    }

    E.render({
        output: output.ref
    }, "sherpa-information");
});
