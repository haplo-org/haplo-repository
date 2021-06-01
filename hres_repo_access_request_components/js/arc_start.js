/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var INTERNAL_SUBMISSION_SPEC = {};

var userCanReadProject = function(user, object) {
    // Prevents workflow being created where project entity causes permissions issues.
    return !!(!object.first(A.Project) || (object.first(A.Project) && user.canRead(object.first(A.Project))));
};

/*HaploDoc
title: Internal requests
node: /hres_repo_access_request_components/internal
sort: 1
--

Form and database for submission of internal access requests (ie. requestor has a user account).

h3(feature). .use("hres:repository:access_requests:internal_submission", spec)

h3(key). spec

The specification object to configure this workflow feature, with keys:

h3(property). label (required)

The label for links to submit an access request.

h3(property). form (required)

The submission form.

h3(function). canStart(user, object) (required)

Defines which users are able to submit requests.

h3(property). panel

The action panel priority for the "start" link on the repository item page. Default priority is 125.

*/
P.workflow.registerWorkflowFeature("hres:repository:access_requests:internal_submission", function(workflow, spec) {

    P.WORKFLOW_DEFINITION_LOOKUP[workflow.fullName] = workflow;
    INTERNAL_SUBMISSION_SPEC[workflow.fullName] = spec;

    workflow.plugin.implementService("std:action_panel:category:hres:repository_item", function(display, builder) {
        if(spec.canStart(O.currentUser, display.object) && userCanReadProject(O.currentUser, display.object)) {
            builder.panel(spec.panel || 125).
                link("default", P.template("start/start-url").render({
                    ref: display.object.ref.toString(),
                    workType: workflow.fullName
                }), spec.label);
        }
    });

    workflow.implementWorkflowService("ar:application_deferred_render", function(M, sections) {
        if(M.workUnit.tags["audience"] === "internal") {
            let document = M.workflowService("ar:get_request_document");
            if(document) {
                sections.push({
                    sort: 10,
                    deferred: P.template("document").deferredRender({
                        form: spec.form.instance(document)
                    })
                });
            }
        }
    });

    workflow.implementWorkflowService("ar:requestor_details", function(M) {
        if(M.workUnit.tags["audience"] === "internal") {
            return M.workUnit.createdBy;
        }
    });

});

 
P.respond("GET,POST", "/do/hres-repo-access-request/start", [
    {pathElement:0, as:"object"},
    {parameter:"worktype", as:"string"}
], function(E, item, workType) {
    const workflow = P.WORKFLOW_DEFINITION_LOOKUP[workType];
    const spec = INTERNAL_SUBMISSION_SPEC[workType];
    if(!spec.canStart(O.currentUser, item) || !userCanReadProject(O.currentUser, item)) { O.stop("Not permitted."); }
    if(!O.service("hres:repository:is_repository_item", item)) { O.stop("Can only request access to repository items."); }
    let document = {};
    let form = spec.form.handle(document, E.request);
    if(form.complete) {
        let M = workflow.create({ref: item.ref});
        M.workUnit.tags["audience"] = "internal";
        M.workUnit.save();
        M.workflowService("ar:save_request_document", document);
        E.response.redirect(M.url);
    }
    E.render({
        label: spec.label,
        item: item,
        form: form
    }, "start/start");
});