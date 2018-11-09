/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var Ingest = P.Ingest = P.workflow.
    implement("in", "Ingest").
    // On individual panels as these are above the repository_item panel
    objectElementActionPanelName("output").
    objectElementActionPanelName("collection").
    objectElementActionPanelName("research_data");

if(P.workflow.workflowFeatureImplemented("hres:ref_compliance")) {
    Ingest.use("hres:ref_compliance");
}

Ingest.use("std:notes", {
    canSeePrivateNotes: function(M, user) { return user.isMemberOf(Group.RepositoryEditors); }
});

Ingest.actionPanelTransitionUI({state:"on_hold"}, function(M, builder) {
    if(O.currentUser.isMemberOf(Group.RepositoryEditors)) {
        builder.link("default", '/do/hres-repo-ingest-workflow/recall/'+M.workUnit.id, "Re-activate workflow", "standard");
    }
});

Ingest.observeFinish({}, function(M) {
    var mItem = M.workUnit.ref.load();
    var addLabel = (M.state === "published") ? Label.AcceptedIntoRepository : Label.RejectedFromRepository;
    var removeLabel = (M.state === "published") ? Label.RejectedFromRepository : Label.AcceptedIntoRepository;
    var changes = O.labelChanges().add(addLabel).remove(removeLabel);
    if(mItem.first(A.PublicationProcessDates, Q.Deposited)) {
        mItem.relabel(changes);
    } else {
        mItem = mItem.mutableCopy();
        mItem.append(O.datetime(new Date(), undefined, O.PRECISION_DAY), A.PublicationProcessDates, Q.Deposited);
        mItem.save(O.labelChanges().add(addLabel).remove(removeLabel));
    }
});

Ingest.start(function(M, initial, properties) {
    initial.state = "wait_editor";
});

Ingest.states({
    "wait_editor": {
        actionableBy: "hres:group:repository-editors",
        transitions: [
            ["publish", "published"],
            ["return", "returned_author"],
            ["place_on_hold", "on_hold"],
            ["reject", "rejected"]
        ]
    },
    "on_hold": {
        actionableBy: "std:group:workflow-on-hold",
        transitions: [
            ["_recall", "wait_editor"]
        ]
    },
    "returned_author": {
        actionableBy: "object:creator",
        transitions: [
            ["submit", "wait_editor"]
        ]
    },
    "published": {
        finish: true
    },
    "rejected": {
        finish: true
    }
});

// --------------------------------------------------------

P.respond("GET,POST", "/do/hres-repo-ingest-workflow/recall", [
    {pathElement:0, as:"workUnit", allUsers:true}
], function(E, workUnit) {
    if(!O.currentUser.isMemberOf(Group.RepositoryEditors)) { O.stop("Not permitted."); }
    var M = Ingest.instance(workUnit);
    var itemLink = workUnit.ref.load().url();
    if(E.request.method === "POST") {
        M.transition("_recall");
        E.response.redirect(itemLink);
    }
    E.render({
        pageTitle: "Re-activate",
        text: "Re-activate the repository ingest process for this item?",
        backLink: itemLink,
        options: [{label:"Confirm"}]
    }, "std:ui:confirm");
});
