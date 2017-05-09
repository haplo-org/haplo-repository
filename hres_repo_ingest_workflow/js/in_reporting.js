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
