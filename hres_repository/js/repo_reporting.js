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
        panel.
            link(95, "/do/hres-repository/full-overview", "Repository overview (all years)").
            link(100, "/do/hres-repository/overview", "Outputs by year").
            link(300, "/do/hres-repository/outputs-in-progress-overview", "Draft outputs overview").
            link(350, "/do/hres-repository/publishers-overview", "Outputs by publisher").
            link(500, "/do/hres-repository/files-by-faculty", "Attached files by "+NAME("Faculty")).
            link(550, "/do/hres-repository/files-by-department", "Attached files by "+NAME("Department"));
        builder.panel(1500).title("Exports");
    }
});

P.implementService("std:action_panel:activity:statistics:repository", function(display, builder) {
        P.reporting.statisticsPanelBuilder(builder, "repository_items").
            statistic(1000, "/do/hres-repository/full-overview", "count", "Repository items");
});

// Sentinel object for reporting on uncontrolled publisher entries
P.onInstall = function() {
    if(!O.behaviourRefMaybe("hres:object:publisher-reporting-sentinel")) {
        var sentinel = O.object([Label.ARCHIVED]);
        sentinel.appendType(T.IntranetPage);
        sentinel.appendTitle("Unregistered publisher entered");
        sentinel.append(O.text(O.T_IDENTIFIER_CONFIGURATION_NAME, "hres:object:publisher-reporting-sentinel"), A.ConfiguredBehaviour);
        sentinel.save();
    }
    if(!O.behaviourRefMaybe("hres:object:journal-reporting-sentinel")) {
        var journalSentinel = O.object([Label.ARCHIVED]);
        journalSentinel.appendType(T.IntranetPage);
        journalSentinel.appendTitle("Unregistered journal entered");
        journalSentinel.append(O.text(O.T_IDENTIFIER_CONFIGURATION_NAME, "hres:object:journal-reporting-sentinel"), A.ConfiguredBehaviour);
        journalSentinel.save();
    }
};

// --------------------------------------------------------
// Publishers

P.implementService("std:reporting:discover_collections", function(discover) {
    discover("publishers", "Publishers");
});

P.implementService("std:reporting:gather_collection_update_rules", function(rule) {
    // TODO: refactor this into something nicer
    _.each(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), function(t) {
        rule("publishers", t, A.Publisher);
    });
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
        fact("title",           "text",     "Title").
        fact("author",          "ref",      "Primary author").
        fact("type",            "ref",      "Type").
        fact("faculty",         "ref",      NAME("Faculty")).
        fact("department",      "ref",      NAME("Department")).
        fact("year",            "date",     "Year").
        fact("publisher",       "ref",      "Publisher").
        fact("journal",         "ref",      "Journal").
        fact("issn",            "text",     "ISSN").
        fact("license",         "ref",      "License").
        fact("created",         "date",     "Record created").
        fact("publishedDate",   "date",     "Published").
        fact("onlinePublicationDate", "date", "Published online").
        fact("hasAnyFile",      "boolean",  "Has file").
        fact("isPublished",         "boolean",      "Published").
        fact("isRejected",          "boolean",      "Rejected");

    collection.statistic({
        name: "count", description: "Total",
        aggregate: "COUNT"
    });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    row.type = object.firstType();
    // Retrieves first author with a StoreObject record
    row.title = object.title;
    var author = object.first(A.Author);
    if(author) {
        row.author = author;
        // TODO: Repository entities to be properly defined
        var entities = P.hresCombinedApplicationStandaloneEntities({
            "researcher": function(context) { return (context === "list") ? [author] : author; }
        }).constructEntitiesObject(author.load());
        row.faculty = entities.faculty_refMaybe || null;
        row.department = entities.department_refMaybe || null;
    }
    if(object.first(A.Date)) {
        row.year = object.first(A.Date).start;
    }
    var pub = object.first(A.Publisher);
    if(pub) {
        row.publisher =  O.isRef(pub) ? pub : O.behaviourRef("hres:object:publisher-reporting-sentinel");
    }
    var journal = object.first(A.Journal);
    if(journal){
        row.journal = O.isRef(journal) ? journal : O.behaviourRef("hres:object:journal-reporting-sentinel");
    }

    var issn = object.first(A.ISSN);
    if(issn) {
        row.issn = issn.toString();
    }

    row.created = object.creationDate;
    row.license = object.first(A.License) || null;

    var onlinePublicationDate = object.first(A.PublicationDates, Q.Online);
    if(onlinePublicationDate) {
        row.onlinePublicationDate = onlinePublicationDate.start;
    }
    row.publishedDate = O.serviceMaybe("hres:repository:earliest_publication_date", object) || null;

    object.every((v,d,q) => {
        if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
            row.hasAnyFile = true;
        }
    });

    row.isPublished = object.labels.includes(Label.AcceptedIntoRepository);
    row.isRejected = object.labels.includes(Label.RejectedFromRepository);
});

// ---------------------------------------------------------

P.implementService("std:reporting:dashboard:ref_embargoes:setup", function(dashboard) {
    dashboard.columns(100, [
        {fact:"publisher", link:true}
    ]);
});

P.implementService("std:reporting:dashboard:ref_non_compliance:setup", function(dashboard) {
    dashboard.columns(20, ["publishedDate"]).
        columns(120, ["hasAuthorAcceptedManuscript"]);
});

// ---------------------------------------------------------

var getSortedTypeFilterSpec = function() {
    var typeFilterSpec = _.map(P.REPOSITORY_TYPES, function(t) {
        return {ref: t, title: SCHEMA.getTypeInfo(t).name};
    });
    return _.sortBy(typeFilterSpec, 'title');
};

P.implementService("hres:repository:sorted_type_filter_spec", function() {
    return getSortedTypeFilterSpec;
});

var getOverviewDashboard = function(E, title) {
    return P.reporting.dashboard(E, {
            kind:"list",
            collection:"repository_items",
            // Single name so that reporting setup services add to all overview dashbaords
            name: "repository_overview",
            title: title
        }).
            summaryStatistic(0, "count").
            use("hres:person_name_column", {personFact:"author", heading:"Primary author", personNameStyle: "medium"}).
            use("std:row_object_filter", {fact:"type", objects: getSortedTypeFilterSpec}).
            columns(1, [
                {fact:"ref", heading:"Output", link:true}
            ]).
            columns(100, [
                {fact: "type", style:"small"},
                "publishedDate"
            ]);
};

P.implementService("std:reporting:dashboard:repository_overview:setup_export", function(dashboard) {
    dashboard.columns(150, [
        "journal",
        "publisher",
        "license",
        "year"
    ]);
});

// Allow other plugins to get the overview dashboard, which they can then filter however they want
P.implementService("hres:repository:reporting:overview_dashboard", function(E, title) {
    return getOverviewDashboard(E, title);
});

P.respond("GET,POST", "/do/hres-repository/full-overview", [
], function(E) {
    CanViewRepositoryDashboards.enforce();
    let dashboard = getOverviewDashboard(E, "Repository overview (all years)");
    dashboard.columns(200, [
        {fact:"year", type:"lookup", lookup:(date) => {
            if(date) {
                return new XDate(date).getFullYear();
            }
        }}
    ]);
    dashboard.respond();
});

P.respond("GET,POST", "/do/hres-repository/overview", [
    {parameter:"year", as:"int", optional:true}
], function(E, year) {
    CanViewRepositoryDashboards.enforce();
    let dashboard = getOverviewDashboard(E, "Repository overview by year");
    dashboard.
        use("hres:schema:calendar_year_navigation", year, "year").
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
        order(["itemsCount", true]).
        columns(1, [
            {fact:"ref", heading:"Publisher", link:true}
        ]).
        columns(200, [
            {fact:"itemsCount", style:"small"}
        ]).
        respond();
});

P.implementService("std:reporting:dashboard:outputs_in_progress:setup_export", function(dashboard) {
    dashboard.columns(150, [
        "faculty",
        "year",
        "journal",
        "publisher"
    ]);
});
var filterNotInProgress = function(select) {
    select.and(function(sq) {
        sq.
            where("isPublished", "<>", true).
            where("isRejected", "<>", true);
    });
};
P.respond("GET,POST", "/do/hres-repository/outputs-in-progress-overview", [
], function(E) {
    CanViewRepositoryDashboards.enforce();
    P.reporting.dashboard(E, {
        kind:"list",
        collection: "repository_items",
        name: "outputs_in_progress",
        title: "Draft outputs overview"
    }).
        filter(filterNotInProgress).
        use("std:row_text_filter", {facts:["author", "title"], placeholder:"Search"}).
        use("std:row_object_filter", {fact:"type", objects: getSortedTypeFilterSpec}).
        summaryStatistic(0, "count").
        columns(10, [
            {fact:"ref", heading:"Output", link:true}
        ]).
        columns(100, [
            {fact:"type"},
            {fact:"author", link:true},
            "publishedDate",
            "created"
        ]).
        columns(500, [
            {fact:"hasAuthorAcceptedManuscript", style:"tiny"}
        ]).
        respond();
 });

P.implementService("std:reporting:dashboard:ref_embargoes:setup_export", function(dashboard) {
    dashboard.columns(10, [
        "author",
        "faculty",
        "year",
        "journal",
        "publishedDate"
    ]);
});


// ---------------------------------------------------------

P.implementService("hres:reporting-aggregate-dimension:repository-item-files", function() {
    var facts = [
        {fact:"hasAnyFile", title:"Has file"},
        {fact:"hasPublishersVersion", title:"Has VoR"},
        {fact:"hasAuthorAcceptedManuscript", title: "Has AAM"}
    ];
    var dimension = _.map(facts, (f) => {
        return {
            title: f.title,
            filter(select) {
                select.where(f.fact, "=", true);
            }
        };
    });
    dimension.unshift({
        title:"Outputs",
        filter(select) {} // To get totals
    });
    return dimension;
});

var getResearchInstituteOrNullDimension = function(fact, type) {
    var faculties = O.query().link(type, A.Type).sortByTitle().execute();
    var dimensions = _.map(faculties, (object) => {
        var ref = object.ref;   // so object falls out of scope and gets garbage collected
        return {
            title: object.shortestTitle,
            filter(select) {
                select.where(fact, "=", ref);
            }
        };
    });
    dimensions.push({
        title: "None",
        filter(select) {
            select.where(fact, "=", null);
        }
    });
    dimensions.push({
        title: "Total",
        filter(select) {}
    });
    return dimensions;
};
P.implementService("hres:reporting-aggregate-dimension:current-faculty-or-null", function() {
    return getResearchInstituteOrNullDimension("faculty", T.Faculty);
});
P.implementService("hres:reporting-aggregate-dimension:current-department-or-null", function() {
    return getResearchInstituteOrNullDimension("department", T.Department);
});

P.respond("GET,POST", "/do/hres-repository/files-by-faculty", [
], function(E) {
    CanViewRepositoryDashboards.enforce();
    P.reporting.dashboard(E, {
        kind:"aggregate",
        collection:"repository_items",
        name:"output_files_by_faculty",
        title:"Attached files by "+NAME("Faculty"),
        x:"hres:reporting-aggregate-dimension:repository-item-files",
        y:"hres:reporting-aggregate-dimension:current-faculty-or-null"
    }).respond();
});

P.respond("GET,POST", "/do/hres-repository/files-by-department", [
], function(E) {
    CanViewRepositoryDashboards.enforce();
    P.reporting.dashboard(E, {
        kind:"aggregate",
        collection:"repository_items",
        name:"output_files_by_department",
        title:"Attached files by "+NAME("Department"),
        x:"hres:reporting-aggregate-dimension:repository-item-files",
        y:"hres:reporting-aggregate-dimension:current-department-or-null"
    }).respond();
});
