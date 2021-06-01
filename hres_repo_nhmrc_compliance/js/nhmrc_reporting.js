/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */



P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    let i = P.locale().text("template");
    collection.
        fact("nhmrcOpenAccessCheck",      "boolean",      i["Openly accessible in time"]).
        fact("nhmrcDepositedCheck",       "boolean",      i["Metadata made public in time"]).
        fact("nhmrcGrantSystemCheck",     "boolean",      i["NHMRC Grant system updated"]).
        fact("nhmrcMetadataCheck",        "boolean",      i["Has appropriate metadata"]).
        fact("nhmrcWillPassOnDeposit",    "boolean",      i["Will pass when deposited"]).
        fact("nhmrcAccessLevelCheck",     "boolean",      i["Has appropriate access level selected"]).
        fact("nhmrcFinalReportCheck",     "boolean",      i["Metadata listed in final report"]).
        fact("nhmrcSecondaryDataCheck",   "boolean",      i["Secondary data appropriately referenced"]).
        fact("nhmrcPatentPublished",      "boolean",      i["Patent applicable published correctly"]).
        fact("nhmrcInstitutionCheck",     "boolean",      i["Administering institution on Source IP"]).
        fact("nhmrcGrantIDCheck",         "boolean",      i["Grant ID referenced on Source IP"]).
        fact("nhmrcPublishedInOAPeriod",  "boolean",      i["Published in NHMRC OA period"]).
        fact("nhmrcIsOACompliant",        "boolean",      i["OA compliant"]).
        fact("nhmrcIsInOAScope",          "boolean",      i["In policy scope"]).
        statistic({
            name: "countNHMRCOACompliant", description: i["NHMRC OA Compliant items"],
            filter(select) { 
                select.where("nhmrcIsOACompliant", "=", true).
                    where("nhmrcPublishedInOAPeriod", "=", true).
                    where("nhmrcIsInOAScope", "=", true);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countNHMRCOAOpenAccessFail", description: i["Openly accessible too late"],
            filter(select) {
                select.where("nhmrcOpenAccessCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countNHMRCOADepositFail", description: i["Deposited too late"],
            filter(select) {
                select.where("nhmrcDepositedCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countNHMRCOAGrantSystemFail", description: i["Grant system not updated"],
            filter(select) {
                select.where("nhmrcGrantSystemCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countNHMRCOAMetadataFail", description: i["Has inappropriate metadata"],
            filter(select) {
                select.where("nhmrcMetadataCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countNHMRCOAAccessLevelFail", description: i["Access level not marked as considered"],
            filter(select) {
                select.where("nhmrcAccessLevelCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countNHMRCOAFinalReportFail", description: i["Metadata not listed in final report"],
            filter(select) {
                select.where("nhmrcFinalReportCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countNHMRCOASecondaryDataFail", description: i["Secondary data used without citation"],
            filter(select) {
                select.where("nhmrcSecondaryDataCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countNHMRCOAPatentPublishFail",
            description: i["Patent not published in the Australian Official Journal of Patents within 18 months"],
            filter(select) {
                select.where("nhmrcPatentPublished", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countNHMRCOAInstitutionCheckFail", description: i["Administering institution not on Source IP"],
            filter(select) {
                select.where("nhmrcInstitutionCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countNHMRCOAGrantIDFail", description: i["Grant ID not referenced in description on Source IP"],
            filter(select) {
                select.where("nhmrcGrantIDCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countNHMRCWillPassOnDeposit", description: i["Will pass on deposit"],
            filter(select) {
                select.where("nhmrcWillPassOnDeposit", "=", true);
            },
            aggregate: "COUNT"
        }).
        filter("withinNHMRCPolicyScope", (select) => {
            select.where("nhmrcPublishedInOAPeriod", "=", true).
                where("nhmrcIsInOAScope", "=", true);
        }).
        filter("publishedInNHMRCPeriod", (select) => {
            select.where("nhmrcPublishedInOAPeriod", "=", true);
        }).
        filter("nhmrcNonCompliantPublishedInNHMRCPeriod", (select) => {
            select.where("nhmrcPublishedInOAPeriod", "=", true).
                where("nhmrcIsInOAScope", "=", true).
                or((sq) => {
                    sq.where("nhmrcIsOACompliant", "=", false).
                        where("nhmrcIsOACompliant", "=", null);
                });
        });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    let objectIsResearchLiterature = object.isKindOfTypeAnnotated("hres:annotation:repository:text-based-research") &&
        !("Patent" in T && object.isKindOf(T.Patent));

    if(objectIsResearchLiterature) {
        row.nhmrcOpenAccessCheck = !!P.ResearchLiteratureChecks["open-access"].check(object);
        row.nhmrcDepositedCheck = !!P.ResearchLiteratureChecks["deposit"].check(object);
        row.nhmrcGrantSystemCheck = !!P.ResearchLiteratureChecks["grant-system-marked"].check(object);
    }

    if("Dataset" in T && object.isKindOf(T.Dataset)) {
        row.nhmrcMetadataCheck = !!P.ResearchDataChecks["metadata"].check(object);
        row.nhmrcAccessLevelCheck = !!P.ResearchDataChecks["access-level"].check(object);
        row.nhmrcFinalReportCheck = !!P.ResearchDataChecks["final-report"].check(object);
        row.nhmrcSecondaryDataCheck = !!P.ResearchDataChecks["secondary-data"].check(object);
    }

    if("Patent" in T && object.isKindOf(T.Patent)) {
        row.nhmrcPatentPublished = !!P.PatentChecks["published-correctly"].check(object);
        row.nhmrcInstitutionCheck = !!P.PatentChecks["administering-institution"].check(object);
        row.nhmrcGrantIDCheck = !!P.PatentChecks["grant-id-source-ip"].check(object);
    }

    row.nhmrcWillPassOnDeposit = P.willPassOnDeposit(object);
    row.nhmrcPublishedInOAPeriod = P.isPublishedInNHMRCPeriod(object);
    row.nhmrcIsInOAScope = P.isInOAPolicyScope(object);
    row.nhmrcIsOACompliant = P.passesNHMRCChecks(object);
});

// --------------------------------------------------------------------------

P.implementService("hres:reporting_aggregate_dimension:nhmrc_oa_compliance", function() {
    return [
        { title: "Total compliant", filter(select) {
            select.where("nhmrcIsOACompliant", "=", true).
                where("nhmrcPublishedInOAPeriod", "=", true).
                where("nhmrcIsInOAScope", "=", true);
        }},
        { title: "Non-compliant", filter(select) {
            select.where("nhmrcIsOACompliant", "=", false).
                where("nhmrcPublishedInOAPeriod", "=", true).
                where("nhmrcIsInOAScope", "=", true);
        }},
        { title: "Out of scope", filter(select) {
            select.or((sq) => {
                sq.where("nhmrcIsInOAScope", "=", false).
                    where("nhmrcPublishedInOAPeriod", "=", false);
            });
        }},
        { title: "Total", filter() {} }
    ];
});

P.implementService("std:reporting:dashboard:outputs_in_progress:setup_export", function(dashboard) {
    dashboard.columns(230, [
        {fact:"nhmrcIsOACompliant", heading:"NHMRC OA Compliant"}
    ]);
});

// ------------------------------------------------------------

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(P.CanManageNHMRCCompliance)) {
    let i = P.locale().text("template");
        builder.panel(560).
            title("NHMRC Open Access").
            link(20, "/do/hres-repo-nhmrc-compliance/overview", i["Overview (NHMRC OA policy applicable)"]).
            link(40, "/do/hres-repo-nhmrc-compliance/items-within-scope", i["Items within NHMRC OA policy scope"]).
            link(60, "/do/hres-repo-nhmrc-compliance/non-compliant-research-literature", i["Non-compliant research literature"]).
            link(80, "/do/hres-repo-nhmrc-compliance/non-compliant-research-data", i["Non-compliant research data"]).
            link(100, "/do/hres-repo-nhmrc-compliance/non-compliant-patents", i["Non-compliant patents"]).
            link(120, "/do/hres-repo-nhmrc-compliance/compliance-by-faculty",
                O.interpolateNAMEinString(i["NHMRC OA compliance by NAME(Faculty)"]));

        if(O.service("hres:schema:institute_depth") > 1) {
            builder.panel(560).
                link(140, "/do/hres-repo-nhmrc-compliance/compliance-by-department",
                    O.interpolateNAMEinString(i["NHMRC OA compliance by NAME(Department)"]));
        }
    }
});

P.respond("GET,POST", "/do/hres-repo-nhmrc-compliance/compliance-by-faculty", [
], function(E) {
    P.CanManageNHMRCCompliance.enforce();
    let i = P.locale().text("template");
    P.reporting.dashboard(E, {
        kind: "aggregate",
        collection: "repository_items",
        name: "compliance_by_faculty",
        title: O.interpolateNAMEinString(i["NHMRC OA compliance by NAME(Faculty)"]),
        filter: "publishedInNHMRCPeriod",
        x: "hres:reporting_aggregate_dimension:nhmrc_oa_compliance",
        y: "hres:reporting-aggregate-dimension:faculty"
    }).respond();
});

P.respond("GET,POST", "/do/hres-repo-nhmrc-compliance/compliance-by-department", [
], function(E) {
    P.CanManageNHMRCCompliance.enforce();
    let i = P.locale().text("template");
    P.reporting.dashboard(E, {
        kind: "aggregate",
        collection: "repository_items",
        name: "compliance_by_department",
        title: O.interpolateNAMEinString(i["NHMRC OA compliance by NAME(Department)"]),
        filter: "publishedInNHMRCPeriod",
        x: "hres:reporting_aggregate_dimension:nhmrc_oa_compliance",
        y: "hres:reporting-aggregate-dimension:department"
    }).respond();
});

P.respond("GET,POST", "/do/hres-repo-nhmrc-compliance/non-compliant-research-literature", [
], function(E) {
    P.CanManageNHMRCCompliance.enforce();
    let i = P.locale().text("template");
    P.reporting.dashboard(E, {
        name: "nhmrc_non_compliant_research_literature",
        kind: "list",
        collection: "repository_items",
        title: i["Research literature items failing NHMRC OA compliance"],
        filter: "nhmrcNonCompliantPublishedInNHMRCPeriod"
    }).
        filter((select) => {
            // Research literature items always have true or false, using tri-state logic to distinguish
            select.where("nhmrcOpenAccessCheck", "!=", null);
        }).
        use("std:row_text_filter", {facts:["title","author"], placeholder:"Search"}).
        use("std:row_object_filter", {fact:"type", objects: O.service("hres:repository:sorted_type_filter_spec")}).
        summaryStatistic(0, "count").
        summaryStatistic(1, "countNHMRCOAOpenAccessFail").
        summaryStatistic(2, "countNHMRCOADepositFail").
        summaryStatistic(3, "countNHMRCOAGrantSystemFail").
        columns(10, [
            {type:"linked", style:"wide", column:{fact:"title"}}
        ]).
        columns(100, [
            {
                fact:"nhmrcOpenAccessCheck",
                type:"boolean",
                heading:i["Made open access too late"],
                truthFunction(value) { return !value; }
            },
            {
                fact:"nhmrcDepositedCheck",
                type:"boolean",
                heading:i["Deposited too late"],
                truthFunction(value) { return !value; }
            },
            {
                fact:"nhmrcGrantSystemCheck",
                type:"boolean",
                heading:i["Grant system not updated"],
                truthFunction(value) { return !value; }
            }
        ]).
        columns(150, [
            "nhmrcWillPassOnDeposit"
        ]).
        respond();
});

P.respond("GET,POST", "/do/hres-repo-nhmrc-compliance/non-compliant-research-data", [
], function(E) {
    P.CanManageNHMRCCompliance.enforce();
    let i = P.locale().text("template");
    P.reporting.dashboard(E, {
        name: "nhmrc_non_compliant_research_data",
        kind: "list",
        collection: "repository_items",
        title: i["Research data items failing NHMRC OA compliance"],
        filter: "nhmrcNonCompliantPublishedInNHMRCPeriod"
    }).
        filter((select) => {
            // Research data items always have true or false, using tri-state logic to distinguish
            select.where("nhmrcMetadataCheck", "!=", null);
        }).
        use("std:row_text_filter", {facts:["title","author"], placeholder:"Search"}).
        summaryStatistic(0, "count").
        summaryStatistic(4, "countNHMRCOAMetadataFail").
        summaryStatistic(5, "countNHMRCOAAccessLevelFail").
        summaryStatistic(6, "countNHMRCOAFinalReportFail").
        summaryStatistic(7, "countNHMRCOASecondaryDataFail").
        columns(10, [
            {type:"linked", style:"wide", column:{fact:"title"}}
        ]).
        columns(100, [
            {
                fact:"nhmrcMetadataCheck",
                type:"boolean",
                heading:i["Doesn't have appropriate metadata"],
                truthFunction(value) { return !value; }
            },
            {
                fact:"nhmrcAccessLevelCheck",
                type:"boolean",
                heading:i["Access level not marked as considered"],
                truthFunction(value) { return !value; }
            },
            {
                fact:"nhmrcFinalReportCheck",
                type:"boolean",
                heading:i["Metadata not listed in final report"],
                truthFunction(value) { return !value; }
            },
            {
                fact:"nhmrcSecondaryDataCheck",
                type:"boolean",
                heading:i["Secondary data not cited correctly"],
                truthFunction(value) { return !value; }
            },
        ]).
        respond();
});

P.respond("GET,POST", "/do/hres-repo-nhmrc-compliance/non-compliant-patents", [
], function(E) {
    P.CanManageNHMRCCompliance.enforce();
    let i = P.locale().text("template");
    P.reporting.dashboard(E, {
        name: "nhmrc_non_compliant_patents",
        kind: "list",
        collection: "repository_items",
        title: i["Patents failing NHMRC OA compliance"],
        filter: "nhmrcNonCompliantPublishedInNHMRCPeriod"
    }).
        filter((select) => {
            // Research literature items always have true or false, using tri-state logic to distinguish
            select.where("nhmrcPatentPublished", "!=", null);
        }).
        use("std:row_text_filter", {facts:["title","author"], placeholder:"Search"}).
        summaryStatistic(0, "count").
        summaryStatistic(8, "countNHMRCOAPatentPublishFail").
        summaryStatistic(9, "countNHMRCOAInstitutionCheckFail").
        summaryStatistic(10, "countNHMRCOAGrantIDFail").
        columns(10, [
            {type:"linked", style:"wide", column:{fact:"title"}}
        ]).
        columns(100, [
           {
                fact:"nhmrcPatentPublished",
                type:"boolean",
                heading:i["Patent not published in Australian Official Journal of Patents"],
                truthFunction(value) { return !value; }
            },
            {
                fact:"nhmrcInstitutionCheck",
                type:"boolean",
                heading:i["Administering institution not marked as listed on Source IP"],
                truthFunction(value) { return !value; }
            },
            {
                fact:"nhmrcGrantIDCheck",
                type:"boolean",
                heading:i["Not marked as having Grant ID referenced on Source IP"],
                truthFunction(value) { return !value; }
            }
        ]).
        respond();
});

P.respond("GET,POST", "/do/hres-repo-nhmrc-compliance/items-within-scope", [
], function(E) {
    P.CanManageNHMRCCompliance.enforce();
    let i = P.locale().text("template");
    P.reporting.dashboard(E, {
        name: "nhmrc_oa_items_within_scope",
        kind: "list",
        collection: "repository_items",
        title: i["Items within NHMRC OA policy scope"],
        filter: "withinNHMRCPolicyScope"
    }).
        use("std:row_object_filter", {fact: "faculty", objects: T.Faculty}).
        use("std:row_object_filter", {fact:"type", objects: O.service("hres:repository:sorted_type_filter_spec")}).
        summaryStatistic(0, "count").
        summaryStatistic(1, "countNHMRCOACompliant").
        columns(10, [
            {type:"linked", style:"wide", column:{fact:"title"}},
            "type",
            "author"
        ]).
        columns(100, [
            {
                type: "boolean",
                heading: i["Non-compliant"],
                fact: "nhmrcIsOACompliant",
                truthFunction(value) { return !value; }
            }
        ]).
        respond();
});

P.respond("GET,POST", "/do/hres-repo-nhmrc-compliance/overview", [
], function(E) {
    P.CanManageNHMRCCompliance.enforce();
    let i = P.locale().text("template");
    let dashboard = O.service("hres:repository:reporting:overview_dashboard", E, i["Overview (NHMRC OA policy applicable)"]);
    dashboard.filter((select) => { select.where("nhmrcPublishedInOAPeriod", "=", true); }).
        columns(999, [
            "nhmrcPublishedInOAPeriod",
            "nhmrcIsOACompliant"
        ]).
        respond();
});
