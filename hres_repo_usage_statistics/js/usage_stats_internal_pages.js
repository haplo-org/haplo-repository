/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var getDetailsForInternalPage = function(object) {
    let details;
    if(object.isKindOf(T.ResearchInstitute)) {
        details = P.getKeyForResearchInstitute(object);
        details.table = "repository"+details.level+"Totals";
        details.url = "/do/hres-repo-usage-statistics/usage-by-"+details.level.toLowerCase();
    } else if(object.isKindOf(T.Person)) {
        details = {
            key: { researcher:object.ref },
            table: "repositoryResearcherTotals",
            url: "/do/hres-repo-usage-statistics/researcher-usage-statistics",
            template: "usage-stats-internal-person"
        };
    } else if(object.isKindOfTypeAnnotated("hres:annotation:repository-item")) {
        details = {
            key:{ outputRef:object.ref },
            table: "repoObjectTotals",
            url: "/do/hres-repo-usage-statistics/output-usage-statistics"
         };
    }
    return details;
};

P.element("usage_overview", "Usage overview element", function(L) {
    let details = getDetailsForInternalPage(L.object);
    if(details) {
        let query = O.service("haplo:usage_tracking:query_database", details);
        let view = P.getStatsForQuery(query);
        view.title = "";
        view.url = details.url+'/'+L.object.ref;
        view.canSeeMoreDetails = O.currentUser.allowed(P.canSeeUsageSummary);
        L.render(view, details.template || "usage-stats-internal");
    }
});

P.implementService("hres_repo_navigation:repository_item_page", function(object, builder) {
    let details = getDetailsForInternalPage(object);
    if(details) {
        let query = O.service("haplo:usage_tracking:query_database", details);
        let view = P.getStatsForQuery(query);
        view.url = details.url+"/"+object.ref;
        view.canSeeMoreDetails = O.currentUser.allowed(P.canSeeUsageSummary);
        builder.sidebar.panel(1000).style('special').element(1, {
            deferred: P.template("usage-stats-internal").deferredRender(view)
        });
    }
});