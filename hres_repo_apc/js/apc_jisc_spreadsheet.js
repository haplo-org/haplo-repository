/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var CanViewRepositoryDashboards = O.action("hres:action:repository:view-overview-dashboards");

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(CanViewRepositoryDashboards)) {
        builder.panel(1500).
        link(100, "/do/hres-repo-apc/export", "JISC APC Spreadsheet");
    }
});

P.respond("GET", "/do/hres-repo-apc/export", [
], function(E) {
    E.response.body = createExportXls();
});

var EXPORT_HEADINGS = [
    "Publication acceptance date",
    "PubMed ID",
    "DOI",
    "Publisher",
    "Journal",
    "ISSN",
    "Publication type",
    "Title",
    "Date of Publication",
    "Fund that APC is paid from (1)",
    "Fund that APC is paid from (2)",
    "Fund that APC is paid from (3)",
    "Funder of research (1)",
    "Grant ID (1)",
    "Funder of research (2)",
    "Grant ID (2)",
    "Funder of research (3)",
    "Grant ID (3)",
    "Date of APC payment",
    "APC cost (exc. VAT)",
    "APC currency",
    "APC paid (£) including VAT if charged",
    "Additional Publication costs (£)",
    "Discounts, memberships & pre-payment agreements",
    "Amount of APC charged to COAF grant (including VAT if charged) in £",
    "Amount of APC charged to RCUK OA fund (including VAT if charged) in £",
    "Licence"
];

var createExportXls = function() {
    var user = O.currentUser;
    var xls = O.generate.table.xls("JISC APC export");
    xls.newSheet("Export");

    _.each(EXPORT_HEADINGS, function(heading) {
        xls.cell(heading);
    });

    var rows = P.reporting.collection("repository_items").selectAllCurrentRows().
        where("hasAPC", "=", true);

    _.each(rows, function(row) {
        var output = row.ref.load();
        var funders = output.every(A.Funder);
        var project = output.first(A.Project);
        var grantIds = project ? project.load().every(A.GrantID) : [];
        xls.nextRow().
            cell(row.publicationAcceptanceDate ? new XDate(row.publicationAcceptanceDate).toString("yyyy-MM-dd") : "").
            cell(""). //TODO: PubMed ID
            cell(row.doi).
            cell(row.publisher).
            cell(row.journal).
            cell(row.issn).
            cell(row.type).
            cell(output.title).
            cell(row.publishedDate ? new XDate(row.publishedDate).toString("yyyy-MM-dd") : "").
            cell(row.apcFund).
            cell(""). //TODO: APC Fund 2
            cell(""). //TODO: APC Fund 3
            cell(funders ? funders[0] : "").
            cell(grantIds ? grantIds[0] : "").
            cell(funders ? funders[1] : ""). 
            cell(grantIds ? grantIds[1] : "").
            cell(funders ? funders[2] : ""). 
            cell(grantIds ? grantIds[2] : "").
            cell(row.apcPaymentDate ? new XDate(row.apcPaymentDate).toString("yyyy-MM-dd") : "").
            cell(row.apcCostNoVAT).
            cell(row.apcCurrency).
            cell(row.apcCostVAT).
            cell(row.apcOtherCosts).
            cell(""). //TODO: Discounts, memberships, pre-payment agreements
            cell(""). //TODO: APC charged to COAF
            cell(""). //TODO: APC charged to RCUK OA fund
            cell(row.license);
    });

    xls.finish();
    return xls;
};