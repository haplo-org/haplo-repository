/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


if(O.featureImplemented("std:web-publisher")) {
    P.use("std:web-publisher");

    P.webPublication.registerReplaceableTemplate(
        "hres:repo-export-formats:page-part:export",
        "web-publisher/export"
    );
    P.webPublication.registerReplaceableTemplate(
        "hres:repo-export-formats:page-part:export-multiple",
        "web-publisher/export-multiple"
    );

    P.webPublication.pagePart({
        name: "hres:repository:output:export-formats",
        category: "hres:repository:output:sidebar",
        sort: 2800,
        deferredRender(E, context, options) {
            if(context.object) {
                // find all the services
                let choices = [];
                P.metadataServices().eachService((s) => {
                    choices.push({ format: s.metadata["hres:repository:export-format"] });
                });
                let template = context.publication.getReplaceableTemplate("hres:repo-export-formats:page-part:export");
                // Needs to be in a feature to have the respond path for download
                return template.deferredRender({
                    object: context.object,
                    choices: choices
                });
            }
        }
    });


    P.webPublication.pagePart({
        name: "hres:repository:output:export-formats",
        category: "hres:repository:search-results:sidebar",
        sort: 2800,
        deferredRender(E, context, options) {
            let choices = [];
            P.metadataServices().eachService((s) => {
                choices.push({ format: s.metadata["hres:repository:export-format"] });
            });
            let template = context.publication.getReplaceableTemplate("hres:repo-export-formats:page-part:export-multiple");
            // Needs to be in a feature to have the respond path for download
            return template.deferredRender({
                objects: context.object,
                choices: choices
            });
        }
    });

    P.webPublication.feature("hres:repository:export-formats", function(publication) {

        publication.respondToDirectory("/plugin/export-format/export",
            function(E, context) {
                let object = O.ref(E.request.extraPathElements[0]).load();
                let format = E.request.parameters["format"];
                let service = P.metadataServiceForScheme(format);
                E.response.body = O.service(service.name, object);
            }
        );

        publication.respondToExactPath("/plugin/export-format/export-multiple",
            function(E, context) {
                let params = E.request.parameters;
                let format = params.format;
                let service = P.metadataServiceForScheme(format);
                let objects = [];
                _.each(params, (val, key) => {
                    if(val === "on") {
                        objects.push(O.ref(key).load());
                    }
                });
                E.response.body = O.service(service.name+"-multiple", objects);
            }
        );

    });

}
