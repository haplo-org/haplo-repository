/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// Permissions -----------------------------------------------------------------------

var canSeeUsageSummary = P.canSeeUsageSummary = O.action("hres:repo_usage_statistics:can_see_summary").
    title("See summary statistics about repository usage").
    allow("group", Group.Administrators).
    allow("group", Group.RepositoryEditors);

// Constants -----------------------------------------------------------------------

var researchInstituteLevels = ["Faculty"];

if(P.INSTITUTE_DEPTH > 1) {
    researchInstituteLevels.push("Department");
    if(P.INSTITUTE_DEPTH > 2) {
        researchInstituteLevels.push("School");
    }
}

var MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
];

var BREAKDOWN_TYPES = {
    "month": {
        fieldName: ["year", "month"],
        displayName: "Month",
        getValue(group) {
            return MONTHS[group._month]+" "+group._year;
        }
    },
    "year": {
        fieldName: "year",
        displayName: "Year",
        getValue(value) {
            return value;
        }
    },
    "researcher": {
        fieldName: "researcher",
        displayName: NAME("Researcher"),
        url: "/do/hres-repo-usage-statistics/researcher-usage-statistics/",
        getValue(researcher) {
            return researcher.load().title;
        }
    },
    "output": {
        fieldName: "outputRef",
        displayName: "Repository item",
        url: "/do/hres-repo-usage-statistics/output-usage-statistics/",
        getValue(output) {
            return output.load().title;
        }
    },
    "country": {
        fieldName: "country",
        displayName: "Country",
        getValue(value) {
            if(typeof value === "string") {
                return value;
            }
            return value.country || "None";
        }
    }
};

// Activity page -----------------------------------------------------------------------

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(canSeeUsageSummary)) {
        let panel = builder.panel(1050).
            title("Usage statistics");
        _.each(researchInstituteLevels, (level) => {
            panel.link(100, "/do/hres-repo-usage-statistics/"+level.toLowerCase()+"-usage-overview", "Overview by "+NAME(level));
        });
    }
});

// Helper Functions -----------------------------------------------------------------------

var setupTabsForOverviewPage = function(breakdownDetails, baseUrl, tabsToIgnore) {
    let tabs = [];
    _.each(BREAKDOWN_TYPES, (bdt,name) => {
        if(tabsToIgnore && tabsToIgnore.indexOf(name) !== -1) { return; }
        tabs.push({
            href: baseUrl+"?breakdowntype="+name,
            label: bdt.displayName,
            selected: breakdownDetails === bdt
        });
    });
    return tabs;
};

var setupRowsForOverviewTable = function(query, groupByField, rowBaseUrl, getValue) {
    let rows = [];
    let views = query.aggregate("SUM", "views", groupByField);
    let downloads = query.aggregate("SUM", "downloads", groupByField);
    _.each(views, (row) => {
        let download = _.find(downloads, (d) => {
            if(d.group) {
                return O.isRef(d.group) ? (d.group == row.group) : _.isEqual(d.group,row.group);
            } else {
                return _.isEqual(d.groups,row.groups);
            }
        });
        rows.push({
            name: getValue(row.group || row.groups),
            url: rowBaseUrl ? rowBaseUrl+row.group : undefined,
            views: row.value,
            downloads: download.value
        });
    });
    return rows;
};

var generateXLSDownload = function(object, breakdownDetails, rows) {
    let tableName = object.title+" usage statistics by "+breakdownDetails.displayName;
    var xls = O.generate.table.xls(tableName);
    xls.newSheet(tableName);
    xls.cell(breakdownDetails.displayName);
    xls.cell("Views");
    xls.cell("Downloads");
    _.each(rows, (r) => {
        xls.nextRow();
        xls.cell(r.name);
        xls.cell(r.views);
        xls.cell(r.downloads);
    });
    return xls;
};

var setUpOverviewForResearchInstituteLevel = function(E, level, download) {
    let query = O.service("haplo:usage_tracking:query_database", {
        table: "repository"+level+"Totals",
        key: {}
    });
    let rows = setupRowsForOverviewTable(query, level.toLowerCase(), "/do/hres-repo-usage-statistics/usage-by-"+level.toLowerCase()+"/", (v) => v.load().title);

    if(download) {
        E.response.body = generateXLSDownload({title: "Overview"}, {displayName: level}, rows);
    } else {
        E.render({
            rows: rows,
            breakdownType: NAME(level),
            baseUrl: "/do/hres-repo-usage-statistics/"+level.toLowerCase()+"-usage-overview",
            pageTitle: "Overview by "+NAME(level),
            backLink: "/do/activity/repository"
        }, "overview-table");
    }
};

var setUpBreakdownForResearchInstitute = function(E, level, researchInstitute, breakdownType, download) {
    let key = {};
    key[level.toLowerCase()] = researchInstitute.ref;
    let table;
    switch(breakdownType) {
        case "researcher":
            table = "repositoryResearcherTotals";
            break;
        default:
            table = "repository"+level+"Totals";
    }
    let query = O.service("haplo:usage_tracking:query_database", {
        table: table,
        key: key
    });
    let breakdownDetails = BREAKDOWN_TYPES[breakdownType] || BREAKDOWN_TYPES.month;

    let tabs = setupTabsForOverviewPage(breakdownDetails, "/do/hres-repo-usage-statistics/usage-by-"+level.toLowerCase()+"/"+researchInstitute.ref);

    let researchers = setupRowsForOverviewTable(query, breakdownDetails.fieldName, breakdownDetails.url, breakdownDetails.getValue);

    if(download) {
        E.response.body = generateXLSDownload(researchInstitute, breakdownDetails, researchers);
    } else {
        E.render({
            rows: researchers,
            breakdownType: breakdownDetails.displayName,
            baseUrl: "/do/hres-repo-usage-statistics/usage-by-"+level.toLowerCase(), 
            object: researchInstitute,
            breakdownTypeUrl: breakdownType,
            pageTitle: researchInstitute.title+" views and downloads",
            backLink: "/do/hres-repo-usage-statistics/"+level.toLowerCase()+"-usage-overview",
            tabs: tabs
        }, "overview-table");
    }
};

// Handlers -----------------------------------------------------------------------

_.each(researchInstituteLevels, (level) => {
    P.respond("GET", "/do/hres-repo-usage-statistics/"+level.toLowerCase()+"-usage-overview", [
        {parameter:"download", as:"int", optional:true}
    ], function(E, download) {
        canSeeUsageSummary.enforce();
        setUpOverviewForResearchInstituteLevel(E, level, download);
    });

    P.respond("GET", "/do/hres-repo-usage-statistics/usage-by-"+level.toLowerCase(), [
        {pathElement:0, as:"object"},
        {parameter:"breakdowntype", as:"string", optional:true},
        {parameter:"download", as:"int", optional:true}
    ], function(E, researchInstitute, breakdownType, download) {
        canSeeUsageSummary.enforce();
        setUpBreakdownForResearchInstitute(E, level, researchInstitute, breakdownType, download);
    });
});

P.respond("GET", "/do/hres-repo-usage-statistics/researcher-usage-statistics", [
    {pathElement:0, as:"object"},
    {parameter:"breakdowntype", as:"string", optional:true},
    {parameter:"download", as:"int", optional:true}
], function(E, researcher, breakdownType, download) {
    canSeeUsageSummary.enforce();
    let query = O.service("haplo:usage_tracking:query_database", {
        table: "repositoryResearcherTotals",
        key: {researcher: researcher.ref}
    });
    let breakdownDetails = BREAKDOWN_TYPES[breakdownType] || BREAKDOWN_TYPES.month;
    let outputs = setupRowsForOverviewTable(query, breakdownDetails.fieldName, breakdownDetails.url, breakdownDetails.getValue);

    if(download) {
        E.response.body = generateXLSDownload(researcher, breakdownDetails, outputs);
    } else {
        let tabs = setupTabsForOverviewPage(breakdownDetails, "/do/hres-repo-usage-statistics/researcher-usage-statistics/"+researcher.ref, ["researcher"]);
        E.render({
            rows: outputs,
            breakdownType: breakdownDetails.displayName,
            baseUrl: "/do/hres-repo-usage-statistics/researcher-usage-statistics",
            object: researcher, 
            breakdownTypeUrl: breakdownType,
            pageTitle: "Views and downloads for "+researcher.title,
            backLink: researcher.url(),
            tabs: tabs
        }, "overview-table");
    }
});

P.respond("GET", "/do/hres-repo-usage-statistics/output-usage-statistics", [
    {pathElement:0, as:"object"},
    {parameter:"breakdowntype", as:"string", optional:true},
    {parameter:"download", as:"int", optional:true}
], function(E, output, breakdownType, download) {
    canSeeUsageSummary.enforce();
    let query = O.service("haplo:usage_tracking:query_database", {
        table: "repoObjectTotals",
        key: {outputRef: output.ref}
    });
    let breakdownDetails = BREAKDOWN_TYPES[breakdownType] || BREAKDOWN_TYPES.month;
    let countries = setupRowsForOverviewTable(query, breakdownDetails.fieldName, breakdownDetails.url, breakdownDetails.getValue);

    if(download) {
        E.response.body = generateXLSDownload(output, breakdownDetails, countries);
    } else {
        let tabs = setupTabsForOverviewPage(breakdownDetails, "/do/hres-repo-usage-statistics/output-usage-statistics/"+output.ref, ["researcher", "output"]);
        E.render({
            rows: countries,
            tabs: tabs,
            breakdownType: breakdownDetails.displayName,
            baseUrl: "/do/hres-repo-usage-statistics/output-usage-statistics", 
            object: output, 
            breakdownTypeUrl: breakdownType,
            pageTitle: "Views and downloads for "+output.title,
            backLink: output.url()
        }, "overview-table");
    }
});
