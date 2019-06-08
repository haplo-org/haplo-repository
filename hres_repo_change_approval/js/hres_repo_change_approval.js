/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo_alternative_versions:update_replacement_object", function(source, authorisingUser, authoritative) {
    if(authorisingUser.isMemberOf(Group.RepositoryEditors)) { return; }
    // Don't bother with a draft version if this is a new output to the repository
    if(!authoritative) { return; }
    // TODO: Maybe make this configurable in UI
    let authorisedSources = O.application.config["hres_repo_change_approval:sources_requiring_no_approval"] || [];
    if(authorisedSources.indexOf(source) !== -1) { return; }
    let draft = findExistingDraft(authoritative);
    if(draft) {
        draft = draft.mutableCopy();
    } else {
        draft = O.object([Label.AlternativeVersion, Label.RequiresApproval]);
        if(authoritative) {
            draft.append(authoritative, A.AuthoritativeVersion);
        }
    }
    return draft;
});

P.implementService("haplo_alternative_versions:notify:updated_object", function(object) {
    if(object.labels.includes(Label.RequiresApproval)) {
        createApprovalWorkUnit(object);
    }
});

P.implementService("haplo_alternative_versions:source_for_alternative_object", function(object) {
    if(object.labels.includes(Label.RequiresApproval)) {
        return {
            source: "hres_repo_change_approval:draft",
            name: "Updated version for approval",
            identifier: object.ref.toString()
        };
    }
});

// --------------------------------------------------------------------------
// Editing

P.hook('hPreObjectEdit', function(response, object, isTemplate) {
    if(O.service("hres:repository:is_repository_item", object) &&
        object.labels.includes(Label.AcceptedIntoRepository) &&
        !O.currentUser.isMemberOf(Group.RepositoryEditors)) {
            let draft = findExistingDraft(object);
            if(draft && !draft.labels.includes(Label.DELETED)) {
                response.redirectPath = "/do/hres-repo-change-approval/confirm-discard-draft/"+object.ref;
            } else {
                draft = copyDataToDraft(object);
                response.redirectPath = "/do/edit/"+draft.ref;
            }
    }
});

P.respond("GET,POST", "/do/hres-repo-change-approval/confirm-discard-draft", [
    {pathElement:0, as:"object"},
    {parameter:"discard", as:"string", optional:true}
], function(E, object, discard) {
    if(E.request.method === "POST") {
        let existing = findExistingDraft(object);
        if(discard === "yes") {
            let draft = copyDataToDraft(object, existing);
            return E.response.redirect("/do/edit/"+draft.ref);
        } else {
            return E.response.redirect(existing.url());
        }
    }
    E.render({
        pageTitle: "Discard draft changes?",
        backLink: object.url(),
        text: "Warning: Making changes here will overwrite any existing changes on the draft version "+
            "currently awaiting approval.",
        options: [
            { label:"Confirm: discard draft", parameters:{"discard": "yes"} },
            { label:"View existing draft" }
        ]
    }, "std:ui:confirm");
});

P.hook('hPostObjectEdit', function(response, object, previous) {
    if(object.labels.includes(Label.RequiresApproval)) {
        createApprovalWorkUnit(object);
    }
});

var findExistingDraft = function(authoritative) {
    let alternativeVersions = O.service("haplo_alternative_versions:for_object", authoritative);
    return _.find(alternativeVersions, (alt) => {
        return alt.labels.includes(Label.RequiresApproval);
    });
};

var copyDataToDraft = function(authority, draft) {
    // Platform handles permissions for editing
    if(!draft) {
        draft = O.object();
    }
    // Delete all data from the draft version
    if(!draft.isMutable()) { draft = draft.mutableCopy(); }
    let descs = [];
    draft.every((v,d,q) => { descs.push(d); });
    _.each(_.uniq(descs), (d) => draft.remove(d));
    // Replace it with the data from the authoritative version
    authority.every((v,d,q) => draft.append(v,d,q));
    draft.append(authority.ref, A.AuthoritativeVersion);
    draft.save(O.labelChanges([Label.AlternativeVersion, Label.RequiresApproval]));
    // Re-use the service required by haplo_alternative_versions for updating any associated databases
    O.serviceMaybe("haplo_alternative_versions:update_database_information", authority, draft.ref.load());
    return draft;
};

// --------------------------------------------------------------------------
// Approval

P.workUnit({
    workType: "approve",
    description: "Approve change to deposited repository item",
    render(W) {
        if(W.workUnit.closed && (W.context === "object")) { return; }
        W.render({
            fullInfo: (W.context === "list") ? W.workUnit.ref.load().url() : null,
            list: (W.context === "list"),
            object: W.workUnit.ref,
            requestedBy: W.workUnit.createdBy.name
        });
    }
});

var createApprovalWorkUnit = function(object) {
    let wu = O.work.query("hres_repo_change_approval:approve").ref(object.ref);
    // If an approval is open already, don't create a second
    if(wu.count()) { return; }
    O.work.create({
        workType: "hres_repo_change_approval:approve",
        actionableBy: Group.RepositoryEditors,
        ref: object.ref
    }).save();
};

P.implementService("std:action_panel:alternative_versions", function(display, builder) {
    let wu = O.work.query("hres_repo_change_approval:approve").ref(display.object.ref)[0];
    if(wu) {
        let panel = builder.panel('top');
        panel.element(100, {label: "This record has changes that are not yet on the authoritative version"});
        if(O.currentUser.isMemberOf(Group.RepositoryEditors)) {
            panel.link(110, "/do/hres-repo-change-approval/approve/"+wu.id, "Approve changes to record");
        }
    }
});

P.respond("GET,POST", "/do/hres-repo-change-approval/approve", [
    {pathElement:0, as:"workUnit"}
], function(E, workUnit) {
    if(!O.currentUser.isMemberOf(Group.RepositoryEditors)) { O.stop("Not permitted"); }
    let object = workUnit.ref.load();
    if(E.request.method === "POST") {
        let authoritative = object.first(A.AuthoritativeVersion).load();
        O.service("haplo_alternative_versions:copy_data_to_authoritative", object);
        workUnit.close(O.currentUser).save();
        object.relabel(O.labelChanges(Label.DELETED));
        return E.response.redirect(authoritative.url());
    }
    E.render({
        pageTitle: "Approve",
        backLink: object.url(),
        text: "Approve the update to this record.",
        options: [{label:"Approve"}]
    }, "std:ui:confirm");
});


