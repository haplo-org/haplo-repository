/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// NOTE: Called 'Outputs' in the UI, even if they're not strictly speaking outputs, as this is a recognisable term
P.implementService("std:action_panel:category:hres:person", function(display, builder) {
    builder.panel(1600).link("default", "/do/repository/outputs/"+display.object.ref, "Research outputs");
});

P.implementService("std:action_panel:home_page_my_links", function(display, builder) {
    var ref = O.currentUser.ref;
    if(ref) {
        builder.link("default", "/do/repository/outputs/"+ref, "My research outputs");
    }
});

P.respond("GET", "/do/repository/outputs", [
    {pathElement:0, as:"object"}
], function(E, researcher) {
    O.service("haplo:information_page:overview", {
        buildService: "hres_repo_navigation:repository_item_page",
        pageTitle: "Research outputs",
        object: researcher
    }).
        keyObject(0, researcher).
        section(100, P.template("outputs").deferredRender({
            query: "type:repository item #L"+researcher.ref+"#",
            sort: "date",
            showResultCount: true,
            showSearchWithinLink: true
        })).
        respond(E);
});
