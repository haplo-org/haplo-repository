/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanViewDuplicateDashboards = O.action("hres:repository:action:can_view_duplicate_dashboards").
    title("Can view duplicate repository item dashboards").
    allow("group", Group.RepositoryEditors);


P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(!O.currentUser.allowed(CanViewDuplicateDashboards)) { return; }
    let i = P.locale().text("template");
    builder.panel("hres:repository_menu:data_monitoring").
        link("default", "/do/hres-repo-duplicate-detection/items-with-duplicates", i["Items with duplicates"]);
});

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("duplicateItems",          "text",         "Duplicate items").
        statistic({
            name: "totalWithDuplicates",
            description: "Items with duplicate copies",
            filter(select) {
                select.where("duplicateItems", "!=", null);
            },
            aggregate: "COUNT"
        });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    let duplicates = P.findDuplicates(object);
    if(_.isEmpty(duplicates)) { return; }
    row.duplicateItems = _.keys(duplicates).join(",");
});

// --------------------------------------------------------------------------
// Handlers
// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/hres-repo-duplicate-detection/items-with-duplicates", [
], function(E) {
    CanViewDuplicateDashboards.enforce();
    let dashboard = P.reporting.dashboard(E, {
        kind: "list",
        collection: "repository_items",
        name: "items_with_duplicates",
        title: "Items with duplicates"
    }).
        filter(select => { select.where("duplicateItems", "!=", null); }).
        summaryStatistic(0, "totalWithDuplicates").
        columns(10, [
            {fact:"ref", heading:"Output", link: true},
            {fact:"author", link: true},
            { type:"lookup", fact: "duplicateItems", lookup(value, row) { return value.split(",").length; } }
        ]).
        respond();
});