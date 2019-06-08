/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


if(O.featureImplemented("std:web-publisher")) {
    P.use("std:web-publisher");

    P.webPublication.registerReplaceableTemplate(
        "hres:repo-access-request:ui:sidebar-button",
        "web-publisher/sidebar-button"
    );
    P.webPublication.registerReplaceableTemplate(
        "hres:repo-access-request:page:access-request",
        "web-publisher/access-request"
    );
    P.webPublication.registerReplaceableTemplate(
        "hres:repo-access-request:page:access-request-submitted",
        "web-publisher/access-request-submitted"
    );

/*HaploDoc
title: Public access requests
node: /hres_repo_access_request_components/public
sort: 1
--

Form and database for submission of access requests through the repository public UI.

h3(feature). .use("hres:repository:access_requests:public_submission", spec)

h3(key). spec

The specification object to configure this workflow feature, with keys:

h3(property). path (required)

A unique string to identify the consuming plugin. Used in URLs, and web publisher feature names. eg. @"access-request"@

h3(property). label (required)

The label for links to submit an access request.

h3(property). form (required)

The submission form.

h3(function). canStart(object) (required)

Defines which objects have files that can be requested.

*/
    P.workflow.registerWorkflowFeature("hres:repository:access_requests:public_submission", function(workflow, spec) {
    
        workflow.implementWorkflowService("ar:requestor_details", function(M) {
            if(M.workUnit.tags["audience"] === "external") {
                return M.workflowService("ar:get_request_document");
            }
        });

        workflow.implementWorkflowService("ar:application_deferred_render", function(M, sections) {
            if(M.workUnit.tags["audience"] === "external") {
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

        // ---------------------------------------------------------

        P.webPublication.pagePart({
            name: "hres:repository:output:"+spec.path,
            category: "hres:repository:output:sidebar",
            sort: 355,
            deferredRender: function(E, context, options) {
                if(context.object && spec.canStart(context.object)) {
                    var template = context.publication.getReplaceableTemplate("hres:repo-access-request:ui:sidebar-button");
                    return template.deferredRender({
                        title: spec.label,
                        href: "/plugin/"+spec.path+"/"+context.object.ref
                    });
                }
            }
        });

        P.webPublication.feature("hres:repository:ar:"+spec.path, function(publication, specification) {

            if(!(specification && ("useFileMediatedAccess" in specification))) {
                throw new Error("Must specify file release mechanism in "+spec.path+" feature.");
            }
            if(specification.useFileMediatedAccess) {
                publication.use("hres:file_mediated_access");
            }

            workflow.implementWorkflowService("ar:publication_hostname_for_instance", function(M) {
                if(M.workUnit.tags["_publication"] === publication.name) {
                    return publication.urlHostname;
                }
            });

            publication.respondToDirectory("/plugin/"+spec.path+"/submitted",
                function(E, context) {
                    E.setResponsiblePlugin(P);
                    var object = O.ref(E.request.extraPathElements[0]).load();
                    E.render({
                        title: spec.label,
                        object: object,
                        button: {href:context.publishedObjectUrlPath(object)}
                    }, context.publication.getReplaceableTemplate("hres:repo-access-request:page:access-request-submitted"));
                }
            );

            // Don't want this UI to be indexed
            publication.addRobotsTxtDisallow("/plugin/"+spec.path+"/");

            publication.respondToDirectoryAllowingPOST("/plugin/"+spec.path+"",
                function(E, context) {
                    E.setResponsiblePlugin(P);
                    var document = {};
                    var form = spec.form.handle(document, E.request);
                    if(form.complete) {
                        var ref = O.ref(E.request.extraPathElements[0]);
                        var M = workflow.create({ref: ref});
                        M.workUnit.tags["audience"] = "external";
                        M.workUnit.tags["_publication"] = publication.name;
                        M.workUnit.save();
                        document.name = document.nameFirst+" "+document.nameLast;
                        M.workflowService("ar:save_request_document", document);
                        E.response.redirect("/plugin/"+spec.path+"/submitted/"+ref);
                    }
                    E.render({
                        title: spec.label,
                        object: O.ref(E.request.extraPathElements[0]).load(),
                        form: form
                    }, context.publication.getReplaceableTemplate("hres:repo-access-request:page:access-request"));
                }
            );

        });

    });

}
