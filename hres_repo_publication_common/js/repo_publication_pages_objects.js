/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// --------------------------------------------------------------------------
//   SIMPLE OBJECTS
// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:page:simple-object",
    "pages/simple-object"
);

P.webPublication.feature("hres:repository:common:simple-object", function(publication, spec) {

    spec = spec || {};
    var kind = spec.kind,
        template = spec.template || "hres:repo-publication-common:page:simple-object";

    publication.respondWithObject(spec.path,
        spec.types,
        function(E, context, object) {
            if(kind) {
                context.hint.objectKind = kind;
            }
            var widget = P.webPublication.widget.object(object);
            if(spec.withoutAttributes !== undefined) {
                widget.withoutAttributes(spec.withoutAttributes);
            }
            if(spec.onlyAttributes !== undefined) {
                widget.onlyAttributes(spec.onlyAttributes);
            }
            E.render({
                object: widget,
                imagePagePartCategory: spec.imagePagePartCategory
            }, context.publication.getReplaceableTemplate(template));
        }
    );

});


// --------------------------------------------------------------------------
//   LIST OF OBJECTS
// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:page:simple-object-list",
    "pages/simple-object-list"
);

P.webPublication.feature("hres:repository:common:simple-object-list", function(publication, spec) {

    spec = spec || {};
    var template = spec.template || "hres:repo-publication-common:page:simple-object-list";

    publication.respondToExactPath(spec.path,
        function(E, context) {
            E.render({
                spec: spec,
                objects: {
                    results: O.query().
                        link(spec.types, A.Type).
                        sortByTitle().execute()
                }
            }, context.publication.getReplaceableTemplate(template));
        }
    );

});

// --------------------------------------------------------------------------
//   OUTPUT (REPOSITORY ITEM) OBJECTS
// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:page:output",
    "pages/output"
);

var ADMIN_ATTRS = [
    A.OutputStatus, A.PeerReview, A.PublishedVersionOfRecord,
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


// --------------------------------------------------------------------------
//   STAFF DIRECTORY
// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:page:researcher-directory",
    "pages/researcher-directory"
);

P.webPublication.feature("hres:repository:common:researcher-directory", function(publication, spec) {

    var researcherResultsToRender = function(results) {
        var photo = O.serviceMaybe("hres:repository:person:photo-display:listing", publication, 80, 80) || function(){};
        return _.map(results, (r, i) => {
            var department = r.first(A.ResearchInstitute) ?
                r.first(A.ResearchInstitute).load() : undefined;
            var faculty = (department && department.firstParent()) ?
                department.firstParent().load() : undefined;
            return {
                researcher: r,
                first: (i === 0),
                jobTitle: r.first(A.JobTitle),
                photo: photo(r),
                department: department,
                faculty: faculty
            };
        });
    };

    publication.respondToDirectory(spec.path, function(E, context) {
        var letter = (E.request.extraPathElements[0] || "A").toUpperCase();
        if(letter.length != 1) { letter = 'A'; }
        var results = O.query().
            link(T.Researcher).
            freeText(letter+'*', A.Title).   // a little bit of filtering, will select a few extras so need filtering in code as well
            sortByTitle().
            execute();
        results = _.filter(results, (r) => {
            var lastName = r.firstTitle().toFields().last;
            return (lastName && (lastName.charAt(0).toUpperCase() === letter));
        });
        context.hint.isResearcherDirectoryPage = true;
        E.render({
            spec: spec,
            letter: letter,
            researchers: {
                results: researcherResultsToRender(results)
            }
        }, context.publication.getReplaceableTemplate("hres:repo-publication-common:page:researcher-directory"));
    });

    // Redirector to initial page
    publication.respondToExactPath(spec.path, function(E, context) {
        E.response.redirect(spec.path+'/a');
    });

});

P.globalTemplateFunction("hres:repository:letter-navigation", function(selected) {
    var e = [];
    for(var l = 65; l <= 90; ++l) {
        var letter = String.fromCharCode(l);
        e.push('<li');
        if(letter === selected) { e.push(' class="active"'); }
        e.push('><a href="', letter.toLowerCase(), '">', letter, '</a></li>');
    }
    this.unsafeWriteHTML(e.join(''));   // contents of e generated only from server controlled content
});


// --------------------------------------------------------------------------
//   RESEARCH INSTITUTE
// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:page:research-institute",
    "pages/research-institute"
);

P.webPublication.feature("hres:repository:common:research-institute", function(publication, spec) {

    publication.respondWithObject(spec.path,
        [T.ResearchInstitute],
        function(E, context, object) {
            context.hint.objectKind = 'research-institute';

            var researchers = O.query().
                link(T.Researcher).
                link(context.object.ref, A.ResearchInstitute).
                sortByTitle().
                execute();

            // Paged listing of outputs
            var outputs = P.webPublication.widget.search(E, {
                alwaysSearch: true,
                hideRelevanceSort: true,
                hideResultsCount: true,
                pageSize: 40,
                modifyQuery(query) {
                    query.
                        // Restrict search to repository items
                        anyLabel([Label.RepositoryItem]).
                        link(context.object.ref);
                }
            });

            var widget = P.webPublication.widget.object(object);
            if(spec.withoutAttributes !== undefined) {
                widget.withoutAttributes(spec.withoutAttributes);
            }
            if(spec.onlyAttributes !== undefined) {
                widget.onlyAttributes(spec.onlyAttributes);
            }

            E.render({
                object: widget,
                researchers: researchers,
                outputs: outputs
            }, context.publication.getReplaceableTemplate("hres:repo-publication-common:page:research-institute"));
        }
    );

});

