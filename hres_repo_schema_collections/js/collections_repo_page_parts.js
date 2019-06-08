/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


if(O.featureImplemented("std:web-publisher")) {

    P.use("std:web-publisher");

    P.webPublication.registerReplaceableTemplate(
        "hres:repo-schema-collections:output:collection-items",
        "page-part/collection-items"
    );

    var deferredCollectionItemRenders = function(context, collection) {
        return _.compact(_.map(collection.every(A.CollectionItem), function(o) {
            if(O.currentUser.canRead(o)) {
                var output = o.load();
                return {
                    output: output,
                    href: context.publishedObjectUrlPath(output),
                    citation: O.service("hres_bibliographic_reference:for_object", output)
                };
            }
        }));
    };

    P.webPublication.pagePart({
        name: "hres:repository:output:collection-items",
        deferredRender: function(E, context, options) {
            if(context.object && context.object.isKindOf(T.Collection)) {
                var template = context.publication.getReplaceableTemplate("hres:repo-schema-collections:output:collection-items");
                var typeInfo = SCHEMA.getTypeInfo(context.object.firstType());
                return template.deferredRender({
                    title: typeInfo.name+" items",
                    items: deferredCollectionItemRenders(context, context.object)
                });
            }
        }
    });

    P.webPublication.pagePart({
        name: "hres:repository:output:parent-collection-items",
        category: "hres:repository:output:sidebar",
        sort: 600,
        deferredRender: function(E, context, options) {
            if(context.object) {
                var containingCollections = O.query().
                    link(T.Collection, A.Type).
                    link(context.object.ref, A.CollectionItem).
                    execute();
                if(containingCollections.length) {
                    var template = context.publication.getReplaceableTemplate("hres:repo-schema-collections:output:collection-items");
                    var typeInfo = SCHEMA.getTypeInfo(context.object.firstType());
                    return template.deferredRender({
                        title: "Explore this "+typeInfo.name.toLowerCase(),
                        items: _.filter(deferredCollectionItemRenders(context, containingCollections[0]),
                            (i) => (i.output.ref != context.object.ref)
                        )
                    });
                }
            }
        }
    });

}
