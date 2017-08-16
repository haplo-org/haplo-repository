/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("refIsSubmissible",    "boolean",      "REF Submissible").
        fact("refEmbargoCheck",     "boolean",      "Embargo within allowed length").
        fact("refDepositCheck",     "boolean",      "Deposited in time").
        fact("refMetadataCheck",    "boolean",      "Has required metadata").
        fact("refHasException",     "boolean",      "Exception registered").
        fact("refFirstPublished",   "date",         "Publication date").
        fact("refUnitOfAssessment", "ref",          "REF Unit of Assessment").
        
        statistic({
            name:"refSubmissibleCount",
            description:"Items submissible to the REF",
            filter: function(select) {
                select.where("refIsSubmissible", "=", true);
            },
            aggregate:"COUNT"
        });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    row.refIsSubmissible = P.isREFSubmissible(object);
    
    var checks = P.REFChecks;
    row.refEmbargoCheck = !!checks.embargo.check(object);
    row.refDepositCheck = !!checks.deposit.check(object);
    row.refMetadataCheck = !!checks.metadata.check(object);
    
    row.refHasException = !!P.getREFException(object);
    var published = P.getEarliestPublicationDate(object);
    row.refFirstPublished =  published ? published.start : null;
    row.refUnitOfAssessment = object.first(A.REFUnitOfAssessment) || null;
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
        var ref = O.ref(pathElements[1]);
        details.filter = function(select) {
            select.where("refUnitOfAssessment", "=", ref);
        };
        details.title = ref.load().title+" ("+details.title+")";
    }
});

P.implementService("std:reporting:dashboard:repository_overview:setup", function(dashboard) {
    dashboard.columns(1000, [
        "refIsSubmissible"
    ]);
});

P.implementService("std:reporting:dashboard:embargo_overview:setup", function(dashboard) {
    dashboard.columns(1000, [
        {fact:"refEmbargoCheck", heading:"Embargo exceeds REF limit"}
    ]);
});

// ------------------------------------------------------------

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(P.CanManageREF)) {
        var panel = builder.panel(500).
            link(400, "/do/hres-ref-repo/compliance-overview", "REF Compliance");
    }
});

P.respond("GET,POST", "/do/hres-ref-repo/compliance-overview", [
], function(E) {
    P.CanManageREF.enforce();
    P.reporting.dashboard(E, {
        kind:"list",
        collection:"repository_items",
        name:"ref_compliance",
        title:"REF Compliance"
    }).
        summaryStatistic(0, "refSubmissibleCount").
        order(["refFirstPublished", "descending"]).
        columns(1, [
            {fact:"ref", heading:"Item", link:true}
        ]).
        columns(200, [
            "refFirstPublished",
            "refEmbargoCheck",
            "refDepositCheck",
            "refMetadataCheck",
            "refHasException",
            "refIsSubmissible"
        ]).
        respond();
});

// ------------------------------------------------------------
// REF Unit of Assessment Open Access reporting

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(P.CanManageREF)) {
        builder.panel(600).
            link(600, "/do/hres-ref-repo/open-access", "REF Unit of Assessment");
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

var getItemListUrl = function(oaType, unitRef, year) {
    var url = "/do/hres-repo-open-access/repository-items/"+oaType+"/ref-unit/"+unitRef;
    if(year) {
        url = url+"?year="+year;
    }
    return url;
};

P.respond("GET,POST", "/do/hres-ref-repo/open-access", [
    {parameter:"year", as:"int", optional:true}
], function(E, year) {
    P.CanManageREF.enforce();
    var dashboard = P.reporting.dashboard(E, {
        kind: "list",
        collection: "ref_unit_of_assessment",
        name: "OA_ref_unit_of_assessment",
        title: "Open Access: REF Unit of Assessment"
    }).
        use("hres:schema:calendar_year_navigation_for_json_columns", year).
        columns(0, [
            {fact: "ref", heading: "REF Unit of Assessment", link: true}
        ]).
        columns(100, [
            {
                type:"linked", column:"oaGreenOutputs", link: function(row) {
                    return getItemListUrl("green", row.ref, year);
            }},{
                type:"linked", column:"oaGoldOutputs", link: function(row) {
                    return getItemListUrl("gold", row.ref, year);
            }},{
                type:"linked", column:"oaNotOAOutputs", link: function(row) {
                    return getItemListUrl("not-oa", row.ref, year);
            }},{
                type:"linked", column:"oaTotalEligibleOutputs", link: function(row) {
                    return getItemListUrl("all", row.ref, year);
            }}
        ]).
        respond();
});

