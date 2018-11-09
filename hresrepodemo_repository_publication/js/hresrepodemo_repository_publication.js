/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.implementService("std:action_panel:home_page", function(display, builder) {
    builder.panel(99999).
        // Uses the known default publication URL used in theis application
        link('default', 'https://'+O.application.hostname+'/repository', "Public Repository homepage");
});

// --------------------------------------------------------------------------

var Publication = P.webPublication.register(P.webPublication.DEFAULT).
    serviceUser("hres:service-user:repository-publisher").
    permitFileDownloadsForServiceUser().
    use("hres:repository:common:platform-integration").
    use("hres:researcher-profile:platform-integration").
    use("hres:repository:common:search-results").
    use("hres:repository:common:list-by-year").
    use("hres:repository:ar:access-request").
    use("hres:repository:ar:request-a-copy"). 
    use("hres:file_mediated_access");

Publication.layout(function(E, context, blocks) {
    return P.template("_layout").render({
        staticDirectoryUrl: P.staticDirectoryUrl,
        context: context,
        blocks: blocks
    });
});

// Don't display share panel
Publication.pagePartRemoveFromCategory({
    name: "hres:repository:output:share-panel",
    category: "hres:repository:output:sidebar"
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

// --------------------------------------------------------------------------

Publication.use("hres:oai-pmh:server", {
    attributes: {
        repositoryName: "Haplo Demo Repository",
        adminEmail: "haplo-repository@example.org"
    }
});

// --------------------------------------------------------------------------

Publication.respondToExactPath("/repository/search",
    function(E, context) {
        var search = P.webPublication.widget.search(E, {
            modifyQuery(query) {
                // Restrict search to researchers and repository items -- other things can be read by the
                // permissions, but shouldn't be displayed in the search.
                query.anyLabel([T.Researcher, Label.RepositoryItem]);
            }
        });
        E.render({
            showingResults: !!E.request.parameters.q,
            search: search
        }, "search");
    }
);

Publication.use("hres:repository:common:search-by-fields", {
    path: "/repository/search/by-fields",
    destination: "/repository/search"
});

// --------------------------------------------------------------------------

var ADMIN_ATTRS = [
    A.FileAccessLevel, A.OutputStatus, A.PeerReview, A.PublishedVersionOfRecord, A.PublicationProcessDates,
    A.REFUnitOfAssessment, A.ResearchInstitute, A.OriginalResearchInstitute
];

Publication.respondWithObject("/repository",
    SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'),
    function(E, context, object) {
        context.hint.objectKind = 'output';
        E.render({
            object: P.webPublication.widget.object(object).
                        withoutAttributes(ADMIN_ATTRS),
            citation: O.service("hres_bibliographic_reference:for_object", object)
        });
    }
);

// --------------------------------------------------------------------------

if("Impact" in T) {
    Publication.respondWithObject("/impact",
        [T.Impact],
        function(E, context, object) {
            context.hint.objectKind = 'impact';
            E.render({
                object: P.webPublication.widget.object(object)
            });
        }
    );

    Publication.respondWithObject("/impact-evidence",
        [T.ImpactEvidence],
        function(E, context, object) {
            context.hint.objectKind = 'impact-evidence';
            E.render({
                object: P.webPublication.widget.object(object)
            }, "impact");
        }
    );
}

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

Publication.respondWithObject("/research-institute",
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
                    linkToQuery(A.Author, function(sq) {
                        sq.link(T.Person, A.Type).
                            link(object.ref, A.ResearchInstitute);
                    });
            }
        });

        E.render({
            object: P.webPublication.widget.object(object),
            researchers: researchers,
            outputs: outputs
        });
    }
);

// --------------------------------------------------------------------------

Publication.respondWithObject("/staff",
    [T.Researcher],
    function(E, context, object) {
        context.hint.objectKind = 'person';
        E.render({
            object: P.webPublication.widget.object(object).withoutAttributes([A.Type, A.REFUnitOfAssessment])
        });
    }
);
// Don't display photo section in profile display on staff page.
Publication.setPagePartOptions("hres:researcher-profile:profile", {without:["photo"]});

// --------------------------------------------------------------------------

// TODO: Platform support to sort by a specific attribute
// This is a reasonable first approximation of "latest deposit to public repository"
Publication.respondToExactPath("/latest",
    function(E, context) {
        var latest = O.query().
            link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
            anyLabel([Label.AcceptedIntoRepository]).
            sortByDate().
            limit(100).
            execute();
        latest = _.filter(latest, function(object) {
            return object.first(A.PublicationProcessDates, Q.Deposited);
        });
        latest = _.sortBy(latest, function(object) {
            // Sort descending
            return -1*object.first(A.PublicationProcessDates, Q.Deposited).start;
        });
        E.render({
            pageTitle: "Latest Additions",
            latestResults: { results: latest }
        });
    }
);

// --------------------------------------------------------------------------

var researchInstituteDirectory = function(E, context) {
    var selected = E.request.extraPathElements[0];
    var topLevel = [];
    _.each(O.query().link(T.Faculty, A.Type).sortByTitle().execute(), (ri) => {
        var i = {
            ri: ri,
            href: "/departments/"+ri.ref,
            title: ri.title,
            selected: selected === ri.ref.toString()
        };
        if(i.selected) {
            i.institutes = O.query().
                    link(T.ResearchInstitute,A.Type).
                    link(ri.ref,A.Parent).
                    sortByTitle().execute();
        }
        topLevel.push(i);
    });
    E.render({
        topLevel: topLevel
    });
};

Publication.respondToExactPath("/departments", researchInstituteDirectory);
Publication.respondToDirectory("/departments", researchInstituteDirectory);

