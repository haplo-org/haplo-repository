/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("emEnd",           "date",         "End").
        fact("emLength",        "text",         "Length").
        fact("emUnderEmbargo",  "boolean",      "Under embargo").
        fact("emHasEmbargo",    "boolean",      "Has embargo data").
        
        statistic({
            name:"emHasEmbargoCount",
            description:"Items with embargos",
            filter: function(select) {
                select.where("emHasEmbargo", "=", true);
            },
            aggregate:"COUNT"
        }).
        
        filter("emHasEmbargo", function(select) {
            select.where("emHasEmbargo", "=", true);
        });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    var data = P.getEmbargoData(object);
    row.emHasEmbargo = !!data;
    if(data) {
        row.emEnd = data.getEndDate() || null;
        row.emLength = data.embargoLength ? data.embargoLength+" months" : "Indefinite";
        row.emUnderEmbargo = data.isUnderEmbargo();
    }
});

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(P.CanEditEmbargoes)) {
        var panel = builder.panel(500).
            link(600, "/do/hres-repo-embargoes/embargo-overview", "Embargo overview");
    }
});

P.respond("GET,POST", "/do/hres-repo-embargoes/embargo-overview", [
], function(E) {
    P.CanEditEmbargoes.enforce();
    P.reporting.dashboard(E, {
        kind:"list",
        collection:"repository_items",
        name:"embargo_overview",
        title:"Embargo overview",
        filter:"emHasEmbargo"
    }).
        summaryStatistic(0, "emHasEmbargoCount").
        order(["emEnd", "descending"]).
        columns(1, [
            {fact:"ref", heading:"Item", link:true}
        ]).
        columns(200, [
            "emLength",
            "emEnd",
            "emUnderEmbargo"
        ]).
        respond();
});
