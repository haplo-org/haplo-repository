/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var CURRENCY_SUFFIXES = {
    "m": O.bigDecimal(1000000),
    "b": O.bigDecimal(1000000000)
};

var CanViewAPCDashboards = O.action("hres_repo_apc:view_dashboards").
    title("View APC Dashboards").
    allow("group", Group.RepositoryEditors);

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("hasAPC",          "boolean",   "APC").
        fact("apcCurrency",     "text",      "Currency").
        fact("apcCostNoVAT",    "numeric",   "Cost exc. VAT").
        fact("apcCostVAT",      "numeric",   "Cost inc. VAT").
        fact("apcFund",         "text",      "Fund").
        fact("apcPaymentDate",  "date",      "Payment Date").
        fact("apcOtherCosts",   "numeric",   "Additional costs").
        statistic({
            name: "apcTotalCost",
            description: "Total APC cost",
            fact: "apcCostVAT",
            aggregate: "SUM",
            formatter: function(value) {
                if(!value) {
                    return "£0";
                }
                var suffix = "";
                _.each(CURRENCY_SUFFIXES, function(threshold, shorthand) {
                    if(value.compareTo(threshold) > 0) {
                        suffix = shorthand;
                    }
                });
                var val = value;
                if(suffix) {
                    val = val.divide(CURRENCY_SUFFIXES[suffix]);
                }
                return val.format("£0.00"+suffix);
            }
        });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    row.hasAPC = false;
    var formInstance = P.apcFormStore.instance(object);
    if(formInstance && formInstance.hasCommittedDocument) {
        var lastCommittedDocument = formInstance.lastCommittedDocument;
        row.hasAPC = true;
        row.apcCurrency = lastCommittedDocument.currency || "";
        row.apcCostNoVAT = O.bigDecimal(lastCommittedDocument.costNoVAT);
        row.apcCostVAT = O.bigDecimal(lastCommittedDocument.costVAT);
        row.apcFund = lastCommittedDocument.fund || "";
        row.apcPaymentDate = new Date(lastCommittedDocument.paymentDate);
        if(lastCommittedDocument.otherCosts) {
            row.apcOtherCosts = _.reduce(lastCommittedDocument.otherCosts, function(memo, costRow) {
                if(costRow.otherCost) {
                    return O.bigDecimal(costRow.otherCost).add(memo);
                }
                return memo;
            }, O.bigDecimal(0));
        }
    }
});

P.implementService("std:reporting:dashboard:oa_repository_items:setup", function(dashboard) {
    dashboard.columns(300, [{fact:"hasAPC", heading:"Has APC"}]);
});

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(CanViewAPCDashboards)) {
        builder.panel(600).
            link(2000, "/do/hres-repo-apc/repository-items/all", "APCs overview");
    }
});

P.respond("GET,POST", "/do/hres-repo-apc/repository-items", [
    {parameter:"year", as:"int", optional:true}
], function(E, year) {
    CanViewAPCDashboards.enforce();

    var columns =  [
        {fact: "author", link:true},
        "type",
        {fact: "publisher", link:true},
        "apcCurrency",
        {fact: "apcCostNoVAT", formatter:"#,##0.00"},
        {fact: "apcCostVAT", formatter:"£#,##0.00"},
        "apcFund",
        "apcPaymentDate",
        {fact: "apcOtherCosts", formatter:"£#,##0.00"}
    ];
    P.reporting.dashboard(E, {
        kind: "list",
        collection: "repository_items",
        name: "apc_repository_items",
        title: "APCs overview"
    }).
        use("hres:schema:calendar_year_navigation", year, "year").
        filter(function(select) {
            select.where("hasAPC", "=", true);
        }).
        summaryStatistic(100, "apcTotalCost").
        columns(0, [{fact:"ref", heading:"Output", link:true}]).
        columns(200, columns).
        respond();
});