/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var embargoForm = P.form('embargo', 'form/embargo.json');

var getEarliestPublicationDate = function(object) {
    var publicationDates = _.map(object.every(A.PublicationDate), function(d) { return d.start; });
    return new XDate(_.reduce(publicationDates, function(memo, d) {
        return (memo < d) ? memo : d;
    }));
};

var getEmbargoDocument = function(object) {
    var document = {};
    var row = P.getEmbargoData(object);
    if(row) {
        document = {
            start: "<p>"+new XDate(row.start).toString('dd MMM yyyy')+"</p>",
            customStart: row.startIsEdited ? new XDate(row.start).toString('yyyy-MM-dd') : null,
            embargoLength: row.embargoLength ? row.embargoLength.toString() : "Indefinite",
            licenseURL: row.licenseURL
        };
    } else {
        if(object.first(A.PublicationDate)) {
            var published = getEarliestPublicationDate(object);
            document.start = "<p>"+published.toString("dd MMM yyyy")+"</p>";
        } else {
            document.start = "<p><i>No start date set. Embargo will be set to start today unless a custom start date is chosen.</i></p>";
        }
    }
    return document;
};

var setEmbargo = function(object, document) {
    var start;
    if(!!document.customStart) {
        start = new Date(document.customStart || document.start);
    } else if(object.first(A.PublicationDate)) {
        start = getEarliestPublicationDate(object).toDate();
    } else {
        // Fallback to today
        start = new Date();
    }
    P.db.embargoes.create({
        object: object.ref,
        // TODO: Actual default
        licenseURL: document.licenseURL || "DEFAULT",
        start: start,
        embargoLength: (document.embargoLength === "Indefinite") ? null : parseInt(document.embargoLength, 10),
        startIsEdited: !!document.customStart
    }).save();
};

// TODO: Extend with service when REF is implemented.
var DISPLAY_ATTRIBUTES = [
    A.Type,
    A.Title,
    A.PublicationDate,
    A.Issn,
    A.Isbn,
    A.Publisher,
    A.Journal
];

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

    var document = getEmbargoDocument(output);
    var form = embargoForm.instance(document);
    form.choices("embargoLengths",
        ["Indefinite"].concat(_.map(_.range(1,49), function(i) { return i.toString(); }))
    );
    form.update(E.request);

    if(E.request.method === "POST") {
        setEmbargo(output, document);
        // Embargoed files should not be searchable
        output.reindexText();
        // TODO: Update collections
        // TODO: Notify pattern to re-publish output if workflow has completed
        E.response.redirect(output.url());
    }
    E.renderIntoSidebar({
        elements: [{
            label: "Delete embargo",
            href: "/do/hres-repo-embargoes/delete/"+output.ref,
            indicator: "standard"
        }]
    }, "std:ui:panel");
    // TODO: Extend display via service call when REF is implemented.
    E.render({
        output: output.ref,
        displayObject: displayObject,
        form: form
    }, "edit-embargoes");
});

P.respond("GET,POST", "/do/hres-repo-embargoes/delete", [
    {pathElement:0, as:"object"}
], function(E, output) {
    P.CanEditEmbargoes.enforce();
    
    if(E.request.method === "POST") {
        P.db.embargoes.select().where("object", "=", output.ref).deleteAll();
        // Files show up in searches again
        output.reindexText();
        // TODO: Update collections
        // TODO: Notify pattern to re-publish output if workflow has completed
        E.response.redirect(output.url());
    }
    E.render({
        pageTitle: "Delete embargo: "+output.title,
        backLink: "/do/hres-repo-embargoes/edit/"+output.ref,
        backLinkText: "Cancel",
        text: "Warning: This will unlock the files for all users.",
        options: [
            { label: "Delete" }
        ]
    }, "std:ui:confirm");
});
