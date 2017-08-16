/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.webPublication.pagePart({
    name: "hres:repository:output:permalink",
    category: "hres:repository:output:below",
    sort: 1000,
    deferredRender: function(E, context, options) {
        if(context.object) {
            return P.template("output/permalink").deferredRender({
                permalink: context.publishedObjectUrl(context.object)
            });
        }
    }
});

// --------------------------------------------------------------------------

P.webPublication.pagePart({
    name: "hres:repository:output:related",
    category: "hres:repository:output:sidebar",
    sort: 3000,
    deferredRender: function(E, context, options) {
        if(context.object) {
            var authors = _.filter(context.object.every(A.Author), function(a) { return O.isRef(a); });
            if(authors.length === 0) { return; }
            return P.template("output/related").deferredRender({
                related: _.map(O.query().
                    link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
                    link(authors, A.Author).
                    sortByDate().limit(5).
                    execute(), function(output) {
                        return {
                            output: output,
                            href: context.publishedObjectUrlPath(output),
                            citation: O.service("hres_bibliographic_reference:for_object", output)
                        };
                    }
                )
            });
        }
    }
});
