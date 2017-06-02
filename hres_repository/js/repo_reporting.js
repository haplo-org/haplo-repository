/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanViewRepositoryDashboards = O.action("hres:action:repository:view-overview-dashboards").
    title("View Repository overview dashboards").
    allow("group", Group.RepositoryEditors);

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(CanViewRepositoryDashboards)) {
        var panel = builder.panel(500).title("Repository");
        panel.link(100, "/do/hres-repository/overview", "Repository overview")
            .link(350, "/do/hres-repository/publishers-overview", "Publishers overview");
    }
});

// Sentinel object for reporting on uncontrolled publisher entries
P.onInstall = function() {
    if(O.behaviourRefMaybe("hres:object:publisher-reporting-sentinel")) { return; }
    var sentinel = O.object([Label.ARCHIVED]);
    sentinel.appendType(T.IntranetPage);
    sentinel.appendTitle("Unregistered publisher entered");
    sentinel.append(O.text(O.T_IDENTIFIER_CONFIGURATION_NAME, "hres:object:publisher-reporting-sentinel"), A.ConfiguredBehaviour);
    sentinel.save();
};

// --------------------------------------------------------
// Publishers

P.implementService("std:reporting:discover_collections", function(discover) {
    discover("publishers", "Publishers");
});

P.implementService("std:reporting:collection:publishers:setup", function(collection) {
    collection.
        currentObjectsOfType(T.Publisher).
        fact("itemsCount",      "int",      "Repository items");
});

P.implementService("std:reporting:collection:publishers:get_facts_for_object", function(object, row) {
    var res = O.service("hres:repository:store_query").link(object.ref, A.Publisher).execute();
    row.itemsCount = res.length;
});


// ---------------------------------------------------------
// Repository items

P.implementService("std:reporting:discover_collections", function(discover) {
    discover("repository_items", "Repository items");
});

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        currentObjectsOfType(P.REPOSITORY_TYPES).
        // TODO: Multivalues of authors - can be very many
        fact("author",      "ref",      "Primary author").
        fact("type",        "ref",      "Output type").
        fact("faculty",     "ref",      "Faculty").
        fact("year",        "date",     "Year").
        fact("publisher",   "ref",      "Publisher");
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    row.type = object.firstType();
    // Retrieves first author with a StoreObject record
    var author = object.first(A.Author);
    if(author) {
        row.author = author;
        // TODO: Repository entities to be properly defined
        var entities = P.hresCombinedApplicationStandaloneEntities({
            "researcher": function(context) { return (context === "list") ? [author] : author; }
        }).constructEntitiesObject(author.load());
        row.faculty = entities.faculty_refMaybe || null;
    }
    if(object.first(A.Date)) {
        row.year = object.first(A.Date).start;
    }
    var pub = object.first(A.Publisher);
    if(pub) {
        row.publisher =  O.isRef(pub) ? pub : O.behaviourRef("hres:object:publisher-reporting-sentinel");
    }
});

P.implementService("std:reporting:dashboard:embargo_overview:setup", function(dashboard) {
    dashboard.columns(100, [
        {fact:"publisher", link:true}
    ]);
});

// ---------------------------------------------------------

P.respond("GET,POST", "/do/hres-repository/overview", [
    {parameter:"year", as:"int", optional:true}
], function(E, year) {
    CanViewRepositoryDashboards.enforce();
    P.reporting.dashboard(E, {
        kind:"list",
        collection:"repository_items",
        name:"repository_overview",
        title:"Repository overview"
    }).
        summaryStatistic(0, "count").
        use("std:row_object_filter", {fact:"type", objects: _.map(P.REPOSITORY_TYPES, function(t) {
            return {ref: t, title: SCHEMA.getTypeInfo(t).name};
        })}).
        use("std:row_object_filter", {fact:"faculty", objects:T.Faculty}).
        use("hres:schema:calendar_year_navigation", year, "year").
        columns(1, [
            {fact:"ref", heading:"Output", link:true}
        ]).
        columns(100, [
            {fact:"author", type:"ref-person-name", link:true},
            "type",
            "faculty"
        ]).
        respond();
});

P.respond("GET,POST", "/do/hres-repository/publishers-overview", [
], function(E) {
    CanViewRepositoryDashboards.enforce();
    P.reporting.dashboard(E, {
        kind:"list",
        collection:"publishers",
        name:"publishers_overview",
        title:"Publishers overview"
    }).
        summaryStatistic(0, "count").
        use("std:row_text_filter", {facts:["ref"], placeholder:"Search"}).
        columns(1, [
            {fact:"ref", heading:"Publisher", link:true}
        ]).
        columns(200, [
            "itemsCount"
        ]).
        respond();
});
