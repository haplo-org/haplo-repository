/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */



var CanViewRepositoryDashboards = O.action("hres:action:repository:view-overview-dashboards");

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(CanViewRepositoryDashboards)) {
        var panel = builder.panel(500);
        panel.link(600, "/do/hres-repository-schema/outputs-in-press", "Outputs in press");
    }
});

// -------- Reporting ---------------------------------

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("publicationAcceptanceDate", "date", "Accepted").
        fact("publicationDepositedDate", "date", "Deposited").
        fact("hasPublishersVersion",       "boolean",  "Has Publisher's version").
        fact("hasAuthorAcceptedManuscript", "boolean", "Has AAM").
        fact("outputStatus",                "ref",    "Output Status");
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    var publicationAcceptance = object.first(A.PublicationProcessDates, Q.Accepted);
    if(publicationAcceptance) {
        row.publicationAcceptanceDate = publicationAcceptance.start;
    }
    var publicationDeposited = object.first(A.PublicationProcessDates, Q.Deposited);
    if(publicationDeposited) {
        row.publicationDepositedDate = publicationDeposited.start;
    }
    var aam = !!object.getAttributeGroupIds(A.AcceptedAuthorManuscript).length;
    if(aam) {
        row.hasAuthorAcceptedManuscript = true;
    }
    var vor = !!object.getAttributeGroupIds(A.PublishersVersion).length;
    if(vor) {
        row.hasPublishersVersion = true;
    }
    var outputStatus = object.first(A.OutputStatus);
    if(outputStatus) {
        row.outputStatus = outputStatus;
    }
});

P.implementService("std:reporting:dashboard:ref_non_compliance:setup", function(dashboard) {
    dashboard.columns(15, ["publicationAcceptanceDate", "publicationDepositedDate"]);
});

P.respond("GET,POST", "/do/hres-repository-schema/outputs-in-press", [
], function(E) {
    CanViewRepositoryDashboards.enforce();
    P.reporting.dashboard(E, {
        kind:"list",
        collection: "repository_items",
        name: "outputs_in_press",
        title: "Outputs in press"
    }).
    filter(function(select) {
        select.where("outputStatus", "=", O.behaviourRef("hres:list:output-status:in-press"));
    }).
        use("std:row_text_filter", {facts:["author", "title"], placeholder:"Search"}).
        summaryStatistic(0, "count").
        columns(10, [
            {fact:"ref", heading:"Item", link:true}
        ]).
        columns(100, [
            {fact:"author", link:true, heading: "Author"},
            "department",
            "journal",
            {fact: "publicationAcceptanceDate", heading: "Acceptance Date"}
        ]).
        respond();
 });

P.implementService("std:reporting:dashboard:repository_overview:setup_export", function(dashboard) {
    dashboard.columns(95, ["publicationAcceptanceDate", "publicationDepositedDate"]);
});
P.implementService("std:reporting:dashboard:outputs_in_progress:setup_export", function(dashboard) {
    dashboard.columns(160, ["publicationAcceptanceDate", "publicationDepositedDate"]);
});

// ---------- Permissions ------------------------------

P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    setup.groupRestrictionLabel(Group.RepositoryEditors, Label.ViewPreparedFiles);
});

P.hook('hObjectAttributeRestrictionLabelsForUser', function(response, user, object) {
    if(O.serviceMaybe("hres:repository:is_author", user, object)) {
        response.userLabelsForObject.add(Label.ViewPreparedFiles);
    }
});

// ---------- Demo data ------------------------------

P.implementService("hres_repository:test_data:pre_item_save", function(generator, repositoryItem) {
    var funderDistribution = [
        0.8, generator.randomListMember(generator.funders),
        0.9, generator.randomProjectName(),
        1, null
    ];

    var appendDateWithProbablility = function(probability, object, desc, qual) {
        if(Math.random() < probability) {
            object.append(O.datetime(generator.randomDateInPeriod(-54,6,"day"),null,O.PRECISION_DAY), desc, qual);
        }
    };    
    
    var f = generator.randomDistributedValue(funderDistribution);
    if(f) { repositoryItem.append(f, A.Funder); }
    appendDateWithProbablility(0.1, repositoryItem, A.PublicationProcessDates, Q.Completed);
    appendDateWithProbablility(0.7, repositoryItem, A.PublicationProcessDates, Q.Accepted);
    appendDateWithProbablility(0.2, repositoryItem, A.PublicationProcessDates, Q.Deposited);
});
