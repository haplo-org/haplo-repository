/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var Ingest = P.Ingest = P.workflow.
    implement("in", "Ingest").
    objectElementActionPanelName("category:hres:repository_item");

if(P.workflow.workflowFeatureImplemented("hres:ref_compliance")) {
    Ingest.use("hres:ref_compliance");
}

Ingest.use("hres:combined_application_entities");
Ingest.use("std:entities:add_entities", {
    submitterOrAuthor: function() {
        var submitter = this.M.workUnit.createdBy;
        var submitterAndAuthors = this.author_refList;
        if(submitter.ref) {
            submitterAndAuthors.unshift(submitter.ref);
        }
        return O.deduplicateArrayOfRefs(submitterAndAuthors);
    }
});

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
    var removeLabels = [
        Label.AcceptedIntoRepository,
        Label.AcceptedClosedDeposit,
        Label.RejectedFromRepository
    ];
    var addLabel;
    if(M.state === "published") {
        addLabel = Label.AcceptedIntoRepository;
    } else if(M.state === "published_closed") {
        addLabel = Label.AcceptedClosedDeposit;
    } else {
        addLabel = Label.RejectedFromRepository;
    }
    // The addLabel is removed from the removeLabels list
    var changes = O.labelChanges().remove(removeLabels).add(addLabel);
    if(mItem.first(A.PublicationProcessDates, Q.Deposited)) {
        mItem.relabel(changes);
    } else {
        mItem = mItem.mutableCopy();
        mItem.append(O.datetime(new Date(), undefined, O.PRECISION_DAY), A.PublicationProcessDates, Q.Deposited);
        mItem.save(changes);
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
            ["publish_closed", "published_closed"],
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
        actionableBy: "submitterOrAuthor",
        transitions: [
            ["submit", "wait_editor"]
        ]
    },
    "published": {
        finish: true
    },
    "published_closed": {
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
