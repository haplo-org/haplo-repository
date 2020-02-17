/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("refUnitOfAssessment",     "ref",          "Unit of Assessment").
        fact("refEmbargoCheck",         "boolean",      "Embargo within allowed length").
        fact("refDepositCheck",         "boolean",      "Deposited in time").
        fact("refMetadataCheck",        "boolean",      "Has required metadata").
        fact("refWillPassOnPublication", "boolean",     "Will pass when published").
        fact("refHasException",         "boolean",      "Exception registered").
        
        fact("refFirstPublished",       "date",         "Publication date").
        fact("refPublishedInOAPeriod",  "boolean",      "Accepted in REF OA period").   // Since 2016-04-01
        fact("refPublishedInREFPeriod", "boolean",      "Accepted in current REF period").   // Since 2014-04-01
        fact("refIsOACompliant",        "boolean",      "OA compliant").
        // NOTE: Published as Green OA !== Green OA compliant (for REF purposes). See hres_open_access plugin
        fact("refIsGreenOACompliant",   "boolean",      "Green OA compliant").
        
        fact("refFirstPublished",       "date",         "Publication date").
        fact("refPublishedInOAPeriod",  "boolean",      "Accepted in REF OA period").   // Since 2016-04-01
        fact("refPublishedInREFPeriod", "boolean",      "Accepted in current REF period").   // Since 2014-04-01
        fact("refIsOACompliant",        "boolean",      "OA compliant").
        // NOTE: Published as Green OA !== Green OA compliant (for REF purposes). See hres_open_access plugin
        fact("refIsGreenOACompliant",   "boolean",      "Green OA compliant").
        statistic({
            name:"refSubmissibleCount",
            description:"Items submissible to the REF",
            filter(select) {
                select.where("refIsSubmissible", "=", true);
            },
            aggregate:"COUNT"
        }).
        statistic({
            name: "countREFOACompliant", description: "REF OA Compliant items",
            filter(select) { 
                select.where("refIsOACompliant", "=", true).
                    where("refPublishedInOAPeriod", "=", true);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countREFOAEmbargoFail", description: "Embargo too long",
            filter(select) {
                select.where("refEmbargoCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countREFOADepositFail", description: "Deposited too late",
            filter(select) {
                select.where("refDepositCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        statistic({
            name: "countREFOAMetadataFail", description: "Missing metadata",
            filter(select) {
                select.where("refMetadataCheck", "=", false);
            },
            aggregate: "COUNT"
        }).
        filter("withinREFOAPolicyScope", (select) => {
            select.where("refPublishedInOAPeriod", "=", true).
                where("oaIsConfItemOrArticle", "=", true);
        }).
        filter("publishedInREFPeriod", (select) => {
            select.where("refPublishedInREFPeriod", "=", true);
        });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    row.refUnitOfAssessment = object.first(A.REFUnitOfAssessment) || null;

    row.refEmbargoCheck = !!P.REFChecks.embargo.check(object);
    row.refDepositCheck = !!P.REFChecks.deposit.check(object);
    row.refMetadataCheck = !!P.REFChecks.metadata.check(object);
    if(!(P.passesREFOAChecks(object) || P.isGoldOA(object))) {
        row.refWillPassOnPublication = P.willPassOnPublication(object);
    }
    row.refHasException = !!P.getREFException(object);

    row.refFirstPublished =  O.service("hres:repository:earliest_publication_date", object) || null;
    row.refPublishedInOAPeriod = P.isPublishedInREFOAPeriod(object);
    row.refPublishedInREFPeriod = P.isPublishedInREFPeriod(object);

    if(P.isConfItemOrJournalArticle(object)) {
        row.refIsGreenOACompliant = P.passesREFOAChecks(object);
        row.refIsOACompliant = (P.passesREFOAChecks(object) || P.isGoldOA(object));
    }
});

// --------------------------------------------------------------------------

P.implementService("hres:reporting-aggregate-dimension:ref-oa-compliance", function() {
    return [
        { title: "Gold OA", filter(select) { 
            select.where("oaIsGoldOA", "=", true).
                where("refPublishedInOAPeriod", "=", true);
        }},
        { title: "Green compliant", filter(select) {
            select.where("refIsGreenOACompliant", "=", true).
                where("refPublishedInOAPeriod", "=", true);
        }},
        { title: "Total compliant", filter(select) {
            select.where("refIsOACompliant", "=", true).
                where("refPublishedInOAPeriod", "=", true);
        }},
        { title: "Non-compliant", filter(select) {
            select.where("refIsOACompliant", "=", false).
                where("refPublishedInOAPeriod", "=", true);
        }},
        { title: "Out of scope", filter(select) {
            select.or((sq) => {
                sq.where("oaIsConfItemOrArticle", "=", false).
                    where("refPublishedInOAPeriod", "=", false);
            });
        }},
        { title: "Total", filter() {} }
    ];
});

P.implementService("std:reporting:dashboard:outputs_in_progress:setup_export", function(dashboard) {
    dashboard.columns(220, [
        "refUnitOfAssessment",
        {fact:"refIsOACompliant", heading:"REF OA Compliant"}
    ]);
});

// ------------------------------------------------------------

P.hook('hPostObjectChange', function(response, object, operation, previous) {
    if(operation === 'update' || operation === 'create' || operation === "relabel") {
        if(object.labels.includes(Label.AcceptedIntoRepository)) {
            O.service("std:reporting:update_required", "ref_unit_of_assessment", object.every(A.REFUnitOfAssessment));
        }
    }
});

// ------------------------------------------------------------

P.implementService("hres_repo_open_access:custom_dashboard_filtering", function(details, pathElements) {
    if(pathElements[0] === "ref-unit") {
        let ref = O.ref(pathElements[1]);
        details.filter = function(select) {
            select.where("refUnitOfAssessment", "=", ref);
        };
        details.title = ref.load().title+" ("+details.title+")";
    }
});

// ------------------------------------------------------------

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(P.CanManageREF)) {
        builder.panel(550).
            title("REF Open Access").
            link(20, "/do/hres-ref-repo/overview", "Overview (submitted in this REF period)").
            link(100, "/do/hres-ref-repo/items-within-scope", "Items within REF OA policy scope").
            link(200, "/do/hres-ref-repo/non-compliant-items", "Non-compliant items").
            link(300, "/do/hres-ref-repo/embargoes", "Embargo overview").
            link(400, "/do/hres-ref-repo/compliance-by-faculty", "REF OA compliance by "+NAME("Faculty")).
            link(400, "/do/hres-ref-repo/compliance-by-department", "REF OA compliance by "+NAME("Department")).
            link(400, "/do/hres-ref-repo/compliance-by-uoa", "REF OA compliance by Unit of Assessment");

    }
});

P.respond("GET,POST", "/do/hres-ref-repo/compliance-by-faculty", [
], function(E) {
    P.CanManageREF.enforce();
    P.reporting.dashboard(E, {
        kind: "aggregate",
        collection: "repository_items",
        name: "compliance_by_faculty",
        title: "REF OA compliance by "+NAME("Faculty"),
        filter: "publishedInREFPeriod",
        x: "hres:reporting-aggregate-dimension:ref-oa-compliance",
        y: "hres:reporting-aggregate-dimension:faculty"
    }).respond();
});

P.respond("GET,POST", "/do/hres-ref-repo/compliance-by-department", [
], function(E) {
    P.CanManageREF.enforce();
    P.reporting.dashboard(E, {
        kind: "aggregate",
        collection: "repository_items",
        name: "compliance_by_department",
        title: "REF OA compliance by "+NAME("Department"),
        filter: "publishedInREFPeriod",
        x: "hres:reporting-aggregate-dimension:ref-oa-compliance",
        y: "hres:reporting-aggregate-dimension:department"
    }).respond();
});

P.respond("GET,POST", "/do/hres-ref-repo/compliance-by-uoa", [
], function(E) {
    P.CanManageREF.enforce();
    P.reporting.dashboard(E, {
        kind: "aggregate",
        collection: "repository_items",
        name: "compliance_by_uoa",
        title: "REF OA compliance by Unit of Assessment",
        filter: "publishedInREFPeriod",
        x: "hres:reporting-aggregate-dimension:ref-oa-compliance",
        y: "hres:reporting-aggregate-dimension:ref-unit-of-assessments"
    }).respond();
});

P.respond("GET,POST", "/do/hres-ref-repo/embargoes", [
], function(E) {
    P.CanManageREF.enforce();
    P.reporting.dashboard(E, {
        kind:"list",
        collection:"repository_items",
        name:"ref_embargoes",
        title:"Embargo overview"
    }).
        summaryStatistic(0, "count").
        columns(1, [
            {fact:"ref", heading:"Item", link:true}
        ]).
        columns(200, ["refUnitOfAssessment"]).
        columns(999, ["refEmbargoCheck"]).
        respond();
});

P.respond("GET,POST", "/do/hres-ref-repo/non-compliant-items", [
], function(E) {
    P.CanManageREF.enforce();
    P.reporting.dashboard(E, {
        name: "ref_non_compliance",
        kind: "list",
        collection: "repository_items",
        title: "Items failing REF OA compliance"
    }).
        filter((select) => {
            select.where("refPublishedInOAPeriod", "=", true).
                where("oaIsConfItemOrArticle", "=", true).
                or((sq) => {
                    sq.where("refIsOACompliant", "=", false).
                        where("refIsOACompliant", "=", null);
                });
        }).
        use("std:row_text_filter", {facts:["title","author"], placeholder:"Search"}).
        summaryStatistic(0, "count").
        summaryStatistic(2, "countREFOADepositFail").
        summaryStatistic(4, "countREFOAEmbargoFail").
        summaryStatistic(5, "countREFOAMetadataFail").
        columns(10, [
            {type:"linked", style:"wide", column:{fact:"title"}}
        ]).
        columns(100, [
            {
                fact:"refDepositCheck",
                type:"boolean",
                heading:"Deposited too late",
                truthFunction(value) { return !value; }
            },
            {
                fact:"refEmbargoCheck",
                type:"boolean",
                heading:"Embargo too long",
                truthFunction(value) { return !value; }
            },
            {
                fact:"refMetadataCheck",
                type:"boolean",
                heading:"Missing required metadata",
                truthFunction(value) { return !value; }
            }
        ]).
        columns(150, [
            "refWillPassOnPublication"
        ]).
        respond();
});

P.respond("GET,POST", "/do/hres-ref-repo/items-within-scope", [
], function(E) {
    P.CanManageREF.enforce();
    P.reporting.dashboard(E, {
        name: "ref_oa_items_within_scope",
        kind: "list",
        collection: "repository_items",
        title: "Items within REF OA policy scope",
        filter: "withinREFOAPolicyScope"
    }).
        use("std:row_object_filter", {fact: "faculty", objects: T.Faculty}).
        use("std:row_object_filter", {fact: "refUnitOfAssessment", objects: T.REFUnitOfAssessment}).
        summaryStatistic(0, "count").
        summaryStatistic(1, "countREFOACompliant").
        columns(10, [
            {type:"linked", style:"wide", column:{fact:"title"}},
            "type",
            "author"
        ]).
        columns(100, [
            "refIsGreenOACompliant",
            {
                type: "boolean",
                heading: "Non-compliant",
                fact: "refIsOACompliant",
                truthFunction(value) { return !value; }
            },
            "refHasException"
        ]).
        respond();
});

P.respond("GET,POST", "/do/hres-ref-repo/overview", [
], function(E) {
    P.CanManageREF.enforce();
    let dashboard = O.service("hres:repository:reporting:overview_dashboard", E, "Overview (submitted in this REF period)");
    dashboard.filter((select) => { select.where("refPublishedInREFPeriod", "=", true); }).
        columns(999, [
            "refPublishedInOAPeriod",
            "refIsOACompliant",
            "refUnitOfAssessment"
        ]).
        respond();
});

// ------------------------------------------------------------
// REF Unit of Assessment Open Access reporting

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(P.CanManageREF)) {
        builder.panel(600).
            link(600, "/do/hres-ref-repo/open-access", "Open access by REF Unit of Assessment");
    }
});

P.implementService("std:reporting:collection:ref_unit_of_assessment:setup", function(collection) {
    O.service("hres_repo_open_access:add_oa_facts_to_collection", collection);
});

P.implementService("std:reporting:collection:ref_unit_of_assessment:get_facts_for_object", function(object, row) {
    O.service("hres_repo_open_access:get_oa_facts_for_object", object, row,
        // relevant array collects research items that are relevant to this ref unit of assessment
        function(row, relevant, item) {
            if(item.first(A.REFUnitOfAssessment) == row.ref) {
                relevant.push(item);
            }
        }
    );
});

const OA_COLUMN_VIEWS = [
    { fact: "oaGreenOutputs", oaType: "green" },
    { fact: "oaGoldOutputs", oaType: "gold" },
    { fact: "oaNotOAOutputs", oaType: "not-oa" },
    { fact: "oaTotalEligibleOutputs", oaType: "all" }
];

P.respond("GET,POST", "/do/hres-ref-repo/open-access", [
    {parameter:"year", as:"int", optional:true}
], function(E, year) {
    P.CanManageREF.enforce();
    P.reporting.dashboard(E, {
        kind: "list",
        collection: "ref_unit_of_assessment",
        name: "OA_ref_unit_of_assessment",
        title: "Open Access by REF Unit of Assessment"
    }).
        use("hres:schema:calendar_year_navigation_for_json_columns", year).
        columns(0, [
            {fact: "ref", heading: "REF Unit of Assessment", link: true}
        ]).
        columns(100, _.map(OA_COLUMN_VIEWS, (view) => {
            return {
                type: "linked",
                column: view.fact,
                link(row) {
                    return P.template("oa-dashboard-url").render({
                        type: view.oaType,
                        ref: row.ref,
                        year: year
                    });
                }
            };
        })).
        respond();
});

// --------------------------------------------------------------------------
// REF process management

// Add key REF OA information into REF process exports
P.implementService("std:reporting:collection_dashboard:repository_items:setup_final", function(dashboard) {
    if(dashboard.property("hres_ref_process") && dashboard.isExporting && (dashboard.kind === "list")) {
        dashboard.columns(350, [
            "refPublishedInOAPeriod",
            "refIsOACompliant",
            "refHasException"
        ]);
    }
});
