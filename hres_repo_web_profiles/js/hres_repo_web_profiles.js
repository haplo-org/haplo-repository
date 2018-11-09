/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.db.table("outputsOrder", {
    researcher: { type:"ref" },
    order: { type:"text" }
});

P.orderedOutputsForResearcherYieldingLookup = function(researcher, preferredOutputsOrder, yieldTo) {

    var outputObjects = [], orderedOutputs = [];

    outputObjects = O.query().
                link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
                or(function(subquery) {
                    subquery.link(researcher, A.Author).
                             link(researcher, A.Editor);
                }).
                execute();

    var outputsLookup = {};
    _.each(outputObjects, function(output) {
        outputsLookup[output.ref.toString()] = output;
    });

    if(yieldTo) {
        yieldTo(outputsLookup);
    }

    _.each(preferredOutputsOrder, function(refStr) {
        var output = outputsLookup[refStr];
        if(output) {
            orderedOutputs.push(output);
            delete outputsLookup[refStr];
        }
    });

    _.each(outputsLookup, function(output) {
        orderedOutputs.push(output);
    });
    
    return orderedOutputs;
};

P.respond("GET,POST", "/do/hres-repo-web-profiles/edit-outputs-preferred-order", [
    {pathElement:0, as:"object"},
    {parameter:"updated", as:"int", optional:true},
    {parameter:"outputs", as:"string", optional:true}
], function(E, researcher, updated, outputsOrderStr) {
    if(researcher.ref != O.currentUser.ref) { O.stop("Not permitted"); }

    var outputsOrderRow = P.db.outputsOrder.select().where("researcher","=",researcher.ref)[0];
    var preferredOutputsOrder = [];
    if(outputsOrderRow) {
        preferredOutputsOrder = JSON.parse(outputsOrderRow.order);
    }

    var orderedOutputs = P.orderedOutputsForResearcherYieldingLookup(researcher.ref, preferredOutputsOrder, function(outputsLookup) {
        if(outputsOrderStr && E.request.method === "POST") {
            var checkedOutputs = [];
            outputsOrderStr.split(',').forEach(function(refStr) {
                if(outputsLookup[refStr]) { checkedOutputs.push(refStr); }
            });
    
            if(outputsOrderRow) {
                outputsOrderRow.order = JSON.stringify(checkedOutputs);
                outputsOrderRow.save();
            } else {
                P.db.outputsOrder.create({
                    researcher: researcher.ref,
                    order: JSON.stringify(checkedOutputs)
                }).save();
            }
        } 
    });

    if(E.request.method === "POST") {
        return E.response.redirect("/do/hres-repo-web-profiles/edit-outputs-preferred-order/"+researcher.ref+"?updated=1");
    }

    E.render({
        pageTitle: "Set preferred order for outputs",
        updated: !!updated,
        backLink: "/do/repository/outputs/researcher/"+researcher.ref,
        outputs: _.map(orderedOutputs, function(output) {
            return {ref:output.ref.toString(), title:output.title};
        })
    }, "edit-outputs-preferred-order");
});

P.implementService("hres:repo-publication-parts-person:get-ordered-outputs-for-researcher", function(researcher) {
    var outputsOrderRow = P.db.outputsOrder.select().where("researcher","=",researcher)[0];
    var outputsOrder;
    if(outputsOrderRow) {
        outputsOrder = JSON.parse(outputsOrderRow.order);
    }
    return P.orderedOutputsForResearcherYieldingLookup(researcher, outputsOrder);
});

P.implementService("hres_repo_navigation:repository_item_page", function(object, builder) {
    if(O.currentUser.ref == object.ref) {
        builder.sidebar.panel(500).link("default", "/do/hres-repo-web-profiles/edit-outputs-preferred-order/"+object.ref, "Reorder outputs for web profile");
    }
});

// --------------------------------------------------------------------------

P.implementService("hres_researcher_profile:export:additional_sections",
    function(researcher, sections) {
        var outputs = [];
        if(O.serviceImplemented("hres:repo-publication-parts-person:get-ordered-outputs-for-researcher")) {
            outputs = O.service("hres:repo-publication-parts-person:get-ordered-outputs-for-researcher", 
                researcher.ref);
        } else {
            outputs = O.query().
            link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
            or(function(subquery) {
                subquery.link(researcher.ref, A.Author).
                    link(researcher.ref, A.Editor);
            }).
            sortByDate().
            execute();
        }
        sections.push({
            title: "Publications",
            deferredRender: P.template("export/outputs").deferredRender({
                outputs: _.map(outputs, (o) => {
                    return {
                        output: o,
                        citation: O.service("hres_bibliographic_reference:for_object", o)
                    };
                })
            })
        });
    }
);
