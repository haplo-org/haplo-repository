/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var canSubmitForIngest = function(user, item) {
    return ((O.serviceMaybe("hres:repository:is_author", user, item) || item.has(user.ref, A.Editor)) &&
        !P.Ingest.instanceForRef(item.ref));
};

var fillPanel = function(display, builder) {
    let object = display.object;
    let depositPanel = builder.panel(100);
    if(!P.Ingest.instanceForRef(object.ref) && !object.labels.includes(Label.AcceptedIntoRepository)) {
        depositPanel.status(1, "Draft record - not yet available in public repository");
    }
    if(canSubmitForIngest(O.currentUser, object)) {
            depositPanel.link("default", "/do/hres-repo-ingest-workflow/start/"+object.ref.toString(), "Deposit item");
    }
};
P.implementService("std:action_panel:category:hres:repository_item", function(display, builder) {
    fillPanel(display, builder);
});

P.implementService("hres_ref_repository:get_publish_url", function(output) {
    var M = O.service("std:workflow:for_ref", "hres_repo_ingest_workflow:in", output.ref);
    var outputUrl;
    if(M && M.state === "wait_editor") {
        outputUrl = M.transitionUrl("publish");
    }
    return outputUrl;
});

var guidanceNote = P.guidanceNote("repository", "ingest-start",
    "Ingest start", "guidance/ingest-start.xml");

P.respond("GET,POST", "/do/hres-repo-ingest-workflow/start", [
    {pathElement:0, as:"object"}
], function(E, item) {
    if(!canSubmitForIngest(O.currentUser, item)) { O.stop("Not permitted."); }
    if(E.request.method === "POST") {
        P.Ingest.create({object: item});
        E.response.redirect(item.url());
    }
    E.render({
        guidanceNote: guidanceNote.deferredRender(),
        confirmPanel: {
            text: "Would you like to submit this item for acceptance into the repository?",
            backLinkText: "Return to item",
            backLink: item.url(),
            options: [{label:"Submit"}]
        }
    });
});

// ----------------------------------------------------------------

P.hook('hPostObjectEdit', function(response, object, previous) {
    // Create operation
    if(!previous &&
        O.serviceMaybe("hres:repository:is_repository_item", object) &&
        canSubmitForIngest(O.currentUser, object)) {
        response.redirectPath = "/do/hres-repo-ingest-workflow/start/"+object.ref;
    }
});

// Users can edit repository items when they are the actionableBy user of the ingest workflow
P.hook("hOperationAllowOnObject", function(response, user, object, operation) {
    if(operation !== "read" && O.serviceMaybe("hres:repository:is_repository_item", object)) {
        if(O.work.query("hres_repo_ingest_workflow:in").ref(object.ref).actionableBy(user).count()) {
            response.allow = true;
        }
    }
});

// ----------------------------------------------------------------

P.implementService("hres:doi:minting:get-should-have-doi-function", function() {
    return function(object) {
        return (object.labels.includes(Label.RepositoryItem) &&
            object.labels.includes(Label.AcceptedIntoRepository) &&
            !object.labels.includes(Label.RejectedFromRepository));
    };
});
