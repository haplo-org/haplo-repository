/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-parts:person:outputs",
    "person/outputs"
);

P.webPublication.pagePart({
    name: "hres:repository:person:outputs",
    category: "hres:repository:person:below",
    sort: 2000,
    deferredRender: function(E, context, options) {
        if(context.object) {
            var outputs = O.serviceMaybe("hres:repo-publication-parts-person:get-ordered-outputs-for-researcher", context.object.ref);
            if(!outputs) {
                outputs = O.query().
                    link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
                    anyLabel([Label.AcceptedIntoRepository]).
                    or(function(subquery) {
                        subquery.link(context.object.ref, A.Author).
                                 link(context.object.ref, A.Editor);
                    }).
                    sortByDate().
                    execute();
                outputs = _.sortBy(outputs, (o) => {
                    var date = O.service("hres:repository:earliest_publication_date", o) ||
                        o.first(A.PublicationProcessDates, Q.Deposited) ||
                        o.first(A.Date) ||
                        o.creationDate;
                    if(date.start) { date = date.start; }
                    return -1*date.getTime();
                });
            }
            var types = [],
                seen = [];
            var displayOutputs = _.map(outputs, function(output) {
                    var typeStr = output.firstType().toString();
                    if(-1 === seen.indexOf(typeStr)) {
                        types.push({
                            type: typeStr,
                            title: SCHEMA.getTypeInfo(output.firstType()).name
                        });
                        seen.push(typeStr);
                    }
                    return {
                        output: output,
                        href: context.publishedObjectUrlPath(output),
                        citation: O.service("hres_bibliographic_reference:for_object", output),
                        type: typeStr
                    };
                }
            );
            var sortedTypes = _.sortBy(types, "title");
            if(displayOutputs.length === 0) { return; }
            var template = context.publication.getReplaceableTemplate("hres:repo-publication-parts:person:outputs");
            return template.deferredRender({
                outputs: displayOutputs,
                types: sortedTypes
            });
        }
    }
});
