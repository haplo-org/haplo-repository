/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Misc parts do not have a category, alias or add to categories.

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-parts:misc:recent-additions",
    "misc/recent-additions"
);

P.webPublication.pagePart({
    name: "hres:repository:misc:recent-additions",
    sort: 1000000,
    deferredRender: function(E, context, options) {
        var view = {
            outputs: _.map(O.query().
                link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
                limit(5).
                sortByDate().
                execute(), function(output) {
                    return {
                        output: output,
                        href: context.publishedObjectUrlPath(output),
                        citation: O.service("hres_bibliographic_reference:for_object", output)
                    };
                }
            )
        };
        var template = context.publication.getReplaceableTemplate("hres:repo-publication-parts:misc:recent-additions");
        return template.deferredRender(view);
    }
});
