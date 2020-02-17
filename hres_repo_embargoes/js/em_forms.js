/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.db.table('embargoDocuments', {
    object: { type: 'ref' },
    document: { type: 'text' }
});

var saveEmbargoToDb = function(object, extensionGroup, data) {
    var start;
    var earliestPublicationDate = O.service("hres:repository:earliest_publication_date", object);
    if(!!data.customStart) {
        start = new Date(data.customStart);
    } else if(earliestPublicationDate) {
        start = earliestPublicationDate;
    } else {
        // Fallback to today
        start = new Date();
    }
    // TODO: this is to deal with bad imported data, to ensure security by default.
    // If we need to set embargo start dates in the future review if this check is appropriate.
    if(start.getTime() > new Date().getTime()) {
        start = new Date();
    }
    var end;
    if(data.end) {
        end = new Date(data.end);
    } else if(data.embargoLength !== "Indefinite") {
        var length = parseInt(data.embargoLength, 10);
        end = new XDate(start).addMonths(length);
    }
    P.db.embargoes.create({
        object: object.ref,
        extensionGroup: (extensionGroup === "all") ? null : parseInt(extensionGroup, 10),
        desc: data.desc || null,
        licenseURL: data.licenseURL || null,
        start: start,
        end: end || null
    }).save();
};

var saveEmbargoData = P.saveEmbargoData = function(object, document) {
    var oldData = P.getEmbargoData(object);
    if(oldData) {
        oldData.deleteAll();
    }
    if(document.all && (document.all.embargoLength || document.all.end)) {
        saveEmbargoToDb(object, "all", document.all);
    }
    _.each(document.embargoes, function(data) {
        if(data.embargoLength || data.end) {
            saveEmbargoToDb(object, data.groupId, data);
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

var embargoForm = P.form('embargo', 'form/embargo.json');

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

    var document = {
        all: {},
        embargoes: []
    };
    var existingDocumentQuery = P.db.embargoDocuments.select().where("object", "=", output.ref);
    if(existingDocumentQuery.length) {
        document = JSON.parse(existingDocumentQuery[0].document);
    }
    // if a whole embargo has since been applied automatically, use that info instead
    var wholeEmbargoQuery = P.db.embargoes.select().
        where("object", "=", output.ref).
        where("extensionGroup", "=", null).
        where("desc", "=", null);
    if(wholeEmbargoQuery.length) {
        var wholeEmbargo = wholeEmbargoQuery[0];
        var wholeEmbargoLength = "Indefinite";
        if(wholeEmbargo.end) {
            wholeEmbargoLength = Math.round(new XDate(wholeEmbargo.start).diffMonths(new XDate(wholeEmbargo.end)));
        }
        var allEmbargo = {
            customStart: wholeEmbargo.start, // not strictly correct but easier
            embargoLength: wholeEmbargoLength.toString()
        };
        if(wholeEmbargo.licenseURL) { allEmbargo.licenseURL = wholeEmbargo.licenseURL; }
        if(!_.isEqual(document.all, allEmbargo)) {
            document.all = allEmbargo;
        }
    }
    var groups = output.extractAllAttributeGroups();
    _.each(groups.groups, function(group) {
        // TODO: review whether attribute groups can be accurately identified this way
        if(!group.object.isKindOfTypeAnnotated("hres:annotation:repository:file")) { return; }
        var existing = _.find(document.embargoes, function(em) {
            return (em.groupId === group.extension.groupId);
        });
        var files = [];
        group.object.every(function(v,d,q) {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                files.push(v);
            }
        });
        if(existing) {
            existing.files = P.template("files").render({
                files: files
            });
            existing.attribute = "<b>"+_.escape(SCHEMA.getAttributeInfo(group.extension.desc).name)+"</b>";
        } else {
            if(!document.embargoes) { document.embargoes = []; }
            document.embargoes.push({
                groupId: group.extension.groupId,
                desc: group.extension.desc,
                attribute: "<b>"+_.escape(SCHEMA.getAttributeInfo(group.extension.desc).name)+"</b>",
                files: P.template("files").render({
                    files: files
                })
            });
        }
    });
    var form = embargoForm.instance(document);
    form.choices("embargoLengths",
        ["Indefinite"].concat(_.map(_.range(1,61), function(i) { return i.toString(); }))
    );
    form.update(E.request);

    if(E.request.method === "POST") {
        // Don't save rendered file html to database
        _.each(document.embargoes, function(em) {
            delete em.files;
        });
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

    E.renderIntoSidebar({
        elements: [{
            label: "Delete all embargoes",
            href: "/do/hres-repo-embargoes/delete/"+output.ref,
            indicator: "standard"
        }]
    }, "std:ui:panel");
    E.render({
        output: output.ref,
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
