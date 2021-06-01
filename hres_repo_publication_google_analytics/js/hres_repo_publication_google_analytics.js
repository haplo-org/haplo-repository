/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

let googleTrackingID = O.application.config["hres:repository:google-tracking-id"] || "";

/*HaploDoc
node: repository/hres_repo_publication_google_analytics
title: Google analytics
sort: 1
--
h3(feature). "hres:repository:google-analytics"

Web publisher feature to create the google analytics page part to go on every page for tracking, only runs on enabled application.

Requires "hres:repository:google-tracking-id" be set in the config data to the client's tracking id (also called "Measurement ID") \
and "hres_repo_publication_google_analytics:enabled_application" to be set to the internal hostname of the live application.
*/
P.webPublication.feature("hres:repository:google-analytics", (publication, spec) => {
    //If live application
    if(O.application.hostname === O.application.config["hres_repo_publication_google_analytics:enabled_application"]) {
        // HSVT UnsafeScriptTag only takes src arguments, need to write the html in here and pass through
        let trackingTag = "<!-- Global site tag (gtag.js) - Google Analytics -->"+
            "<script async src=\"https://www.googletagmanager.com/gtag/js?id="+googleTrackingID+"\"></script>"+
            "<script>"+
                "window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '"+googleTrackingID+"');"+
            "</script>";

        P.webPublication.pagePart({
            name: "hres:repository:google-analytics:tag",
            category: "hres:repository:misc:footers",
            deferredRender: function(E, context, options) {
                return P.template("google-analytics-tag").deferredRender({unsafeGATag:trackingTag});
            }
        });
    }
});
