/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var requestForm = P.requestForm = P.form("requestSubmit", "form/request_submit.json");

P.db.table("requestDocuments", {
    workUnit: { type: "int" },
    document: { type: "text" }
});

P.respond("GET,POST", "/do/hres-repo-access-request/start", [
    {pathElement:0, as:"object"}    
], function(E, item) {
    if(!O.service("hres:repository:is_repository_item", item)) { O.stop("Can only request access to repository items."); }
    var document = {};
    var form = requestForm.handle(document, E.request);
    if(form.complete) {
        var M = P.AccessRequest.create({ref: item.ref});
        P.db.requestDocuments.create({
            workUnit: M.workUnit.id,
            document: JSON.stringify(document)
        }).save();
        E.response.redirect(M.url);
    }
    E.render({
        item: item,
        form: form
    });
});

// ----------------------------------------------------------

var preparationRequired = P.form("preparationRequired", "form/preparation_required.json");

P.AccessRequest.use("std:document_store", {
    name: "preparationRequired",
    title: "Required preparation",
    path: "/do/hres-repo-access-request/preparation-required",
    panel: 200,
    priority: 150,
    formsForKey: function(key) {
        return [preparationRequired];
    },
    blankDocumentForKey: function(key) {
        var item = O.ref(key.workUnit.tags["ref"]).load();
        var document = {
            files: []
        };
        item.every(function(v,d,q) {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                document.files.push({
                    original: O.file(v).toHTML({linkToDownload: true})+" <p>"+v.filename
                });
            }
        });
        return document;
    },
    view: [{roles:["submitter"], action:"deny"}, {}],
    edit: [
        {roles:["hres:group:repository-editors"], selector: {flags:["preparationRequiredEditable"]}},
        {roles:["authorOrFrd"], selector: {state:"author_or_frd_review"}}
    ],
    actionableUserMustReview: {pendingTransitions:["release_files", "send_for_preparation"]}
});

var prepareFiles = P.form("filePreparation", "form/prepare_files.json");

P.AccessRequest.use("std:document_store", {
    name: "filePreparation",
    title: "Prepared files",
    path: "/do/hres-repo-access-request/prepare-files",
    panel: 200,
    priority: 200,
    formsForKey: function(key) {
        return [prepareFiles];
    },
    blankDocumentForKey: function(key) {
        var item = O.ref(key.workUnit.tags["ref"]).load();
        var document = {
            files: []
        };
        item.every(function(v,d,q) {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                document.files.push({
                    original: O.file(v).toHTML({linkToDownload: true})+" <p>"+v.filename
                });
            }
        });
        return document;
    },
    view: [{roles:["submitter"], action:"deny"}, {}],
    edit: [{roles:["hres:group:data-preparers"], selector: {state: "prepare_files"}}],
    actionableUserMustReview: {state:"review_prepared_files", pendingTransitions:["release_files"]}
});
