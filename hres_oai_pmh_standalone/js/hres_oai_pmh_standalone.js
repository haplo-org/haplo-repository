/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Provides an OAI-PMH endpoint at /api/oai2

// TODO: Standalone OAI-PMH responder needs to provide sensible objectToURL() and fileToURL() functions

var SERVICE_USER_CODE = "hres:service-user:oai-pmh";

// --------------------------------------------------------------------------
// Default configuration, overridden in application configuration data
// (System Management -> Configuration -> Configuration data)

// oai:repository_attributes -- dictionary, overrides the defaults here
var REPO_ATTRS = _.extend({
    repositoryName: "Haplo Research Manager: Repository",
    baseURL: O.application.url+"/api/oai2",
    adminEmail: "repository@"+O.application.hostname,
    earliestDatestamp: "1900-01-01T00:00:00Z"
}, O.application.config["oai:repository_attributes"] || {});

// oai:identifier_base -- prefix for identifiers, ref appended. Must end with ':'
var IDENTIFIER_BASE = O.application.config["oai:identifier_base"] || "oai:"+O.application.hostname+":";

// --------------------------------------------------------------------------

var responder;

P.respond("GET,POST", "/api/oai2", [
    {parameter:"verb", as:"string", optional:true}
], function(E, verb) {
    if(!responder) {
        responder = O.service("hres:oai-pmh:create-responder", {
            refToOAIIdentifier: (ref) => IDENTIFIER_BASE+ref,
            attributes: REPO_ATTRS
        });
    }
    O.impersonating(O.serviceUser(SERVICE_USER_CODE), function() {
        responder.respond(E);
    });
});
