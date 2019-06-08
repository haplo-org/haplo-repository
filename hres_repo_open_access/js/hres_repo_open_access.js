/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(CanViewOADashboards)) {
        builder.panel(600).title("Open Access").
            link(200, "/do/hres-repo-open-access/repository-items/all", "Open access by year").
            link(300, "/do/hres-repo-open-access/research-institutes/"+T.Faculty, "Open access by "+NAME("Faculty"));

        var departments = O.query().link(T.Department, A.Type).execute();
        if(departments.length !== 0){
            builder.panel(600).
                link(400, "/do/hres-repo-open-access/research-institutes/"+T.Department, "Open access by "+NAME("Department"));
        }
    }
});

P.implementService("std:action_panel:activity:statistics:repository", function(display, builder) {
    if(O.currentUser.allowed(CanViewOADashboards)) {
        P.reporting.statisticsPanelBuilder(builder, "repository_items").
            statistic(1000, "/do/hres-repo-open-access/repository-items/all", "countOA", "Open access items");
    }
});
    
var CanViewOADashboards = P.CanViewOADashboards = O.action("hres_repo_open_access:view_dashboards").
    title("View Open Access Dashboards").
    allow("group", Group.RepositoryEditors).
    allow("role", "Head");

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("oaIsGoldOA",      "boolean",     "Gold OA").
        // Determined in other plugins, with an implicit dependency on services being implemented in the application
        fact("oaIsGreenOA",     "boolean",     "Green OA").
        fact("oaIsNotOA",       "boolean",     "Not OA").
        // For filtering. Easier to calculate in JS than SQL
        fact("oaIsConfItemOrArticle", "boolean", "Is Journal Article or Conference Item").
        filter("oaIsConfItemOrArticle", function(select) {
            select.where("oaIsConfItemOrArticle", "=", true);
        }).
        statistic({
            name: "countGoldOA", description: "Gold OA",
            filter(select) {
                select.where("oaIsGoldOA", "=", true);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name:"countOA",
            description:"Open access items",
            filter: function(select) {
                select.or(function(sq) {
                    sq.where("oaIsGoldOA","=",true).
                        where("oaIsGreenOA","=",true);
                });
            },
            aggregate:"COUNT"
        });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    if(object.first(A.OpenAccess)) {
        var behaviour = object.first(A.OpenAccess).behaviour;
        row.oaIsGoldOA = (behaviour === "hres:list:open-access:gold");
    }
    row.oaIsGreenOA = O.service("hres:repository:open_access:is_green_oa", object);
    row.oaIsNotOA = O.service("hres:repository:open_access:is_not_oa", object);
    row.oaIsConfItemOrArticle = object.isKindOf(T.JournalArticle) || object.isKindOf(T.ConferenceItem);
});

// --------- Dashboards -----------------------------

P.implementService("std:reporting:dashboard:repository_overview:setup_export", function(dashboard) {
    dashboard.columns(180, ["oaIsGoldOA"]);
});
P.implementService("std:reporting:dashboard:outputs_in_progress:setup_export", function(dashboard) {
    dashboard.columns(180, ["oaIsGoldOA"]);
});

var REPOSITORY_ITEM_LOOKUP = {
    "green": { title: "Green", fact: "oaIsGreenOA" },
    "gold": { title: "Gold", fact: "oaIsGoldOA" },
    "not-oa": { title: "Not Open Access", fact: "oaIsNotOA" },
    "all": { title: "Overview" } 
};

P.respond("GET,POST", "/do/hres-repo-open-access/repository-items", [
    {pathElement:0, as:"string"},
    {parameter:"year", as:"int", optional:true}
], function(E, oaType, year) {
    CanViewOADashboards.enforce();
    // define further filtering with pathElements. 
    //  0: A string identifying the providing implementation. Providing plugins must check this before
    //      adding their filter to the details object
    //  1: A ref for the providing implementation to filter against
    var pe = E.request.extraPathElements;
    var details = _.clone(REPOSITORY_ITEM_LOOKUP[oaType] || O.serviceMaybe("hres_repo_open_access:additional_oatype_details", oaType));
    if(pe.length) {
        O.serviceMaybe("hres_repo_open_access:custom_dashboard_filtering", details, pe.slice(1));
    }
    var dashboard = P.reporting.dashboard(E, {
        kind: "list",
        collection: "repository_items",
        name: (oaType === "all") ? "oa_repository_items_all" : "oa_repository_items",
        title: "Open Access Items: "+details.title,
        filter: "oaIsConfItemOrArticle"
    }).
        use("hres:schema:calendar_year_navigation", year, "year").
        filter(function(select) {
            if(details.fact) {
                select.where(details.fact, "=", true);
            }
            // Set by "hres_repo_open_access:custom_dashboard_filtering"
            if(details.filter) {
                details.filter(select);
            }
        }).
        columns(0, [{fact:"ref", heading:"Output", link:true}]).
        columns(100, [
            {fact: "author", link:true},
            "type",
            {fact: "publisher", link:true}
        ]);
    if(oaType === "all") {
        dashboard.columns(150, [
            "oaIsGreenOA",
            "oaIsGoldOA",
            "oaIsNotOA"
        ]);
    }
    dashboard.respond();
});
