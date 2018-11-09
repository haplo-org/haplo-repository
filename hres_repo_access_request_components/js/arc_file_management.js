/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

/*HaploDoc
node: /hres_repo_access_request_components/file_release
title: File release
sort: 1
--

This feature integrates access requests with [node:/hres_file_mediated_access] to email prepared file download links for successful requests.

Download links are emailed to the requestor, pointing to a publication or internal URL depending on the @audience@ workUnit tag.

h3(feature). .use("hres:repository:access_requests:file_release", spec)

h3(key). spec

The specification object to configure this workflow feature. The feature uses sensible defaults, so all properties are 

h3(property). selector (optional)

To determine when to release the files. Defaults to @{state: "access_granted"}@

h3(function). getRecipient(M) (optional)

Who to release the files to. Default implementation calls the @"ar:requestor_details"@ workflow service.

Return value must be usable in @M.sendEmail@ (either the @to@ or @toExternal@ email, as appropriate).

h3(function). isExternalRequest(M) (optional)

To determine whether this is an external request. Default implementation checks the instance's @audience@.

External requests will use the @toExternal@ email sending api, and will send a link to a web publication page.
*/
P.workflow.registerWorkflowFeature("hres:repository:access_requests:file_release", function(workflow, spec) {

    let isExternalRequest = function(M) {
        return (spec && ("isExternalRequest" in spec)) ? spec.isExternalRequest(M) : (M.workUnit.tags["audience"] === "external");
    };
    let selector = (spec && ("selector" in spec)) ? spec.selector : {state: "access_granted"};

    workflow.observeEnter(selector, function(M, transition, previousState) {
        // Create a mediated access page
        let files = M.workflowService("ar:prepared_files");
        let identifier = O.service("hres:file_mediated_access:create", files, {
            external: isExternalRequest(M)
        });
        M.workUnit.tags["_fileReleaseIdentifier"] = identifier;
        M.workUnit.save();

        // Send email to recipient
        let releaseUrl = O.service("hres:file_mediated_access_access:release_url", identifier);
        let hostname = M.workflowServiceMaybe("ar:publication_hostname_for_instance") || O.application.hostname;
        let email = {
            template: P.template("file-release/email/release"),
            view: {
                item: O.ref(M.workUnit.tags["ref"]).load(),
                releaseUrl: "https://"+hostname+releaseUrl
            }
        };
        let prop = isExternalRequest(M) ? "toExternal" : "to";
        email[prop] = M.workflowService("ar:requestor_details");
        M.sendEmail(email);
    });

    workflow.renderTimelineEntryDeferred(function(M, entry) {
        if(entry.action === "hres:repository:access_requests:file_downloaded") {
            return P.template("file-release/timeline/files-downloaded").deferredRender(entry);
        }
    });

    workflow.plugin.implementService("hres:file_mediated_access:notify:file_downloaded", function(digest, identifier) {
        let wu = O.work.query().
            tag("_fileReleaseIdentifier", identifier).
            isEitherOpenOrClosed()[0];
        if(wu && (wu.workType === workflow.fullName)) {
            let M = workflow.instance(wu);
            M.addTimelineEntry("hres:repository:access_requests:file_downloaded", {
                file: O.file(digest).identifier().filename
            });
        }
    });

    workflow.plugin.implementService("hres:file_mediated_access:view_section", function(identifier) {
        let wu = O.work.query().
            tag("_fileReleaseIdentifier", identifier).
            isEitherOpenOrClosed()[0];
        if(wu && (wu.workType === workflow.fullName)) {
            return P.template("file-release/release-note").deferredRender({});
        }
    });

    workflow.actionPanel(selector, function(M, builder) {
        if(!isExternalRequest(M)) {
            let recipient = (spec && ("getRecipient" in spec)) ? spec.getRecipient(M) : M.workflowService("ar:requestor_details");
            if(O.currentUser.id === recipient.id) {
                let href = O.serviceMaybe("hres:file_mediated_access_access:release_url", M.workUnit.tags["_fileReleaseIdentifier"]);
                if(href) {
                    builder.panel("default").link("default", href, "Download files", "primary");
                }
            }
        }
    });

});

// ----------------------------------------------------------------------------------------
// File preparation

P.db.table("filesPrepared", {
    workUnit: {type: "int"},
    file: {type: "file"},
    new: {type: "boolean"}
});

// Lookup workType --> spec
var FILE_PREPARATION_SPEC = {};

/*HaploDoc
title: File preparation
node: /hres_repo_access_request_components/file_preparation
sort: 1
--

This feature provides functionality to manage the preparation of file versions suitable for release.

Released files are tagged with their intended [node:hres_repo_access_request_components#Audience] and [node:hres_repo_access_request_components#Action], as well as any additional preparation notes.

Files are copied into the @hres:attribute:prepared-files@ attribute on release, and previously released files are suggested for subsequent access requests.

h2. Interfaces

h3(service). workflowService("ar:prepared_files")

Returns the prepared files for release for this workflow instance.

h2. Specification

h3(feature). .use("hres:repository:access_requests:file_preparation", spec)

h3(key). spec

The specification object to configure this workflow feature, with keys:

h3(property). upload (required)

An array of objects defining which users can upload files prepared for release, and when. Each of these objects has properties:

|@roles@|An array of roles, given as strings. These can be entity names or group api codes|
|@selector@|A workflow selector defining the states when these roles can upload prepared files|

An empty object returns @true@ for all users.

h3(property). view

An array of objects defining points when the prepared files can be viewed, and by whom. As in @upload@, each of these objects has keys:

|@roles@|An array of roles, given as strings. These can be entity names or group api codes|
|@selector@|A workflow selector defining the states when these roles can upload prepared files|

*/
P.workflow.registerWorkflowFeature("hres:repository:access_requests:file_preparation", function(workflow, spec) {
    
    P.WORKFLOW_DEFINITION_LOOKUP[workflow.fullName] = workflow;
    FILE_PREPARATION_SPEC[workflow.fullName] = spec;

    // TODO: This is a partial re-implementation of the functionality provided by std_docstore
    // May be worth unifying into a more general feature in future
    workflow.actionPanelTransitionUI({}, function(M, builder) {
        if(can(M, O.currentUser, "upload")) {
            builder.link("default", "/do/hres-repo-access-request/file-preparation/edit/"+M.workUnit.id, "Prepare files", "primary");
            return true;    // Block default transition UI
        }
    });

    workflow.observeFinish({}, function(M) {
        const item = O.ref(M.workUnit.tags["ref"]).load();
        const q = P.db.filesPrepared.select().
            where("workUnit", "=", M.workUnit.id).
            where("new", "=", true);
        if(q.length > 0) {
            let mItem = item.mutableCopy();
            q.each(function(row) {
                mItem.append(O.file(row.file).identifier(), A.PreparedFile);
            });
            mItem.save();
        }
    });

    // --------------------------------------------------------------

    workflow.implementWorkflowService("ar:application_deferred_render", function(M, sections) {
        if(can(workflow.instance(M.workUnit), O.currentUser, "view")) {
            let selected = P.db.filesPrepared.select().where("workUnit", "=", M.workUnit.id);
            if(selected.length) {
                let files = _.pluck(selected, "file");
                sections.push({
                    sort: 50,
                    deferred: getTableDeferred(M, files, selected, false /* Not editable */)
                });
            }
        }
    });

    workflow.transitionUI({}, function(M, E, ui) {
        // TODO: Some check that we're on the "forward" transition
        if(can(M, O.currentUser, "upload")) {
            let selected = P.db.filesPrepared.select().where("workUnit", "=", M.workUnit.id);
            if(selected.length) {
                let files = _.pluck(selected, "file");
                ui.addFormDeferred("top", getTableDeferred(M, files, selected, false /* Not editable */));
            }
        }
    });

    // --------------------------------------------------------------

    workflow.implementWorkflowService("ar:prepared_files", function(M) {
        let files = [];
        P.db.filesPrepared.select().where("workUnit", "=", M.workUnit.id).each(function(row) {
            files.push(row.file);
        });
        if(files.length) {
            return files;
        }
    });
});

var can = function(M, user, kind) {
    let spec = FILE_PREPARATION_SPEC[M.workUnit.workType];
    let allow = _.any(spec[kind], function(u) {
        if(_.isEmpty(u)) { return true; }   // An empty object allows all
        let selected = (M.hasAnyRole(user, u.roles) && M.selected(u.selector));
        return (u.action === "deny" ? !selected : selected);
    });
    let deny = _.any(spec[kind], function(u) {
        if(_.isEmpty(u)) { return false; }   // An empty object allows all
        let selected = (M.hasAnyRole(user, u.roles) && M.selected(u.selector));
        return (u.action === "deny" && selected);
    });
    return (allow && !deny);
};

var getTableDeferred = function(M, files, selected, isEditable) {
    if(files.length) {
        let rows = _.map(files, function(file) {
            return {
                file: file,
                name: "selected:"+file.digest,
                selected: _.any(selected, function(s) { return (s.file.digest === file.digest); }),
                isNew: P.db.filesPrepared.select().
                    where("workUnit", "=", M.workUnit.id).
                    where("file", "=", file).
                    where("new", "=", true).count(),
                downloadLink: P.template("file-preparation/download-url").render({
                    workUnit: M.workUnit.id,
                    digest: file.digest
                }),
                audience: O.behaviourRefMaybe(file.tags["audience"] || ""),
                action: O.behaviourRefMaybe(file.tags["action"] || ""),
                comments: file.tags["comments"]
            };
        });
        return P.template("file-preparation/table").deferredRender({
            isEditable: isEditable,
            rows: rows
        });
    }
};

var newlyPreparedForm = P.form("newlyPrepared", "form/file_preparation/newly_prepared.json");
var getChoices = function(type) {
    return _.map(O.query().link(type, A.Type).execute(), function(object) {
        return [object.ref.behaviour, object.title];
    });
};

P.respond("GET", "/do/hres-repo-access-request/file-preparation/edit", [
    {pathElement:0, as:"workUnit"}
], function(E, workUnit) {
    const workflow = P.WORKFLOW_DEFINITION_LOOKUP[workUnit.workType];
    const M = workflow.instance(workUnit);
    if(!can(M, O.currentUser, "upload")) { O.stop("Not permitted."); }

    let selected = P.db.filesPrepared.select().where("workUnit", "=", workUnit.id);
    let previouslyPrepared = _.map(O.ref(workUnit.tags["ref"]).load().every(A.PreparedFile), function(id) {
        return O.file(id);
    });

    let newlyPrepared = _.filter(selected, function(s) { return s.new; });
    let document = {};
    if(newlyPrepared.length) {
        let f = newlyPrepared[0].file;
        document = {
            files: _.pick(newlyPrepared, "file"),
            audience: O.behaviourRefMaybe(f.tags["audience"] || ""),
            action: O.behaviourRefMaybe(f.tags["action"] || ""),
            comments: f.tags["comments"]
        };
    }
    let form = newlyPreparedForm.instance(document);
    form.choices("audiences", getChoices(T.Audience));
    form.choices("actions", getChoices(T.Action));
    form.update(E.request);
    E.render({
        previouslyPreparedMaybe: getTableDeferred(M, previouslyPrepared, selected, true),
        form: form
    }, "file-preparation/edit");

});

P.respond("POST", "/do/hres-repo-access-request/file-preparation/edit", [
    {pathElement:0, as:"workUnit"}
], function(E, workUnit) {
    const workflow = P.WORKFLOW_DEFINITION_LOOKUP[workUnit.workType];
    const M = workflow.instance(workUnit);
    if(!can(M, O.currentUser, "upload")) { O.stop("Not permitted."); }

    P.db.filesPrepared.select().where("workUnit", "=", workUnit.id).deleteAll();

    let document = {};
    let form = newlyPreparedForm.instance(document);
    form.choices("audiences", getChoices(T.Audience));
    form.choices("actions", getChoices(T.Action));
    form.update(E.request);
    // Assumes that the request hasn't been forged. oForms enforces this by checking the 
    // file digests against a secret, so this is safe.
    _.each(document.files, function(f) {
        let file = O.file(f.digest, f.fileSize);
        file.changeTags({
            audience: document.audience,
            action: document.action,
            comments: document.comments
        });
        P.db.filesPrepared.create({
            workUnit: workUnit.id,
            file: file.digest,
            new: true
        }).save();
    });
    
    const selected = _.filter(_.keys(E.request.parameters), function(key) {
        return (-1 !== key.indexOf("selected"));
    });
    _.each(selected, function(key) {
        let digest = key.replace("selected:", "");
        P.db.filesPrepared.create({
            workUnit: workUnit.id,
            file: O.file(digest),
            new: false
        }).save();
    });

    if(!(M.transitions.empty) && M.workUnit.isActionableBy(O.currentUser)) {
        E.response.redirect("/do/workflow/transition/"+M.workUnit.id);
    } else {
        E.response.redirect(M.url);
    }
});

// Allows users reviewing newly prepared files to download them
P.respond("GET", "/do/hres-repo-access-request/file-preparation/file", [
    {pathElement:0, as:"workUnit", allUsers:true},
    {pathElement:1, as:"string"}
], function(E, workUnit, digest) {
    const workflow = P.WORKFLOW_DEFINITION_LOOKUP[workUnit.workType];
    const M = workflow.instance(workUnit);
    if(!can(M, O.currentUser, "view")) { O.stop("Not permitted."); }

    let file = O.file(digest);
    let q = P.db.filesPrepared.select().
        where("workUnit", "=", workUnit.id).
        where("file", "=", file).
        where("new", "=", true);
    // Can only download newly uploaded files on this workflow. Others should be handled with 
    // normal platform permissions
    if(!q.count()) { O.stop("Not permitted."); }
    E.response.setExpiry(86400); // 24 hours
    E.response.body = file;
});