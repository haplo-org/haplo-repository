/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.webPublication.pagePart({
    name: "hres:repository:person:outputs",
    category: "hres:repository:person:sidebar",
    sort: 2000,
    deferredRender: function(E, context, options) {
        if(context.object) {
            var outputs = _.map(O.query().
                link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
                link(context.object.ref, A.Author).
                sortByDate().
                execute(), function(output) {
                    return {
                        output: output,
                        href: context.publishedObjectUrlPath(output),
                        citation: O.service("hres_bibliographic_reference:for_object", output)
                    };
                }
            );
            if(outputs.length === 0) { return; }
            return P.template("person/outputs").deferredRender({outputs:outputs});
        }
    }
});
