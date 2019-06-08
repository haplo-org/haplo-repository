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

/*HaploDoc
node: /repository/hres_oai_pmh/implementation
title: Implementation
sort: 1
--

h2. Web Publication Feature

The OAI-PMH interface is added to a publications using the web publication feature @hres:oai-pmh:server@, \
which will provide an OAI-PMH endpoint at @HOSTNAME/oai2@.

This is configured with a specification object, with keys:

h3(function). refToOAIIdentifier

Optional. Each record exposed through OAI PMH must have an identifier. The default implementation for this is \
@"oai:"+publication.urlHostname+":"+ref@, but can be configured by setting a function at this key in the spec.

h3(key). attributes

Optional. A JavaScript object of metadata attributes about the repository itself. All entries in this \
object are optional, overriding the default value.

|*key*|*default value*|
|@adminEmail@| "repository@HOSTNAME"|
|@repositoryName@| "Haplo Research Manager: Repository"|
|@earliestDateStamp@| "1900-01-01T00:00:00Z"|


h2. Page Part

A "hres:oai-pmh:declare-support" page part is implemented to render standard text to tell users about the \
OAI-PMH support. Should be rendered on the homepage of the repository publication.
*/
    P.webPublication.feature("hres:oai-pmh:server", function(publication, spec) {

        let endpoint = (spec.pathPrefix || '') + WEB_PUBLICATION_ENDPOINT;
        publication.$oaipmhServerEndpoint = endpoint;

        // Default to reasonable generation of identifiers
        let refToOAIIdentifier = spec.refToOAIIdentifier;
        if(!refToOAIIdentifier) {
            let identifierBase = "oai:"+publication.urlHostname+":";
            refToOAIIdentifier = (ref) => identifierBase+ref;
        }

        // Expose OAI identifier for this publication to other plugins
        publication.oaiIdentifierForObject = function(object) {
            return refToOAIIdentifier(object.ref);
        };

        publication.respondToExactPath(endpoint,
            function(E, context) {
                let responder = responders[publication.urlHostname];
                if(!responder) {
                    // Set attributes, with reasonable defaults, but base URL forced
                    let attributes = _.extend({
                        adminEmail: "repository@"+publication.urlHostname
                    }, DEFAULT_REPO_ATTRIBUTES, spec.attributes || {});
                    attributes.baseURL = "https://"+publication.urlHostname+endpoint;
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
                endpoint: context.publication.$oaipmhServerEndpoint
            });
        }
    });

}
