/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Implements the web publisher feature "hres:oai-pmh:server" to add an OAI-PMH server
// to a fixed endpoint in the publication.
//
// A "hres:oai-pmh:declare-support" page part is implemented to render standard text
// to tell users about the support.

const WEB_PUBLICATION_ENDPOINT = '/oai2';

const DEFAULT_REPO_ATTRIBUTES = {
    repositoryName: "Haplo Research Manager: Repository",
    earliestDatestamp: "1900-01-01T00:00:00Z"
};

if(O.featureImplemented("std:web-publisher")) {
    P.use("std:web-publisher");

    var responders = {};

    // ----------------------------------------------------------------------

    P.webPublication.feature("hres:oai-pmh:server", function(publication, spec) {

        // Default to reasonable generation of identifiers
        var refToOAIIdentifier = spec.refToOAIIdentifier;
        if(!refToOAIIdentifier) {
            var identifierBase = "oai:"+publication.urlHostname+":";
            refToOAIIdentifier = (ref) => identifierBase+ref;
        }

        // TODO: Consider more carefully if this is the right way of doing this
        // Expose OAI identifier for this publication to other plugins
        publication.oaiIdentifierForObject = function(object) {
            return refToOAIIdentifier(object.ref);
        };

        publication.respondToExactPath(WEB_PUBLICATION_ENDPOINT,
            function(E, context) {
                var responder = responders[publication.urlHostname];
                if(!responder) {
                    // Set attributes, with reasonable defaults, but base URL forced
                    var attributes = _.extend({
                        adminEmail: "repository@"+publication.urlHostname
                    }, DEFAULT_REPO_ATTRIBUTES, spec.attributes || {});
                    attributes.baseURL = "https://"+publication.urlHostname+WEB_PUBLICATION_ENDPOINT;
                    // Create a responder
                    responder = responders[publication.urlHostname] = O.service("hres:oai-pmh:create-responder", {
                        refToOAIIdentifier: refToOAIIdentifier,
                        objectToURL(object) {
                            return publication.urlForObject(object);
                        },
                        fileToURL(file) {
                            return publication.urlForFileDownload(file);
                        },
                        attributes: attributes
                    });
                }
                responder.respond(E);
            }
        );

    });

    // ----------------------------------------------------------------------

    P.webPublication.pagePart({
        name: "hres:oai-pmh:declare-support",
        sort: 2000,
        deferredRender: function(E, context, options) {
            return P.template("publisher/declare-support").deferredRender({
                context: context,
                endpoint: WEB_PUBLICATION_ENDPOINT
            });
        }
    });

}
