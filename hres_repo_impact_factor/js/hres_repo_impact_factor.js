/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanViewRepositoryDashboards = O.action("hres:action:repository:view-overview-dashboards");

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(CanViewRepositoryDashboards)) {
        builder.panel(500).
            link(299, "/do/hres-repo-impact-factor/output-impact-factors-all-years", "Output impact factors (all years)").
            link(300, "/do/hres-repo-impact-factor/output-impact-factors", "Output impact factors");
    }
});

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("impactFactor",                "numeric",  "Impact factor");

    collection.statistic({
        name: "countAboveFive", description: "Outputs with impact factor >5",
        filter: function(select) { select.where("impactFactor", ">", O.bigDecimal(5)); },
        aggregate: "COUNT"
    });
    collection.statistic({
        name: "countAboveNine", description: "Outputs with impact factor >9",
        filter: function(select) { select.where("impactFactor", ">", O.bigDecimal(9)); },
        aggregate: "COUNT"
    });
    collection.statistic({
        name: "countAboveThirty", description: "Outputs with impact factor >30",
        filter: function(select) { select.where("impactFactor", ">", O.bigDecimal(30)); },
        aggregate: "COUNT"
    });
    collection.statistic({
        name: "averageImpactFactor", description: "Average impact factor",
        fact: "impactFactor", formatter: function(value) {
            if(!value) {
                return "0";
            } 
            return value.format("#,##0.##");
        },
        aggregate: "AVG"
    });

});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    var journal = object.first(A.Journal);
    if(journal && O.isRef(journal)) {
        var impactFactor = journal.load().first(A.ImpactFactor);
        if(impactFactor && impactFactor.toString().match(/^\d+(\.\d+)?$/)) { //don't save if impact factor is not a number
            row.impactFactor = O.bigDecimal(impactFactor.toString());
        }
    }
});

var outputImpactFactorsDashboard = function(E, title) {
    var dashboard = P.reporting.dashboard(E, {
        kind: "list",
        collection: "repository_items",
        name: "output_impact_factors",
        title: title
    }).
        summaryStatistic(0, "count").
        summaryStatistic(5, "countAboveFive").
        summaryStatistic(10, "countAboveNine").
        summaryStatistic(15, "countAboveThirty").
        summaryStatistic(30, "averageImpactFactor").
        use("std:row_object_filter", {fact:"faculty", objects:T.Faculty}).
        columns(1, [
            {fact:"ref", heading:"Output", link:true}
        ]).
        columns(100, [
            "author",
            "faculty",
            "journal",
            "publisher",
            {fact: "impactFactor", formatter:"#,##0.##"}
        ]).
        order(["impactFactor", true]);
    return dashboard;
};

P.respond("GET,POST", "/do/hres-repo-impact-factor/output-impact-factors", [
    {parameter:"year", as:"int", optional:true}
], function(E, year) {
    CanViewRepositoryDashboards.enforce();
    var dashboard = outputImpactFactorsDashboard(E, "Output impact factors");
    dashboard.use("hres:schema:calendar_year_navigation", year, "year").
        respond();
});

P.respond("GET,POST", "/do/hres-repo-impact-factor/output-impact-factors-all-years", [
    {parameter:"year", as:"int", optional:true}
], function(E, year) {
    CanViewRepositoryDashboards.enforce();
    var dashboard = outputImpactFactorsDashboard(E, "Output impact factors for all years");
    dashboard.respond();
});