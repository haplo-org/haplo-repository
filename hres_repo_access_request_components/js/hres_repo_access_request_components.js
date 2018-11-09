/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// workType --> workflow definition object
var WORKFLOW_DEFINITION_LOOKUP = P.WORKFLOW_DEFINITION_LOOKUP = {};

/*HaploDoc
title: Workflow setup
node: /hres_repo_access_request_components/setup
sort: 1
--

This feature provides much of the basic UI for an access request, as well as the database for storing the submitted request documents.
This includes setting the main workflow handlers, providing the application overview page and workflow ui (as access requests are not displayed on the main object page)

h3(feature). .use("hres:repository:access_requests:workflow_setup", spec)

h3(key). spec

The specification object to configure this workflow feature, with keys:

h3(property). action (required)

An "Action":https://docs.haplo.org/dev/plugin/interface/action object, defining roles and groups that can view this application.
Authors and (internal) submitting users can see the application by default.

h3(property). path (required)

The consuming plugin's handler response path.

h3(property). pageTitle

A custom page title for the application page. If not specified the default is @M.getTextMaybe("workflow-process-name")+": "+item.title@.
*/
P.db.table("requestDocuments", {
    workUnit: { type: "int" },
    document: { type: "text" }
});

P.workflow.registerWorkflowFeature("hres:repository:access_requests:workflow_setup", function(workflow, spec) {

    WORKFLOW_DEFINITION_LOOKUP[workflow.fullName] = workflow;

    workflow.implementWorkflowService("ar:can_view_workflow", function(M, user) {
        return user.allowed(spec.action) ||
            O.serviceMaybe("hres:repository:is_author", user, O.ref(M.workUnit.tags["ref"]).load()) ||
            M.workUnit.createdBy.id === user.id;
    });

    workflow.implementWorkflowService("ar:save_request_document", function(M, document) {
        P.db.requestDocuments.create({
            workUnit: M.workUnit.id,
            document: JSON.stringify(document)
        }).save();
    });

    workflow.implementWorkflowService("ar:get_request_document", function(M) {
        let q = P.db.requestDocuments.select().where("workUnit", "=", M.workUnit.id);
        if(q[0]) {
            return JSON.parse(q[0].document);
        }
    });

    // ---------------------------------------------------------

    workflow.findEntityRootObjectRefWhenUnknown(function(M) {
        return O.ref(M.workUnit.tags["ref"]);
    });

    workflow.taskUrl(function(M) {
        return "/do/hres-repo-access-request/application/"+M.workUnit.id;
    });

    workflow.start(function(M, initial, properties) {
        M.workUnit.tags["ref"] = properties.ref;
        M.workUnit.tags["hres:repository:is_ar_workflow"] = "1";
    });

    workflow.renderTimelineEntryDeferred(function(M, entry) {
        if(entry.action === "START") {
            return P.template("setup/timeline/start").deferredRender({
                user: M.workflowServiceMaybe("ar:requestor_details")
            });
        }
    });

    workflow.taskTitle(function(M) {
        return O.ref(M.workUnit.tags["ref"]).load().title;
    });
});

P.respond("GET", "/do/hres-repo-access-request/application", [
    {pathElement:0, as:"workUnit", allUsers:true}
], function(E, workUnit) {
    const workflow = WORKFLOW_DEFINITION_LOOKUP[workUnit.workType];
    const M = workflow.instance(workUnit);
    if(!M.workflowServiceMaybe("ar:can_view_workflow", O.currentUser)) { O.stop("Not permitted."); }
    let builder = O.ui.panel();
    M.fillActionPanel(builder);
    E.renderIntoSidebar(builder.deferredRender(), "std:render");
    const item = O.ref(workUnit.tags["ref"]).load();
    let sections = [];
    M.workflowServiceMaybe("ar:application_deferred_render", sections);
    E.render({
        pageTitle: M.getTextMaybe("workflow-process-name")+": "+item.title,
        item: item,
        sections: _.sortBy(sections, "sort"),
        timeline: M.renderTimelineDeferred()
    }, "setup/application");
});

/*HaploDoc
title: Text
sort: 1
node: /hres_repo_access_request_components/text
--

Supplies sensible default text for a set of workflow states, transitions, etc. that are likely to be helpful.

h3(feature). .use("hres:repository:access_requests:default_text")

h2. States

Default text is supplied for states:

|@editor_review@|
|@prepare_files@|
|@review_prepared_files@|
|@access_granted@|
|@rejected@|

h2. Transitions

Default text is supplied for transitions:

|@progress@|
|@progress_require_preparation@|
|@send_for_preparation@|
|@release_files@|
|@reject@|
|@return_to_preparers@|

*/
P.workflow.registerWorkflowFeature("hres:repository:access_requests:default_text", function(workflow) {
    
    workflow.text({
        "status:editor_review": "Waiting for Repository Editor review",
        "status:prepare_files": "Waiting for file preparation for release",
        "status:review_prepared_files": "Reviewing prepared files",
        "status:access_granted": "Request granted",
        "status:rejected": "Request declined",
        "status-list:editor_review": "Please review the files on this repository item for release",
        "status-list:prepare_files": "Please prepare the files on this repository item for release",
        "status-list:review_prepared_files": "Please review the file preparation before release",
        
        "transition-indicator": "primary",
        "action-label": "Progress",
        
        "transition:progress": "Approve",
        "transition-notes:progress": "Approve this request",
        
        "transition:progress_require_preparation": "Approve, subject to file preparation",
        "transition-notes:progress_require_preparation": "Approve this request, subject to file "+
            "preparation work being carried out",
        
        "transition:reject": "Decline",
        "transition-notes:reject": "Decline this request",
        "transition-indicator:reject": "terminal",
        
        "transition:release_files": "Grant request",
        "transition-notes:release_files": "Grant this request",
        
        "transition:send_for_preparation": "Send for preparation",
        "transition-notes:send_for_preparation": "The files require preparation before they can be released. Send them "+
            "on to be appropriately prepared.",
        
        "transition:send_for_release": "Progress",
        "transition-notes:send_for_release": "File preparation is complete",
        
        "transition:return_to_preparers": "Return",
        "transition-notes:return_to_preparers": "Return for further file preparation",
        "transition-indicator:return_to_preparers": "secondary",
        
        "timeline-entry:progress": "forwarded the request",
        "timeline-entry:progress_require_preparation": "forwarded the request",
        "timeline-entry:reject": "declined the request",
        "timeline-entry:release_files": "granted the request",
        "timeline-entry:send_for_preparation": "sent the files for preparation",
        "timeline-entry:send_for_release": "returned the prepared files",
        "timeline-entry:return_to_preparers": "returned the files for further preparation",
        
        "notes-explanation-everyone": "Notes can be seen by the submitter and all staff reviewing this submission",
        "notes-explanation-private": "Seen only by staff reviewing this submission, not seen by the submitter"
    });
    
});

