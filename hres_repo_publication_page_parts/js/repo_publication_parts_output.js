/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.webPublication.pagePart({
    name: "hres:repository:output:permalink",
    category: "hres:repository:output:below",
    sort: 9000,
    deferredRender: function(E, context, options) {
        if(context.object) {
            return P.template("output/permalink").deferredRender({
                permalink: context.publishedObjectUrl(context.object)
            });
        }
    }
});

// --------------------------------------------------------------------------

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
            return P.template("output/collection-items").deferredRender({
                title: "Collection items",
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
                return P.template("output/collection-items").deferredRender({
                    title: "Explore this collection",
                    items: _.filter(deferredCollectionItemRenders(context, containingCollections[0]),
                        (i) => (i.output.ref != context.object.ref)
                    )
                });
            }
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
            var alsoAuthored = _.map(O.query().
                link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
                link(authors, A.Author).
                sortByDate().
                execute(), function(output) {
                    return {
                        output: output,
                        href: context.publishedObjectUrlPath(output),
                        citation: O.service("hres_bibliographic_reference:for_object", output)
                    };
                }
            );
            return P.template("output/related").deferredRender({
                related: _.filter(alsoAuthored, (a) => (a.output.ref != context.object.ref))
            });
        }
    }
});

// --------------------------------------------------------------------------

P.webPublication.pagePart({
    name: "hres:repository:output:share-panel",
    category: "hres:repository:output:sidebar",
    sort: 2900,
    deferredRender: function(E, context, options) {
        if(context.object) {
            var output = context.object;
            var citation = O.service("hres_bibliographic_reference:for_object", output);
            return P.template("output/share-panel").deferredRender({
                email: {
                    subject: output.title,
                    body: context.publishedObjectUrl(output)
                },
                twitter: {
                    baseUrl: "https://twitter.com/home?status=",
                    body: output.title+" "+context.publishedObjectUrl(output)
                }
            });
        }
    }
});
