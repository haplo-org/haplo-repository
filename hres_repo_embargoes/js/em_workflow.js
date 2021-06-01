/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Prevent exceptioning on release to existing clients due to new feature usage.
// Delete once all clients have had this update.
if(O.featureImplemented("std:workflow")) {
    P.use("std:workflow");
}

var registeredWorkflows = {};

var getWorkflowImplementationForObject = function(object) {
    const spec = _.find(registeredWorkflows, (spec, fullName) => {
        return !!O.work.query(fullName).
            ref(object.ref).
            isEitherOpenOrClosed().
            anyVisibility().
            latest();
    });
    if(spec) {
        const M = spec._workflow.instanceForRef(object.ref);
        return [M, spec];
    }
};

var objectWorkflowIsUsingFeature = P.objectWorkflowIsUsingFeature = function(object) {
    return !!getWorkflowImplementationForObject(object);
};


var userCanEditEmbargoesForWorkflowObject = P.userCanEditEmbargoesForWorkflowObject = function(user, object) {
    const [M, spec] = getWorkflowImplementationForObject(object);
    return user.allowed(P.CanEditEmbargoes) || (("canEditEmbargoes" in spec) && spec.canEditEmbargoes(user, M));
};

/*HaploDoc
node: /repository/hres_repo_embargoes/workflows
title: Workflow feature
sort: 1
--

h3(feature). "hres_repo_embargoes:edit_embargoes"

Allows the embargo UI to be handled by a workflow action panel, the links and UI from the std_action_panel implementation \
are automatically hidden for objects part of a workflow using this feature. This allows workflows to restrict at what stage \
and to which users in a workflow the embargoes UI is available.

Spec has keys

|*Field*|*Type*|*Description*|
|@selector@|optional @workflow selector@|Selector for the positions in the workflow where embargoes may be set, defaults to the universal selector @{}@|
|@canEditEmbargoes@|optional @function(user, M)@|Function to determine whether a user has permission within this workflow to edit the embargoes, there is \
an override for the action @hres_repo_embargoes:can_edit@ so admin permissions aren't required to be set for every usage|
*/

P.workflow.registerWorkflowFeature("hres_repo_embargoes:edit_embargoes", function(workflow, spec) {
    spec._workflow = workflow;
    registeredWorkflows[workflow.fullName] = spec;
    // States to show the UI in rather than constantly
    const selector = spec.selector || {};
    const canEditEmbargoes = spec.canEditEmbargoes || function(user, M) {};

    workflow.actionPanel(selector, function(M, builder) {
        const i = P.locale().text("template");
        const object = M.entities.object;
        const embargoes = P.getEmbargoData(object);
        if(embargoes) {
            const anyIsActive = _.some(embargoes, (e) => e.isActive());
            builder.panel("hres:repository_item:embargo").element(0, {title: anyIsActive ? i["Under embargo"] : i["Embargo over"]});
            _.each(embargoes, (embargo) => {
                let text = O.interpolateString(i["{dates} ({affected})"], {
                  dates: embargo.getDatesForDisplay(),
                  affected: embargo.desc ? SCHEMA.getAttributeInfo(embargo.desc).name : "Whole record"
                });
                builder.panel("hres:repository_item:embargo").link(1, embargo.licenseURL, text);
            });
        }
        if(canEditEmbargoes(O.currentUser, M) || O.currentUser.allowed(P.CanEditEmbargoes)) {
            builder.panel("hres:repository_item:embargo").
                link("default",
                    "/do/hres-repo-embargoes/edit/"+object.ref,
                    O.interpolateString(i["{action} embargo"], { action: !!embargoes ? "Edit" : "Set" }));
        }

        if(!(O.application.config["hres_repo_embargoes:sherpa_romeo_enable_for_articles_only"] && !object.isKindOf(T.JournalArticle))) {
            builder.panel("hres:repository_item:embargo").
                link("bottom",
                    "/do/hres-repo-embargoes/sherpa-information/"+object.ref,
                    i["View archiving guidance"]);
            }
    });

});