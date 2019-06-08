/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// --------------------------------------------------------------------------
//   LATEST ADDITIONS
// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:page:latest-additions",
    "pages/latest-additions"
);

P.webPublication.feature("hres:repository:common:latest-additions", function(publication, spec) {

    spec = spec || {};
    var path = spec.path || "/latest";

    // This is a reasonable list of "latest deposit to public repository"
    publication.respondToExactPath(path,
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
            context.hint.isLatestAdditionsPage = true;
            E.render({
                latestResults: { results: latest }
            }, context.publication.getReplaceableTemplate("hres:repo-publication-common:page:latest-additions"));
        }
    );

});


// --------------------------------------------------------------------------
//   YEAR LINKS
// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:page:year-links",
    "pages/year-links"
);
P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:page:year-list",
    "pages/year-list"
);

P.webPublication.feature("hres:repository:common:list-by-year", function(publication, spec) {

    spec = spec || {};
    var path = spec.path || "/year";

    publication.respondToExactPath(path,
        function(E, context) {
            E.setResponsiblePlugin(P);
            var lastYear = (new Date()).getFullYear() + 1;
            var firstYear = lastYear - 20;
            if("hres:repository:browse-by-year:first" in O.application.config) {
                firstYear = O.application.config["hres:repository:browse-by-year:first"];
            } else {
                var q = O.query().
                    link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), A.Type).
                    sortByDateAscending().
                    limit(1).
                    execute();
                if(q.length) {
                    var firstObject = q[0];
                    var firstDate = firstObject.first(A.Date);
                    var d = firstDate ? firstDate.start : firstObject.creationDate;
                    firstYear = d.getFullYear() + 1;
                }
                if(firstYear < 1800) {
                    firstYear = 1800;
                }
                if(firstYear > lastYear) {
                    firstYear = lastYear - 10;
                }
            }
            var years = [];
            for(var y = lastYear; y >= firstYear; --y) {
                years.push(y);
            }
            E.render({
                path: path,
                years: years
            }, context.publication.getReplaceableTemplate("hres:repo-publication-common:page:year-links"));
        }
    );

    publication.respondToDirectory(path,
        function(E, context) {
            E.setResponsiblePlugin(P);
            var year = parseInt(E.request.extraPathElements[0],10);
            var items = O.query().
                link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), A.Type).
                dateRange(new Date(year, 0, 1), new Date(year+1, 0, 1), A.Date).
                sortByDateAscending().
                execute();
            E.render({
                year: year,
                items: items
            }, context.publication.getReplaceableTemplate("hres:repo-publication-common:page:year-list"));
        }
    );

});


// --------------------------------------------------------------------------
//   RESEARCH INSTITUTE BROWSE
// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:page:research-institute-browse",
    "pages/research-institute-browse"
);

P.webPublication.feature("hres:repository:common:research-institute-browse", function(publication, spec) {

    var images = spec.images || [];

    var researchInstituteBrowse = function(E, context) {
        var selected = E.request.extraPathElements[0];
        var topLevel = [];
        var imageIdx = 0;
        _.each(O.query().link(T.Faculty, A.Type).sortByTitle().execute(), (ri) => {
            var i = {
                ri: ri,
                href: spec.path+"/"+ri.ref+"#choose",
                title: ri.title,
                image: images[imageIdx++],
                selected: selected === ri.ref.toString()
            };
            if(imageIdx >= images.length) { imageIdx = 0; }
            if(i.selected) {
                i.institutes = O.query().
                        link(T.ResearchInstitute,A.Type).
                        link(ri.ref,A.Parent).
                        sortByTitle().execute();
            }
            topLevel.push(i);
        });
        context.hint.isResearchInstituteBrowsePage = true;
        E.render({
            spec: spec,
            topLevel: topLevel
        }, context.publication.getReplaceableTemplate("hres:repo-publication-common:page:research-institute-browse"));
    };

    publication.respondToExactPath(spec.path, researchInstituteBrowse);
    publication.respondToDirectory(spec.path, researchInstituteBrowse);

});
