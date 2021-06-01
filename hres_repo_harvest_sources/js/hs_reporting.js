/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanManageHarvestedItems = P.CanManageHarvestedItems = O.action("hres_repo_harvest_claim:manage_harvested_items").
    title("Can manage harvested items").
    allow("group", Group.RepositoryEditors);

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(P.CanManageHarvestedItems)) {
        builder.panel(670).
            title("Items harvested from other sources").
            link(20, "/do/hres-repo-harvest-sources/all-harvested-items", "All items harvested from other sources").
            link(100, "/do/hres-repo-harvest-sources/all-unclaimed-items", "Unclaimed items from other sources");
    }
});

// --------------------------------------------------------------------------
// Utility functions
// --------------------------------------------------------------------------

var getRowsFromTable = function(source) {
    let dbRows = P.db.sourceObjects.select();
    if(source) { dbRows.where("source", "=", source); }
    // Hide deleted objects like std_reporting
    dbRows = _.filter(dbRows, (row) => !row.ref.load().deleted);
    return _.map(dbRows, (row) => {
        let object = row.ref.load();
        let closedWu = O.work.query("hres_repo_harvest_claim:claim_item").
            ref(object.ref).
            isClosed().
            latest();
        let reportRow = {
            object: object,
            primaryAuthor: object.first(A.Author),
            objectType: object.firstType(),
            authoritativeVersion: object.first(A.AuthoritativeVersion),
            source: row.source,
            subSource: row.subSource,
            // Source objects can only be edited by the harvest framework
            harvestDate: object.lastModificationDate,
            harvestDateSort: object.lastModificationDate.getTime(),
            claimed: closedWu ? !closedWu.tags.disclaimed : false,
            disclaimed: closedWu ? !!closedWu.tags.disclaimed : false
        };
        O.serviceMaybe("hres:repository:harvest_sources:alter_reporting_row", reportRow);
        return reportRow;
    });
};

P.globalTemplateFunction("hres_repo_harvest_sources:source_to_name", function(source, subSource) {
    let i = P.locale().text("template");
    source = i[P.sourceName(source)];
    subSource = subSource ? " : " + i[subSource] : "";
    return source + subSource;
});

var createReportingNavigation = function(selectedSource) {
    if(!selectedSource) { selectedSource = "all"; }
    let i = P.locale().text("template");
    let sources = P.sourceNames();
    let multipleSources = _.size(sources) > 1;
    if(multipleSources) { sources = _.extend({all: "All"}, sources); }
    return {
        tabs: _.map(sources, (name, source) => {
            return {
                selected: selectedSource === source,
                href: "?source="+source,
                label: i[name]
            };
        }),
        multipleSources: multipleSources
    };
};

// --------------------------------------------------------------------------
// Dashboards
// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/hres-repo-harvest-sources/all-harvested-items", [
    {parameter: "source", as: "string", optional: true}
], function(E, source) {
    CanManageHarvestedItems.enforce();
    if(source === "all") { source = undefined; }
    let view = _.extend({
        title: "All harvested items",
        hasClaimed: true,
        rows: getRowsFromTable(source)
    }, createReportingNavigation(source));
    E.render(view, "reporting-table");
});

P.respond("GET,POST", "/do/hres-repo-harvest-sources/all-unclaimed-items", [
    {parameter: "source", as: "string", optional: true}
], function(E, source) {
    CanManageHarvestedItems.enforce();
    if(source === "all") { source = undefined; }
    let view = _.extend({
        title: "All unclaimed items",
        hasClaimed: false,
        rows: _.filter(getRowsFromTable(source), (fact) => {
            return !(fact.claimed || fact.disclaimed);
        })
    }, createReportingNavigation(source));
    E.render(view, "reporting-table");
});