/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// var LIVE_ENDPOINT = "https://jusp.jisc.ac.uk/counter/";
// var TEST_ENDPOINT = "http://jusp.jisc.ac.uk/counter/test/";

P.implementService("haplo_usage_tracking:notify:event", function(event) {
    if(!(event.object && event.file)) { return; }
    let object = O.withoutPermissionEnforcement(() => { return event.object.load(); });
    let file = O.file(event.file);

    let fileUrl, repositoryId, oaiIdentifier;
    if(event.publication) {
        let publication = O.service("std:web_publisher:get_publication", event.publication);
        fileUrl = publication.urlForFileDownload(file);
        repositoryId = publication.urlHostname;
        oaiIdentifier = publication.oaiIdentifierForObject(object);
    } else {
        // TODO: If we're setting a responsible publication for the OAI identifier, should we also do
        // so for the url and repositoryId?
        fileUrl = file.url({asFullUrl: true});
        repositoryId = O.application.hostname;
        let responsiblePublication = O.application.config["hres_repo_irus_uk:responsible_publication"];
        if(!responsiblePublication) { throw new Error("No responsible publication set for IRUS-UK usage tracking"); }
        let publication = O.service("std:web_publisher:get_publication", responsiblePublication);
        oaiIdentifier = publication.oaiIdentifierForObject(object);
    }

    if(O.application.hostname === O.application.config["hres_repo_irus_uk:enabled_application"]) {
        let client = O.httpClient("https://jusp.jisc.ac.uk/counter/").
            queryParameter("url_ver", "Z39.88-2004").
            queryParameter("url_tim", new XDate(event.datetime).toISOString()).
            queryParameter("req_id", event.remoteAddress).
            queryParameter("req_dat", event.userAgent).
            queryParameter("rft.artnum", oaiIdentifier).
            queryParameter("svc_dat", fileUrl).
            queryParameter("rfr_dat", event.referrer).
            queryParameter("rfr_id", repositoryId).
            request(IRUSResponse, {
                event: event.id,
                object: event.object.toString(),
                oaiIdentifier: oaiIdentifier,
                file: event.file
            });
    }
});

var IRUSResponse = P.callback("irus", function(data, client, response) {
    if(response.successful) {
        console.log("IRUS-UK tracking request successful");
    } else {
        console.log("Error: IRUS-UK tracking request failed");
        console.log("Response code:", response.status);
        console.log("Error message:", response.errorMessage);
        console.log("Data sent:", data);
        console.log("Response body:", response.body ? response.body.readAsString("UTF-8") : "No body returned");
    }
});
