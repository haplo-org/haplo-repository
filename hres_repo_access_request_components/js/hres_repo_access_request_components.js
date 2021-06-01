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


/*HaploDoc
title: Reporting
sort: 1
node: /hres_repo_access_request_components/reporting
--

h3(feature). .use("hres:repository:access_requests:default_reporting")

This feature provides default basic reporting on an implementation by implementation basis for access requests. Creates and includes links to dashboards \
showing the in progress and completed access request numbers by output or author for each workflow using the feature. The numbers on the dashboards link to \
an information table displaying some key information about the requests (internal/external, creation date, completion date, who the workflow is waiting on, etc).

The specification provided must include 2 properties for it's use
 @acceptedSelector@ and @rejectedSelector@ : These are the workflow state selectors for when the workflow has ended in either an accepted or rejected state.

The dashboard permissions are enforced by action "hres:repository_access_requests:can_view_reporting" (if you need to change permissions).

*/

var CanViewAccessRequestReporting = O.action("hres_repository_access_requests:can_view_reporting").
    title("Can view access request reporting dashboards").
    allow("group", Group.RepositoryEditors);

P.workflow.registerWorkflowFeature("hres:repository:access_requests:default_reporting", function(workflow, spec) {
    var updateRelevantFacts = function(output) {
        O.service("std:reporting:update_required", "repository_items", [output.ref]);
        let researchers = output.every(A.Author);
        if("Editor" in A) { researchers = researchers.concat(output.every(A.Editor)); }
        O.service("std:reporting:update_required", "researchers", researchers);
    };

    workflow.start(function(M, initial, properties) {
        updateRelevantFacts(properties.ref.load());
    });

    workflow.observeFinish({}, function(M) {
        updateRelevantFacts(O.ref(M.workUnit.tags["ref"]).load());
    });

    // --------------------------------------------------------------------------
    // Reporting
    // --------------------------------------------------------------------------

    P.implementService("std:reporting:gather_collection_update_rules", function(rule) {
        _.each(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), type => {
            rule("researchers", type, A.Author);
            if("Editor" in A) { rule("researchers", type, A.Editor); }
        });
    });

    P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
        collection.fact("inProgressAccessRequests"+workflow.name,   "int",  "In progress access requests").
            fact("completeAccessRequests"+workflow.name,            "int",  "Completed access requests").
            fact("totalAccessRequests"+workflow.name,               "int",  "Total access requests").
            fact("acceptedRequests"+workflow.name,                  "int",  "Accepted requests").
            fact("rejectedRequests"+workflow.name,                  "int",  "Rejected requests").
            statistic({
                name: "totalAcceptedRequests"+workflow.name,
                description: "Accepted requests",
                aggregate: "SUM",
                fact: "acceptedRequests"+workflow.name
            }).
            statistic({
                name: "totalRejectedRequests"+workflow.name,
                description: "Rejected requests",
                aggregate: "SUM",
                fact: "rejectedRequests"+workflow.name
            });
    });

    P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
        let wus = O.work.query(workflow.fullName).
            tag("hres:repository:is_ar_workflow", "1").
            tag("ref", object.ref.toString());

        row["inProgressAccessRequests"+workflow.name] = wus.count();
        row["completeAccessRequests"+workflow.name] = wus.isClosed().count();
        row["totalAccessRequests"+workflow.name] = wus.isEitherOpenOrClosed().count();

        let accepted = 0;
        let rejected = 0;
        _.each(wus.isClosed(), (closedWu) => {
            let M = workflow.instance(closedWu);
            if(M.selected(spec.acceptedSelector)) { accepted++; }
            if(M.selected(spec.rejectedSelector)) { rejected++; }
        });
        row["acceptedRequests"+workflow.name] = accepted;
        row["rejectedRequests"+workflow.name] = rejected;
    });

    P.implementService("std:reporting:collection:researchers:setup", function(collection) {
        collection.fact("inProgressAccessRequests"+workflow.name,   "int",  "In progress access requests").
            fact("completeAccessRequests"+workflow.name,            "int",  "Completed access requests").
            fact("totalAccessRequests"+workflow.name,               "int",  "Total access requests").
            fact("acceptedRequests"+workflow.name,                  "int",  "Accepted requests").
            fact("rejectedRequests"+workflow.name,                  "int",  "Rejected requests");
    });

    P.implementService("std:reporting:collection:researchers:get_facts_for_object", function(object, row) {
        let wus = O.work.query(workflow.fullName).
                tag("hres:repository:is_ar_workflow", "1").
                isEitherOpenOrClosed(),
            inProgress = 0,
            complete = 0;
        let accepted = 0;
        let rejected = 0;

        _.each(wus, wu => {
            let ref = O.ref(wu.tags.ref),
                user = O.user(object.ref);
            let isAuthor = user ? O.serviceMaybe("hres:repository:is_author", user, ref.load()) : false;
            if(isAuthor) {
                if(wu.closed) {
                    complete++;
                    let M = workflow.instance(wu);
                    if(M.selected(spec.acceptedSelector)) { accepted++; }
                    if(M.selected(spec.rejectedSelector)) { rejected++; }
                } else {
                    inProgress++;

                }
            }
        });
        row["inProgressAccessRequests"+workflow.name] = inProgress;
        row["completeAccessRequests"+workflow.name] = complete;
        row["totalAccessRequests"+workflow.name] = inProgress+complete;
        row["acceptedRequests"+workflow.name] = accepted;
        row["rejectedRequests"+workflow.name] = rejected;
    });

    P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
        if(O.currentUser.allowed(CanViewAccessRequestReporting)) {
            builder.panel(575).
                title("Access Requests").
                link(20, "/do/hres-repo-access-request/requests-by-output-"+workflow.name, workflow.description+" by output").
                link(30, "/do/hres-repo-access-request/requests-by-author-"+workflow.name, workflow.description+" by author");
        }
    });

    // --------------------------------------------------------------------------
    // Dashboard utility functions
    // --------------------------------------------------------------------------

    var dashboardFilterAndColumns = function(dashboard) {
        return dashboard.filter(select => { select.or(sq => {
                sq.where("completeAccessRequests"+workflow.name, ">", 0).
                    where("inProgressAccessRequests"+workflow.name, ">", 0);
                });
            }).
            columns(30, [
                {
                    type: "linked",
                    column: "completeAccessRequests"+workflow.name,
                    link(row) { return "/do/hres-repo-access-request/list-items-"+workflow.name+"/"+row.ref+"?display=closed"; }
                },
                "acceptedRequests"+workflow.name,
                "rejectedRequests"+workflow.name,
                {
                    type: "linked",
                    column: "inProgressAccessRequests"+workflow.name,
                    link(row) { return "/do/hres-repo-access-request/list-items-"+workflow.name+"/"+row.ref+"?display=open"; }
                },
                {
                    type: "linked",
                    column: "totalAccessRequests"+workflow.name,
                    link(row) { return "/do/hres-repo-access-request/list-items-"+workflow.name+"/"+row.ref+"?display=all"; }
                }
            ]);
    };

    var getListedItems = function(object, display) {
        let isOutput = object.isKindOfTypeAnnotated("hres:annotation:repository-item"),
            wus = O.work.query(workflow.fullName).
                tag("hres:repository:is_ar_workflow", "1");
        let displayMap = {
            "all": "All",
            "open": "In progress",
            "closed": "Completed"
        };

        if(display === "closed") { wus = wus.isClosed(); }
        if(display === "all") { wus = wus.isEitherOpenOrClosed(); }
        if(isOutput) { wus = wus.tag("ref", object.ref.toString()); }
        else {
            wus = _.filter(wus, wu => {
                let ref = O.ref(wu.tags.ref),
                    user = O.user(object.ref);
                return ref && user && O.serviceMaybe("hres:repository:is_author", user, ref.load());
            });
        }
        let backLinkEnd = isOutput ? "output-"+workflow.name : "author-"+workflow.name;
        return {
            pageTitle: displayMap[display] + " access requests linked to " + object.title,
            object: object,
            isOutput: isOutput,
            workflow: workflow.name,
            backLink: "/do/hres-repo-access-request/requests-by-"+backLinkEnd,
            isOpen: display === "open",
            showAll: display === "all",
            wus: _.map(wus, wu => {
                let row = P.db.requestDocuments.select().where("workUnit", "=", wu.id)[0],
                    document = row ? JSON.parse(row.document) : {};
                return {
                    id: wu.id,
                    object: isOutput ? object : O.ref(wu.tags.ref),
                    opened: wu.openedAt,
                    closed: wu.closed ? wu.closedAt : undefined,
                    actionableByRef: wu.actionableBy.ref,
                    actionableByName: wu.actionableBy.name,
                    audience: wu.tags.audience,
                    createdByEmail: document.email,
                    createdByRef: wu.createdBy.ref
                };
            })
        };
    };

    // --------------------------------------------------------------------------
    // Dashboards
    // --------------------------------------------------------------------------

    P.respond("GET,POST", "/do/hres-repo-access-request/requests-by-output-"+workflow.name, [
    ], function(E) {
        CanViewAccessRequestReporting.enforce();
        let dashboard = P.reporting.dashboard(E, {
            kind: "list",
            collection: "repository_items",
            name: "access_requests_by_output",
            title: workflow.description + " by output"
        }).
            summaryStatistic(1, "totalAcceptedRequests"+workflow.name).
            summaryStatistic(2, "totalRejectedRequests"+workflow.name);
        dashboardFilterAndColumns(dashboard).
            columns(10, [{fact:"ref", heading: "Output", link:true}]).
            columns(20, [{fact:"author", link:true}]).
            respond();
    });

    P.respond("GET,POST", "/do/hres-repo-access-request/requests-by-author-"+workflow.name, [
    ], function(E) {
        CanViewAccessRequestReporting.enforce();
        let dashboard = P.reporting.dashboard(E, {
            kind: "list",
            collection: "researchers",
            name: "access_requests_by_author",
            title: workflow.description + " by author"
        });
        dashboardFilterAndColumns(dashboard).
            columns(10, [{fact:"ref", heading: "Author", link:true}]).
            respond();
    });

    P.respond("GET", "/do/hres-repo-access-request/list-items-"+workflow.name, [
        {pathElement: 0, as: "object"},
        {parameter: "display", as: "string"}
    ], function(E, object, display) {
        CanViewAccessRequestReporting.enforce();
        if(!_.contains(["all","open","closed"], display)) { return; }
        E.render(getListedItems(object, display), "reporting/list-items");
    });
});