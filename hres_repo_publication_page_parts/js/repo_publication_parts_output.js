/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-parts:output:permalink",
    "output/permalink"
);

P.webPublication.pagePart({
    name: "hres:repository:output:permalink",
    category: "hres:repository:output:below",
    sort: 9000,
    deferredRender: function(E, context, options) {
        if(context.object) {
            var template = context.publication.getReplaceableTemplate("hres:repo-publication-parts:output:permalink");
            return template.deferredRender({
                permalink: context.publishedObjectUrl(context.object)
            });
        }
    }
});

// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-parts:output:edit-link",
    "output/edit-link"
);

P.webPublication.pagePart({
    name: "hres:repository:output:edit-link",
    category: "hres:repository:output:below",
    sort: 10000,
    deferredRender: function(E, context, options) {
        if(context.object) {
            var template = context.publication.getReplaceableTemplate("hres:repo-publication-parts:output:edit-link");
            return template.deferredRender({
                href: context.object.url(true)
            });
        }
    }
});

// --------------------------------------------------------------------------


P.webPublication.feature("hres:repository:output:zip-downloads", function(publication) {
    publication.respondToDirectory("/zip-file-download",
        function(E, context) {
            var ref = (E.request.extraPathElements[0] || null);
            if(!ref || !O.ref(ref)) { return; }
            var output = O.ref(ref).load();
            E.response.body = O.service("hres:repository:zip_output_files", output);
    });
    
    P.webPublication.registerReplaceableTemplate(
        "hres:repo-publication-parts:output:download-zip",
        "output/download-zip"
    );

    P.webPublication.pagePart({
        name: "hres:repository:output:download-zip-files",
        sort: 360,
        deferredRender: function(E, context, options) {
            if(context.object) {
                var files = O.serviceMaybe("hres:repository:zip_output_files", context.object);
                if(files.count > 0) {
                    var template = context.publication.getReplaceableTemplate("hres:repo-publication-parts:output:download-zip");
                    return template.deferredRender({
                        href: "/zip-file-download/"+context.object.ref
                    });
                }
            }
        }
    });
});

// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-parts:output:related",
    "output/related"
);

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
                    var file;
                    var restricted = output.restrictedCopy(O.currentUser);
                    restricted.every((v,d,q) => {
                        if(!file && O.typecode(v) === O.T_IDENTIFIER_FILE) {
                            file = v;
                        }
                    });
                    return {
                        output: output,
                        typeInfo: SCHEMA.getTypeInfo(output.firstType()),
                        citation: O.service("hres_bibliographic_reference:for_object", output),
                        file: file
                    };
                }
            );
            var template = context.publication.getReplaceableTemplate("hres:repo-publication-parts:output:related");
            return template.deferredRender({
                related: _.filter(alsoAuthored, (a) => (a.output.ref != context.object.ref))
            });
        }
    }
});

// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-parts:output:share-panel",
    "output/share-panel"
);

P.webPublication.pagePart({
    name: "hres:repository:output:share-panel",
    category: "hres:repository:output:sidebar",
    sort: 2000,
    deferredRender: function(E, context, options) {
        if(context.object) {
            var output = context.object;
            var citation = O.service("hres_bibliographic_reference:for_object", output);
            var template = context.publication.getReplaceableTemplate("hres:repo-publication-parts:output:share-panel");
            return template.deferredRender({
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
