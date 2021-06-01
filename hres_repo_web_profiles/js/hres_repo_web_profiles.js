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
    var outputObjects = [];
    var orderedOutputs = [];
    outputObjects = O.query().
        link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
        or(function(subquery) {
            subquery.link(researcher, A.Author).
                 link(researcher, A.Editor);
        }).
        sortByDate().
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
            return {
                ref:output.ref.toString(),
                title:output.title,
                citation:O.serviceMaybe("hres_bibliographic_reference:for_object", output)
            };
        })
    }, "edit-outputs-preferred-order");
});

P.implementService("hres:repo-publication-parts-person:get-ordered-outputs-for-researcher", function(researcher) {
    var outputsOrderRow = P.db.outputsOrder.select().where("researcher","=",researcher)[0];
    if(outputsOrderRow) {
        return P.orderedOutputsForResearcherYieldingLookup(researcher, JSON.parse(outputsOrderRow.order));
    }
});

P.implementService("hres_repo_navigation:repository_item_page", function(object, builder) {
    if(O.currentUser.ref == object.ref) {
        builder.sidebar.panel(500).link("default", "/do/hres-repo-web-profiles/edit-outputs-preferred-order/"+object.ref, "Reorder outputs for web profile");
    }
});

P.respond("GET,POST", "/do/hres-repo-web-profiles/migrate-preferred-orders", [
], function(E) {
    if(!O.currentUser.isSuperUser) { O.stop("Not permitted"); }
    let existingEntries = O.serviceMaybe("hres:repo_web_profiles:get_existing_ordered_outputs_entries");
    if(E.request.method === "POST") {
        _.each(existingEntries, (entry) => {
            if(entry.order) {
                P.db.outputsOrder.create(entry).save();
            }
        });
    }
    E.render({
        pageTitle: "Migration: Move preferred outputs from old to new version",
        text: "There are "+existingEntries.length+" users who have existing preferred orders for their outputs."+
            " Please confirm you would like to migrate these entries?",
        options: [
            {
                action: "/do/hres-repo-web-profiles/migrate-preferred-orders",
                label: "Migrate now"
            }
        ]
    }, "std:ui:confirm");
});

// --------------------------------------------------------------------------

var orderedOutputsForResearcherOrReversePublicationOrder = P.orderedOutputsForResearcherOrReversePublicationOrder = function(researcher) {
    var outputsOrderRow = P.db.outputsOrder.select().where("researcher","=",researcher.ref)[0];
    let outputs;
    if(outputsOrderRow) {
        outputs = P.orderedOutputsForResearcherYieldingLookup(researcher.ref, JSON.parse(outputsOrderRow.order));
    } else {
        let linkedOutputs = O.query().
            link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
            anyLabel([Label.AcceptedIntoRepository]).
            or(function(subquery) {
                subquery.link(researcher.ref, A.Author).
                    link(researcher.ref, A.Editor);
            }).
            sortByDate().
            execute();
        outputs = _.sortBy(linkedOutputs, (o) => {
            var date = O.service("hres:repository:earliest_publication_date", o) ||
                o.first(A.PublicationProcessDates, Q.Deposited) ||
                o.first(A.Date) ||
                o.creationDate;
            if(date.start) { date = date.start; }
            return -1*date.getTime();
        });
    }
    return outputs;
};

P.implementService("hres_repo_web_profiles:ordered_outputs_for_researcher_or_reverse_publication_order",
    orderedOutputsForResearcherOrReversePublicationOrder);

if(O.featureImplemented("hres:researcher-profile")) {

    P.use("hres:researcher-profile");

    P.researcherProfile.renderedSection({
        name: "outputs",
        sort: 99999,
        title: "Publications",
        includeInExport: true,
        editLink: function(profile) {
            return "/do/hres-repo-web-profiles/edit-outputs-preferred-order/"+profile.researcher.ref;
        },
        deferredRender: function(profile) {
            var outputs = orderedOutputsForResearcherOrReversePublicationOrder(profile.researcher);
            return P.template("export/outputs").deferredRender({
                outputs: _.map(outputs, function(o) {
                    return O.service("hres_bibliographic_reference:for_object", o);
                })
            });
        },
        deferredRenderForExport: function(profile) {
            var outputs = orderedOutputsForResearcherOrReversePublicationOrder(profile.researcher);
            var outputsByType = O.refdictHierarchical(function() { return []; });
            _.each(outputs, function(o) {
                var outputsOfThisType = outputsByType.get(o.firstType());
                outputsOfThisType.push(o);
                outputsByType.set(o.firstType(), outputsOfThisType);
            });
            var outputTypeSections = [];
            var prioritisedTypes = O.serviceMaybe("hres:repository:ingest_ui:types");
            if(prioritisedTypes) {
                var orderedTypes = prioritisedTypes.primaryTypes.concat(prioritisedTypes.secondaryTypes);
                _.each(orderedTypes, function(typeInfo) {
                    var opsForType = outputsByType.get(typeInfo.ref);
                    if(opsForType.length) {
                        outputTypeSections.push({
                            heading: typeInfo.name,
                            outputs: _.map(opsForType, function(o) {
                                return O.service("hres_bibliographic_reference:for_object", o);
                            })
                        });
                    }
                });
            } else {
                outputsByType.each(function(type, outputs) {
                    outputTypeSections.push({
                        heading: type.load().title,
                        outputs: _.map(outputs, function(o) {
                            return O.service("hres_bibliographic_reference:for_object", o);
                        })
                    });
                });
            }
            return P.template("export/outputs-for-exports").deferredRender({
                sections: outputTypeSections
            });
        }
    });
}
