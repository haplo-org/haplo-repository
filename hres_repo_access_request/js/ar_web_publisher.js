/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


if(O.featureImplemented("std:web-publisher")) {
    P.use("std:web-publisher");

    var publicRequestForm = P.publicRequestForm = P.form("requestAccess", "form/public_access_request.json");

    P.implementService("hres:repository:web_publisher:access_request_start_url", function(object) {
        return "/plugin/access-request/"+object.ref;
    });

    P.webPublication.feature("hres:repository:access-request", function(publication) {

        publication.respondToDirectory("/plugin/access-request/submitted",
            function(E, context) {
                E.setResponsiblePlugin(P);
                var object = O.ref(E.request.extraPathElements[0]).load();
                E.render({
                    object: object,
                    backLink: context.publishedObjectUrlPath(object)
                }, "web-publisher/access-request-submitted");
            }
        );

        publication.respondToDirectoryAllowingPOST("/plugin/access-request",
            function(E, context) {
                E.setResponsiblePlugin(P);
                var document = {};
                var form = publicRequestForm.handle(document, E.request);
                if(form.complete) {
                    var ref = O.ref(E.request.extraPathElements[0]);
                    var M = P.AccessRequest.create({ref: ref});
                    M.workUnit.data = {
                        isPublicRequest: true
                    };
                    M.workUnit.save();
                    document.name = document.nameFirst+" "+document.nameLast;
                    P.db.requestDocuments.create({
                        workUnit: M.workUnit.id,
                        document: JSON.stringify(document)
                    }).save();
                    E.response.redirect("/plugin/access-request/submitted/"+ref);
                }
                E.render({
                    ref: O.ref(E.request.extraPathElements[0]),
                    form: form
                }, "web-publisher/access-request");
            }
        );

    });

}
