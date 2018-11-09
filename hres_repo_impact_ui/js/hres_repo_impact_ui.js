/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanAddImpact = O.action("hres:repository:impact:add_impact").
    title("Add repository impact and evidences").
    allow("group", Group.RepositoryEditors);

P.implementService("hres_repo_navigation:repository_item_page", function(object, builder) {
    if((O.currentUser.ref == object.ref) || O.currentUser.allowed(CanAddImpact)) {
        builder.sidebar.panel(400).link("default",
            "/do/edit?new="+T.Impact, "Add impact", "primary");
    }
});

// --------------------------------------------------------------------------

P.hook("hObjectDisplay", function(response, object) {
    if(!object.isKindOf(T.Impact)) { return; }
    if(!O.currentUser.can("update", object.ref)) { return; }
    response.buttons["*IMPACTEVIDENCE"] =
        [["/do/hres-repo-impact-ui/add-evidence/"+object.ref, "Add evidence"]];
});


P.hook("hPostObjectEdit", function(response, object, previous) {
    if(!object.isKindOf(T.ImpactEvidence)) { return; }
    if(!previous && object.first(A.Impact)) {
        let impact = object.first(A.Impact);
        response.redirectPath = "/do/hres-repo-impact-ui/further-evidence/"+impact;
    }
});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/hres-repo-impact-ui/add-evidence", [
    {pathElement:0, as:"object"}
], function(E, impact) {
    let templateObj = O.object();
    templateObj.appendType(T.ImpactEvidence);
    templateObj.append(impact, A.Impact);
    E.render({
        pageTitle: "Add evidence - "+impact.title,
        backLink: impact.url(),
        templateObject: templateObj
    }, "std:new_object_editor");
});

P.respond("GET", "/do/hres-repo-impact-ui/further-evidence", [
    {pathElement:0, as:"object"}
], function(E, impact) {
    let evidences = O.query().link(T.ImpactEvidence, A.Type).
        link(impact.ref, A.Impact).
        sortBy("date").
        execute();
    E.render({
        impact: impact,
        evidences: evidences,
        options: [
            {
                action: impact.url(),
                label: "Done",
                indicator: "primary",
                notes: "Return to impact."
            },
            {
                action: "/do/hres-repo-impact-ui/add-evidence/"+impact.ref,
                label: "Add further evidence",
                indicator: "standard",
                notes: "Add additional evidence for the impact."
            }
        ]
    });
});

// --------------------------------------------------------------------------

P.element("impact_evidence", "Impact evidence listing", function(L) {
    let impact = L.object.ref;
    let evidences = O.query().
        link(T.ImpactEvidence, A.Type).
        link(impact, A.Impact).
        sortBy("date").
        execute();
    L.render({ evidences: evidences });
});
