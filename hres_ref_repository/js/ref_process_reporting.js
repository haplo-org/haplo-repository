/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// --------------------------------------------------------------------------
// Research outputs

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("refMeetsResearchDefinition",   "boolean",      "Meets the REF definition of research");
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    row.refMeetsResearchDefinition = object.has(O.behaviourRef("hres:list:ref-research-definition:research"), A.REFResearch);
});

// --------------------------------------------------------------------------
// Researchers

P.implementService("std:reporting:collection:researchers:setup", function(collection) {
    collection.
        fact("refTotalResearchOutputs", "int",          "Total REF research outputs").
        fact("refCountOutputs",             "int",      "Total outputs");
});

P.implementService("std:reporting:collection:researchers:get_facts_for_object", function(object, row) {
    row.refTotalResearchOutputs = O.query().link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
        link(object.ref).   // Any attribute link
        link(O.behaviourRef("hres:list:ref-research-definition:research"), A.REFResearch).
        execute().
        length;
    row.refCountOutputs = O.query().link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), A.Type).
        link(object.ref).   // Any attribute link
        execute().
        length;
});

P.implementService("std:reporting:dashboard:ref_eligibility:setup", function(dashboard) {
    dashboard.columns(125, ["refTotalResearchOutputs", "refCountOutputs"]);
});

// --------------------------------------------------------------------------
// Dashboards

// This may deny access to everyone, if hres_ref_process_management is not installed in this application
var ViewREFProcessReports = O.action("hres_ref_process_management:view_reports");

P.implementService("std:action_panel:activity:menu:ref", function(display, builder) {
    if(O.currentUser.allowed(ViewREFProcessReports)) {
        let panel = builder.panel(20);
        panel.link(150, "/do/hres-ref-repo/ref-research", "Outputs meeting REF definition of research");
    }
});

P.respond("GET,POST", "/do/hres-ref-repo/ref-research", [
], function(E) {
    ViewREFProcessReports.enforce();
    P.reporting.dashboard(E, {
        kind: "list",
        collection: "repository_items",
        name: "ref_research",
        title: "Outputs meeting REF definition of research"
    }).
        filter((select) => {
            select.where("refMeetsResearchDefinition", "=", true);
        }).
        use("std:row_text_filter", {facts:["ref"], placeholder:"Search"}).
        use("std:row_object_filter", {fact:"refUnitOfAssessment", objects:T.REFUnitOfAssessment}).
        columns(10, [
            {type:"linked", style:"wide", column:{fact:"ref", heading:"Repository item"}}
        ]).
        columns(100, [
            "type",
            "author",
            "refUnitOfAssessment"
        ]).
        respond();
});