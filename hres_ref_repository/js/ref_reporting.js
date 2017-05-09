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
});

// ------------------------------------------------------------

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
