/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var AccessRequest = P.AccessRequest = P.workflow.implement("ar", "Access Request");

AccessRequest.use("std:notes", {
    canSeePrivateNotes: function(M, user) {
        return user.isMemberOf(Group.RepositoryEditors) ||
            user.isMemberOf(Group.DataPreparers) ||
            M.hasRole(user, "researchDirector") ||
            M.hasRole(user, "author");
    }
});

AccessRequest.findEntityRootObjectRefWhenUnknown(function(M) {
    return O.ref(M.workUnit.tags["ref"]);
});
AccessRequest.use("hres:combined_application_entities", {
    "author": ["object", A.Author],
    "authorOrFrd": function() {
        if(this.author_refMaybe) {
            return this.author_refList;
        } else {
            return this.researchDirector_refList;
        }
    },
    "editor": ["object", A.Editor]
});

AccessRequest.taskTitle(function(M) {
    return O.ref(M.workUnit.tags["ref"]).load().title;
});

AccessRequest.taskUrl(function(M) {
    return "/do/hres-repo-access-request/application/"+M.workUnit.id;
});

AccessRequest.start(function(M, initial, properties) {
    initial.state = "editor_review";
    M.workUnit.tags["ref"] = properties.ref;
});

AccessRequest.filterTransition({state:"author_or_frd_review"}, function(M, transition) {
    if(transition === "release_files") { 
        if(M.timelineSelect().where("action", "=", "progress_require_preparation").length) {
            return false;
        }
    }
});

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
        ]
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
