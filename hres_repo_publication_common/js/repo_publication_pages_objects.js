/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// --------------------------------------------------------------------------
//   OUTPUT (REPOSITORY ITEM) OBJECTS
// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:page:output",
    "pages/output"
);

var ADMIN_ATTRS = [
    A.PeerReview, A.PublishedVersionOfRecord,
    A.ResearchInstitute, A.OriginalResearchInstitute
];
if("REFUnitOfAssessment" in A) {
    ADMIN_ATTRS.push(A.REFUnitOfAssessment);
}
if("FileAccessLevel" in A) {
    ADMIN_ATTRS.push(A.FileAccessLevel);
}

P.webPublication.feature("hres:repository:common:output", function(publication, spec) {

    spec = spec || {};
    var path = spec.path || '/item';
    var withoutAttributes = spec.withoutAttributes ? ADMIN_ATTRS.concat(spec.withoutAttributes) : ADMIN_ATTRS;

    publication.respondWithObject(path,
        SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'),
        function(E, context, object) {
            context.hint.objectKind = 'output';

            var widget = P.webPublication.widget.object(object).
                withoutAttributes(withoutAttributes);

            if(spec.onlyAttributes !== undefined) {
                widget.onlyAttributes(spec.onlyAttributes);
            }
            var view = {
                object: widget,
                citation: O.service("hres_bibliographic_reference:for_object", object)
            };

            if(spec.mediaDisplay) {

                var objectsToSearchForImages = [object];

                if(("Collection" in T) && object.isKindOf(T.Collection)) {
                    context.hint.isCollection = true;
                    // Want to look in the collection members for images
                    object.every(A.CollectionItem, (v,d,q) => {
                        if(O.isRef(v)) {
                            try {
                                objectsToSearchForImages.push(v.load());
                            } catch(e) {
                                // Ignore: Exceptions will be permissions errors, most likely because
                                // someone has added a draft item to the collection.
                            }
                        }
                    });
                }

                // Find images to display in lightbox.
                var images = [];
                objectsToSearchForImages.forEach((o) => {
                    o.every((v,d,q) => {
                        if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                            var deferred = context.publication.deferredRenderImageFileTag(v, {
                                maxWidth: 160,
                                maxHeight: 100,
                                hiDPI: true
                            });
                            if(deferred) {
                                images.push({
                                    deferred: deferred,
                                    link: context.publication.urlForFileDownload(v, {transform:"w1000"}) // restrict width of downloaded image
                                });
                            }
                        }
                    });
                });
                if(images.length) {
                    context.hint.needsLightBox = true;
                    view.images = images;
                }
            }

            E.render(view, context.publication.getReplaceableTemplate("hres:repo-publication-common:page:output"));
        }
    );

    publication.objectValueRendererForTypes([T.License], function(object, href, desc, publication) {
        return P.template("value/license").deferredRender({
            title: object.title,
            href: object.first(A.URL)
        });
    });
});
