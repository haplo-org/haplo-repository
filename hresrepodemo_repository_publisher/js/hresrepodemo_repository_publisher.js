/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var Publication = P.webPublication.register(P.webPublication.DEFAULT).
    serviceUser("hres:service-user:repository-publisher").
    permitFileDownloadsForServiceUser().
    use("hres:repository:common:platform-integration").
    use("hres:repository:common:search-results").
    use("hres:repository:access-request").
    use("hres:repository:file-restriction");

Publication.layout(function(E, context, blocks) {
    return P.template("layout").render({
        staticDirectoryUrl: P.staticDirectoryUrl,
        context: context,
        blocks: blocks
    });
});

// --------------------------------------------------------------------------

Publication.setHomePageUrlPath("/repository");

Publication.respondToExactPath("/repository",
    function(E, context) {
        context.hint.objectKind = 'home';
        E.render({}, "home");
    }
);
Publication.pagePartAddToCategory({
    pagePart: "hres:repository:misc:recent-additions",
    category: "hres:repository:home:sidebar"
});
Publication.pagePartFromTemplate({
    name: "hresrepodemo:home:explanatory-text",
    category: "hres:repository:home:below",
    template: "home-below"
});

// --------------------------------------------------------------------------

Publication.respondToExactPath("/repository/search",
    function(E, context) {
        var search = P.webPublication.widget.search(E);
        E.render({
            search: search
        }, "search");
    }
);

// --------------------------------------------------------------------------

Publication.respondWithObject("/repository",
    SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'),
    function(E, context, object) {
        context.hint.objectKind = 'output';
        var fileAttributes = [];
        object.every(function(v,d,q) {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                fileAttributes.push(d);
            }
        });
        E.render({
            object: P.webPublication.widget.object(object).
                        withoutAttributes(fileAttributes),
            citation: O.service("hres_bibliographic_reference:for_object", object)
        });
    }
);

// --------------------------------------------------------------------------

Publication.respondToExactPath("/staff",
    function(E, context) {
        E.render({
            staff: {
                results: O.query().
                    link(T.Researcher).
                    sortByTitle().execute()
            }
        }, "staff-list");
    }
);

// --------------------------------------------------------------------------

Publication.respondWithObject("/staff",
    [T.Person],
    function(E, context, object) {
        context.hint.objectKind = 'person';
        E.render({
            object: P.webPublication.widget.object(object)
        });
    }
);
// Don't display photo section in profile display on staff page.
Publication.setPagePartOptions("hres:researcher-profile:profile", {without:["photo"]});

// --------------------------------------------------------------------------

Publication.respondToDirectory("/outputs",
    // quick outputs by subject browsing view
    // assumes 2 level only
    function(E, context) {
        var pe = E.request.extraPathElements;
        var facultyFromPath = pe[0];
        var departmentFromPath = pe[1];
        var faculties, depts;
        faculties = _.map(O.query().link(T.Faculty, A.Type).sortByTitle().execute(), 
            function(f) { return {title: f.title, ref: f.ref, active: (f.ref.toString() === facultyFromPath)}; });
        faculties.unshift({title: "All", ref:"ALL"});
        var dept, fac, linkedRi;
        if(facultyFromPath !== "ALL" && facultyFromPath) {
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
                    link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
                    linkToQuery(A.Author, function(sq) {
                        sq.link(T.Person, A.Type).
                            link(fac.ref, A.ResearchInstitute);
                    }).
                    anyLabel([Label.AcceptedIntoRepository]).
                    execute();
            } else {
                outputs = O.query().
                    link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
                    anyLabel([Label.AcceptedIntoRepository]).
                    execute();
            }
            return E.render({
                faculty: fac ? fac : {title: "All"},
                dept: dept ? dept : (fac ? {title: "All"} : undefined),
                outputs: _.map(outputs, function(output) {
                    // TODO: What file should be displayed here?
                    var file = output.first(A.File) || output.first(A.AcceptedAuthorManuscript) || output.first(A.PublishedFile);
                    if(file) {
                        if(!Publication.isFileDownloadPermitted(file)) { file = undefined; }
                    }
                    return {
                        output: output,
                        file: file,
                        citation: O.service("hres_bibliographic_reference:for_object", output)
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
            faculties: faculties,
            faculty: facultyFromPath,
            depts: depts
        }, "ri-list");
    }
);

