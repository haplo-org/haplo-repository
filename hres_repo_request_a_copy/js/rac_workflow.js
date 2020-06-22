/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var RequestACopy = P.RequestACopy = P.workflow.implement("rac", "Request a Copy");

// -------------------------------------------------------
// Access Request component workflow features

RequestACopy.use("hres:repository:access_requests:workflow_setup", {
    action: P.CanViewRequest
});

RequestACopy.use("hres:repository:access_requests:default_text"); 
RequestACopy.use("hres:repository:access_requests:default_reporting", {
    acceptedSelector: { state: "access_granted" },
    rejectedSelector: { state: "rejected" }
}); 

const PUBLIC_REQUEST = P.form("publicRequest", "form/public_request_submit.json"),
    REQUEST_SUBMIT = P.form("requestSubmit", "form/request_submit.json");

RequestACopy.use("hres:repository:access_requests:internal_submission", {
    label: "Request a copy",
    panel: "hres:repository_item:embargo",
    form: REQUEST_SUBMIT,
    canStart(user, object) {
        return O.serviceMaybe("hres_repo_embargoes:has_embargoed_files_for_user", user, object) &&
            !O.serviceMaybe("hres:repository:access_requests:has_restricted_files_for_user", user, object);
    }
});


if(O.featureImplemented("std:web-publisher")) {
    // TODO: Label and canStart should be done by instance-service, when implemented
    RequestACopy.use("hres:repository:access_requests:public_submission", {
        path: "request-a-copy",
        label: "Request a copy",
        form: PUBLIC_REQUEST,
        canStart(object) {
            // Permissions enforced by calling service with publication service user - could be neater?
            return O.serviceMaybe("hres_repo_embargoes:has_embargoed_files_for_user", O.currentUser, object) &&
                !O.serviceMaybe("hres:repository:access_requests:has_restricted_files_for_user", O.currentUser, object);
        }
    });
}

P.implementService("haplo_activity_navigation:blank-forms:repository", function(forms) {
    forms({
        name: "rac-rep-request-form",
        title: "Request a copy: Request form",
        sort: 400,
        forms: [PUBLIC_REQUEST, REQUEST_SUBMIT]
    });
});

RequestACopy.use("hres:repository:access_requests:file_release");

// -------------------------------------------------------

RequestACopy.use("hres:combined_application_entities", {
    "accessRequestProgressors": function() {
        let repoEditors = O.group(Group.RepositoryEditors).loadAllMembers();
        let list = _.pluck(repoEditors, "ref");
        if(this.author_refMaybe) {
            list = this.author_refList.concat(list);
        }
        return list;
    }
});

RequestACopy.use("std:entities:entity_shared_roles", {
    entities: ["accessRequestProgressors"]
});

RequestACopy.use("std:notes", {
    canSeePrivateNotes(M, user) {
        return user.isMemberOf(Group.RepositoryEditors) ||
            M.hasRole(user, "researchDirector") ||
            M.hasRole(user, "author");
    }
});

RequestACopy.start(function(M, initial, properties) {
    initial.state = "author_review";
});


// Fallback implementation, if no preparation has taken place
// Don't put it into a feature as it's a permissive fallback - shouldn't be included by default
RequestACopy.implementWorkflowService("ar:prepared_files", function(M) {
    if(M.state === "access_granted") {
        let files = [];
        M.entities.object.every(A.File, (v,d,q) => {
            if(d !== A.PreparedFile) {
                files.push(O.file(v));
            }
        });
        return files;
    }
 });

// -------------------------------------------------------

RequestACopy.states({
    "author_review": {
        actionableBy: "accessRequestProgressors",
        transitions: [
            ["release_files", "access_granted"],
            ["reject", "rejected"]
        ]
    },
    "access_granted": {
        finish: true
    },
    "rejected": {
        finish: true
    }
});
