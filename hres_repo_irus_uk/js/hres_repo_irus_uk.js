/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var LIVE_ENDPOINT = O.application.config["hres_repo_irus_uk:counter_endpoint"] || "https://irus.jisc.ac.uk/counter/";
// var TEST_ENDPOINT = "https://irus.jisc.ac.uk/counter/test/";

// Constants - matching KIND_ENUM saved in haplo_usage_tracking
var VIEW_EVENT = 0;
var DOWNLOAD_EVENT = 1;

P.implementService("haplo_usage_tracking:notify:event", function(event) {
    if(!event.publication) { return; }  // IRUS only interested in public views and downloads
    if(!event.object) { return; } 
    let publication = O.service("std:web_publisher:get_publication", event.publication);
    let object = O.withoutPermissionEnforcement(() => { return event.object.load(); });
    if(!O.service("hres:repository:is_repository_item", object)) { return; }    // Only send them notifications for outputs
    let oaiIdentifier = publication.oaiIdentifierForObject(object);
    let svcDat;
    if(event.kind === DOWNLOAD_EVENT) {
        svcDat = publication.urlForFileDownload(O.file(event.file));
    } else if(event.kind === VIEW_EVENT) {
        svcDat = publication.urlForObject(object);
    } else {
        throw new Error("Unknown usage event kind.");
    }

    if(O.application.hostname === O.application.config["hres_repo_irus_uk:enabled_application"]) {
        let client = O.httpClient(LIVE_ENDPOINT).
            queryParameter("url_ver", "Z39.88-2004").
            queryParameter("url_tim", new XDate(event.datetime).toISOString()).
            queryParameter("req_id", event.remoteAddress).
            queryParameter("req_dat", event.userAgent).
            queryParameter("rft.artnum", oaiIdentifier).
            queryParameter("svc_dat", svcDat).
            queryParameter("rfr_dat", event.referrer).
            queryParameter("rfr_id", publication.urlHostname).
            queryParameter("rft_dat", (event.kind === VIEW_EVENT) ? "Investigation" : "Request").
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

//------------------------------------------------------------------------
P.webPublication.registerReplaceableTemplate(
    "hres:repository:irus:show-widget",
    "irus-widget"
);

P.webPublication.registerReplaceableTemplate(
    "hres:repository:irus:widget-banner",
    "widget-banner"
);

P.webPublication.feature("hres:repository:irus:widget", function(publication, spec) {
    publication.respondToExactPath("/external-statistics/irus-uk", function(E, context) {
        var template = publication.getReplaceableTemplate("hres:repository:irus:show-widget");
        var RID = O.application.config["hres_repo_irus_uk:repository_id"];
        var params = O.serviceMaybe("hres:repository:irus:widget:get-parameters");
        if(params) { RID += "&" + params; }
        E.render({
            unsafeScript: "<script id=\"irus-api-script\" src=\"https://irus.jisc.ac.uk/js/irus_pr_widget.js?RID="+RID+"\"></script>"
        }, template);
    });


    P.webPublication.pagePart({
        name: "hres:repository:irus-widget:banner",
        category: "hres:repository:home:extra-body",
        sort: 10,
        deferredRender: function(E, context, options) {
            var template = publication.getReplaceableTemplate("hres:repository:irus:widget-banner");
            return template.deferredRender({
                href: "/external-statistics/irus-uk"
            });
        }
    });
});