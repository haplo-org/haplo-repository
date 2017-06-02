/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var Publication = P.webPublication.register(P.webPublication.DEFAULT);

// TODO: Sort out permissions so this isn't necessary
var citationOf = function(output) {
    return O.withoutPermissionEnforcement(function() {
        return O.service("hres_bibliographic_reference:for_object", output);
    });
};

Publication.respondToExactPath("/repository",
    function(E) {
        E.render({
            staticDirectoryUrl: P.staticDirectoryUrl,
            outputs: _.map(O.query().
                link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository:output'), A.Type).
                limit(5).
                sortByDate().
                execute(), function(output) {
                    return {
                        output: output,
                        href: O.service("std:web-publisher:published-url-for-object", output),
                        citation: citationOf(output)
                    };
                }
            )
        }, "home");
    }
);

Publication.respondToExactPath("/repository/search",
    function(E) {
        var search = P.webPublication.widget.search(E);
        E.render({
            staticDirectoryUrl: P.staticDirectoryUrl,
            search: search
        }, "search");
    }
);

Publication.respondWithObject("/repository",
    SCHEMA.getTypesWithAnnotation('hres:annotation:repository:output'),
    function(E, object) {
        object = object.mutableCopy();
        var authors = _.filter(object.every(A.Author), function(a) { return O.isRef(a); });
        var embargo = O.service("hres_repo_embargoes:get_embargo", object);
        var underEmbargo = (embargo && embargo.isUnderEmbargo());
        var noFiles = (!object.first(A.File) &&
            !object.first(A.AcceptedAuthorManuscript) &&
            !object.first(A.PublishedFile));
            E.render({
            object: P.webPublication.widget.object(object).
                        withoutAttributes([A.File]),
            embargo: embargo,
            noFiles: noFiles,
            hasFile: object.first(A.File),
            hasAAM: object.first(A.AcceptedAuthorManuscript),
            hasPublishedFile: object.first(A.PublishedFile),
            underEmbargo: underEmbargo,
            citation: citationOf(object),
            related: _.map(O.query().
                link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository:output'), A.Type).
                link(authors, A.Author).
                sortByDate().limit(5).
                execute(), function(output) {
                    return {
                        output: output,
                        href: O.service("std:web-publisher:published-url-for-object", output),
                        citation: citationOf(output)
                    };
                }
            ),
            applicationUrl: O.application.url,
            permalink: O.service("std:web-publisher:published-url-for-object", object),
            staticDirectoryUrl: P.staticDirectoryUrl
        });
    }
);

Publication.respondToExactPath("/staff",
    function(E) {
        E.render({
            staticDirectoryUrl: P.staticDirectoryUrl,
            staff: {
                results: O.query().
                    link(T.Researcher).
                    sortByTitle().execute()
            }
        }, "staff-list");
    }
);

Publication.respondWithObject("/staff",
    [T.Person],
    function(E, object) {
        E.render({
            object: P.webPublication.widget.object(object),
            profile: {
                object: object,
                without: ["photo"]
            },
            outputs: _.map(O.query().
                link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository:output'), A.Type).
                link(object.ref, A.Author).
                sortByDate().
                execute(), function(output) {
                    return {
                        output: output,
                        href: O.service("std:web-publisher:published-url-for-object", output),
                        citation: citationOf(output)
                    };
                }
            ),
            staticDirectoryUrl: P.staticDirectoryUrl
        });
    }
);

Publication.respondToDirectory("/outputs",
    // quick outputs by subject browsing view
    // assumes 2 level only
    function(E) {
        var pe = E.request.extraPathElements;
        var facultyFromPath = pe[0];
        var departmentFromPath = pe[1];
        var faculties, depts;
        faculties = _.map(O.query().link(T.Faculty, A.Type).sortByTitle().execute(), 
            function(f) { return {title: f.title, ref: f.ref, active: (f.ref.toString() === facultyFromPath)}; });
        faculties.unshift({title: "All", ref:"ALL"});
        var dept, fac, linkedRi;
        if (facultyFromPath !== "ALL" && facultyFromPath) {
            fac = O.ref(facultyFromPath);
            if(fac) { fac = fac.load(); }
            linkedRi = fac;
        }
        if(departmentFromPath !== "ALL" && departmentFromPath) {
            dept = O.ref(departmentFromPath);
            if(dept) { dept = dept.load(); }
            linkedRi = dept;
        }
        if(facultyFromPath === "ALL" || (facultyFromPath && departmentFromPath)) {
            var outputs;
            if(linkedRi) {
                outputs = O.query().
                    link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository:output'), A.Type).
                    linkToQuery(A.Author, function(sq) {
                        sq.link(T.Person, A.Type).
                            link(fac.ref, A.ResearchInstitute);
                    }).
                    anyLabel([Label.AcceptedIntoRepository]).
                    execute();
            } else {
                outputs = O.query().
                    link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository:output'), A.Type).
                    anyLabel([Label.AcceptedIntoRepository]).
                    execute();
            }
            return E.render({
                staticDirectoryUrl: P.staticDirectoryUrl,
                faculty: fac ? fac : {title: "All"},
                dept: dept ? dept : (fac ? {title: "All"} : undefined),
                outputs: _.map(outputs, function(output) {
                    var thumbnail, file = output.first(A.File);
                    if(file) {
                        var actualFile = O.file(file);
                        if(actualFile) { thumbnail = actualFile.toHTML({transform:"thumbnail"}); }
                    }
                    return {
                        output: output,
                        unsafeThumbnail: thumbnail,
                        citation: citationOf(output)
                    };
                })
            }, "outputs-list");
        }
        if(fac) {
            depts = _.map(O.query().link(T.Department, A.Type).link(fac.ref, A.Parent).sortByTitle().execute(), 
                function(dept) { return {title: dept.title, ref: dept.ref, fac: fac.ref}; });
            depts.unshift({title: "All", ref:"ALL", fac: fac.ref});
        }
        E.render({
            staticDirectoryUrl: P.staticDirectoryUrl,
            faculties: faculties,
            faculty: facultyFromPath,
            depts: depts
        }, "ri-list");
    }
);


// --------------------------------------------------------------------------

Publication.searchResultRendererForTypes(
    Publication.DEFAULT,
    function(object) {
        return P.template("search-result/default").deferredRender({object:object});
    }
);

Publication.searchResultRendererForTypes(
    SCHEMA.getTypesWithAnnotation('hres:annotation:repository:output'),
    function(object) {
        return P.template("search-result/output").deferredRender({
            object: object,
            citation: citationOf(object)
        });
    }
);

Publication.searchResultRendererForTypes(
    [T.Person],
    function(object) {
        return P.template("search-result/person").deferredRender({
            object: P.webPublication.widget.object(object)
        });
    }
);

// --------------------------------------------------------------------------

P.implementService("std:action_panel:repository_item", function(display, builder) {
    var labels = display.object.labels;
    if(labels.includes(Label.AcceptedIntoRepository)) {
        builder.panel(622).element(0, {title:"Repository"});
        builder.panel(622).link("default", "/repository/"+display.object.ref, "View in public repository");
    }
});

// --------------------------------------------------------------------------

// TODO: Use service user with proper permissions & remove this temporary implementation
P.hook('hUserPermissionRules', function(response, user) {
    if(user.id === 2) { // ANONYMOUS
        response.rules.rule(Label.AcceptedIntoRepository, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(T.Person, O.STATEMENT_ALLOW, O.PERM_READ);
        response.rules.rule(T.ResearchInstitute, O.STATEMENT_ALLOW, O.PERM_READ);
    }
});
