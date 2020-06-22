/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var AccessRequest = P.AccessRequest = P.workflow.implement("ar", "Access Request");

// -------------------------------------------------------
// Access Request component workflow features

AccessRequest.use("hres:repository:access_requests:workflow_setup", {
    action: P.CanViewApplication
});
AccessRequest.use("hres:repository:access_requests:default_reporting", {
    acceptedSelector: { state: "access_granted" },
    rejectedSelector: { state: "rejected" }
});

AccessRequest.use("hres:repository:access_requests:default_text"); 

var REQUEST_ACCESS = P.form("requestAccess", "form/public_request_submit.json"),
    REQUEST_SUBMIT = P.form("requestSubmit", "form/request_submit.json");

AccessRequest.use("hres:repository:access_requests:internal_submission", {
    label: "Request access to files",
    form: REQUEST_SUBMIT,
    canStart: function(user, object) {
        return O.serviceMaybe("hres:repository:access_requests:has_restricted_files_for_user", user, object);
    }
});

if(O.featureImplemented("std:web-publisher")) {
    // TODO: Label and canStart should be done by instance-service, when implemented
    AccessRequest.use("hres:repository:access_requests:public_submission", {
        path: "access-request",
        label: "Access request",
        form: REQUEST_ACCESS,
        canStart: function(object) {
            // Permissions enforced by calling service with publication service user - could be neater?
            return O.serviceMaybe("hres:repository:access_requests:has_restricted_files_for_user", O.currentUser, object);
        }
    });
}

P.implementService("haplo_activity_navigation:blank-forms:repository", function(forms) {
    forms({
        name: "ar-rep-request-form",
        title: "Access to files request: Request form",
        sort: 410,
        forms: [REQUEST_ACCESS, REQUEST_SUBMIT]
    });
});

AccessRequest.use("hres:repository:access_requests:file_preparation", {
    upload: [
        {roles: ["hres:group:data-preparers"], selector: {state: "prepare_files"}}
    ],
    view: [
        {},
        {roles: ["requestor"], selector: {}, action:"deny"}
    ]
});

AccessRequest.use("hres:repository:access_requests:file_release");

// -------------------------------------------------------

AccessRequest.use("std:notes", {
    canSeePrivateNotes: function(M, user) {
        return user.isMemberOf(Group.RepositoryEditors) ||
            user.isMemberOf(Group.DataPreparers) ||
            M.hasRole(user, "researchDirector") ||
            M.hasRole(user, "author");
    }
});

AccessRequest.use("hres:combined_application_entities", {
    "requestor": function() {
        let creator = this.M.workUnit.createdBy;
        return (creator.ref ? [creator.ref] : []);
    },
    "authorOrFrd": function() {
        return this.author_refMaybe ? this.author_refList : this.researchDirector_refList;
    }
});

AccessRequest.start(function(M, initial, properties) {
    initial.state = "editor_review";
});

AccessRequest.filterTransition({state:"author_or_frd_review"}, function(M, transition) {
    if(transition === "release_files") { 
        if(M.timelineSelect().where("action", "=", "progress_require_preparation").length) {
            return false;
        }
    }
});

// Fallback implementation, if no preparation has taken place
// Don't put it into a feature as it's a permissive fallback - shouldn't be included by default
AccessRequest.implementWorkflowService("ar:prepared_files", function(M) {
    if(!M.selected({flags: ["preparationOccurred"]})) {
        let files = [];
        M.entities.object.every(function(v,d,q) {
            if((O.typecode(v) === O.T_IDENTIFIER_FILE) && d !== A.PreparedFile) {
                files.push(O.file(v));
            }
        });
        return files;
    }
});

// -------------------------------------------------------

AccessRequest.states({
    "editor_review": {
        actionableBy: "hres:group:repository-editors",
        transitions: [
            ["progress", "author_or_frd_review"],
            ["progress_require_preparation", "author_or_frd_review"],
            ["reject", "rejected"]
        ],
        flags: ["preparationRequiredEditable"]
    },
    "author_or_frd_review": {
        actionableBy: "authorOrFrd",
        transitions: [
            ["release_files", "access_granted"],
            ["send_for_preparation", "prepare_files"],
            ["propose_rejection", "confirm_rejection"]
        ]
    },
    "prepare_files": {
        actionableBy: "hres:group:data-preparers",
        transitions: [
            ["send_for_release", "review_prepared_files"]
        ],
        flagsSetOnEnter: ["preparationOccurred"]
    },
    "review_prepared_files": {
        actionableBy: "hres:group:repository-editors",
        transitions: [
            ["release_files", "access_granted"],
            ["return_to_preparers", "prepare_files"]
        ],
        flags: ["preparationRequiredEditable"]
    },
    "access_granted": {
        finish: true
    },
    "confirm_rejection": {
        actionableBy: "hres:group:repository-editors",
        transitions: [
            ["reject", "rejected"]
        ]
    },
    "rejected": {
        finish: true
    }
});
