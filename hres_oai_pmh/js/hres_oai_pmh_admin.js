/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.hook('hObjectDisplay', function(response, object) {
    if(O.currentUser.isSuperUser && O.service("hres:repository:is_repository_item", object)) {
        response.buttons["*OAIPMH"] = [
            ["/do/hres-oai-pmh/admin/list-metadata-formats/"+object.ref, "OAI-PMH XML"]
        ];
    }
});

P.respond("GET", "/do/hres-oai-pmh/admin/list-metadata-formats", [
    {pathElement:0, as:"object"}
], function(E, object) {
    if(!O.currentUser.isSuperUser) { O.stop("Not permitted."); }
    let options = [];
    P.metadataServices().eachService((metadataService) => {
        let schema = metadataService.metadata["hres:oai-pmh:metadata-prefix"];
        options.push({
            action: "/do/hres-oai-pmh/admin/view?verb=GetRecord&metadataPrefix="+schema+"&identifier=xxxx:"+object.ref,
            label: schema
        });
    });
    E.render({
        pageTitle: "View OAI-PMH response for this item",
        backLink: object.url(),
        options: options
    }, "std:ui:choose");
});

var responder;

P.respond("GET", "/do/hres-oai-pmh/admin/view", [
    {parameter:"verb", as:"string", optional:true}
], function(E, verb) {
    if(!O.currentUser.isSuperUser) { O.stop("Not permitted."); }
    if(!responder) {
        responder = O.service("hres:oai-pmh:create-responder", {
            // Sufficient for adminstrative purposes - will not match the identifier in the 
            // public /oai2 interface
            refToOAIIdentifier(ref) {
                return "xxxx:"+ref;
            },
            objectToURL(object) {
                return object.url(true);
            },
            fileToURL(file) {
                return "https://"+O.application.hostname+"/xxxxx/"+file.digest;
            }
        });
    }
    // Note: Will return a superset of data to that in the pulic /oai2 interface, since we are 
    // not impersonating the public web interface service user here
    responder.respond(E);
});
