/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanViewRepositoryDashboards = O.action("hres:action:repository:view-overview-dashboards");

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(CanViewRepositoryDashboards)) {
        builder.panel(500).link(100, "/do/hres-repo-ingest-workflow/progress", "Ingest workflow progress");
    }
});

P.implementService("std:action_panel:activity:statistics:repository", function(display, builder) {
    if(O.currentUser.allowed(CanViewRepositoryDashboards)) {
        P.reporting.statisticsPanelBuilder(builder, "repository_items").
            statistic(1000, "/do/hres-repo-ingest-workflow/progress", "countWithEditor", "items with editor").
            statistic(1000, "/do/hres-repo-ingest-workflow/progress", "countWithResearcher", "items with researcher").
            statistic(1000, "/do/hres-repo-ingest-workflow/progress", "countOnHold", "items on hold");
    }
});

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("ingestState", "text",     "Ingest state");

    collection.statistic({
        name: "countWithEditor", description: "Outputs waiting for editor action",
        filter: function(select) { select.where("ingestState","=","wait_editor"); },
        aggregate: "COUNT"
    });
    collection.statistic({
        name: "countWithResearcher", description: "Outputs waiting for researcher action",
        filter: function(select) { select.where("ingestState","=","returned_author"); },
        aggregate: "COUNT"
    });
    collection.statistic({
        name: "countOnHold", description: "Outputs on hold",
        filter: function(select) { select.where("ingestState","=","on_hold"); },
        aggregate: "COUNT"
    });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    var M = O.service("std:workflow:for_ref","hres_repo_ingest_workflow:in", object.ref);
    if(M) {
        row.ingestState = M.state;
    }
});

P.Ingest.use("std:dashboard:states", {
    title: "Ingest workflow progress",
    path: "/do/hres-repo-ingest-workflow/progress",
    canViewDashboard: function(dashboard, user) {
        return O.currentUser.allowed(CanViewRepositoryDashboards);
    },
    states: [
        "wait_editor",
        "on_hold",
        "returned_author"
    ]
});
