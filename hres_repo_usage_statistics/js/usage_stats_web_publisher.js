/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// Helper Functions ----------------------

var getStatsForQuery = P.getStatsForQuery = function(query) {
    let views = query.aggregate("SUM", "views");
    let downloads = query.aggregate("SUM", "downloads");
    let today = new XDate();
    query.where("year", "=", today.getFullYear()).where("month", "=", today.getMonth());
    let monthlyViews = query.aggregate("SUM", "views");
    let monthlyDownloads = query.aggregate("SUM", "downloads");
    return {
        views: views || 0,
        downloads: downloads || 0,
        monthlyViews: monthlyViews || 0,
        monthlyDownloads: monthlyDownloads || 0
    };
};

var getKeyForResearchInstitute = P.getKeyForResearchInstitute = function(object) {
    let level = "School";
    if(object.isKindOf(T.Faculty)) {
        level = "Faculty";
    } else if(object.isKindOf(T.Department)) {
        level = "Department";
    }
    let key = {};
    key[level.toLowerCase()] = object.ref;
    return {key: key, level:level};
};

// Set up page parts ----------------------


P.webPublication.registerReplaceableTemplate(
    "hres:repo-usage-stats:page-part:statistics",
    "usage-stats-external"
);

P.webPublication.registerReplaceableTemplate(
    "hres:repo-usage-stats:page-part:statistics:person",
    "usage-stats-external-person"
);

P.webPublication.pagePart({
    name: "hres:repository:output:usage-stats",
    category: "hres:repository:output:sidebar",
    sort: 2500,
    deferredRender: function(E, context, options) {
        if(context.object) {
            let query = O.service("haplo:usage_tracking:query_database", {
                table: "repoObjectTotals",
                key: {outputRef: context.object.ref}
            });
            var template = context.publication.getReplaceableTemplate("hres:repo-usage-stats:page-part:statistics");
            return template.deferredRender(getStatsForQuery(query));
        }
    }
});

P.webPublication.pagePart({
    name: "hres:repository:person:usage-stats",
    category: "hres:repository:person:sidebar",
    sort: 2500,
    deferredRender: function(E, context, options) {
        if(context.object) {
            let query = O.service("haplo:usage_tracking:query_database", {
                table: "repositoryResearcherTotals",
                key: {researcher: context.object.ref}
            });
            var template = context.publication.getReplaceableTemplate("hres:repo-usage-stats:page-part:statistics:person");
            return template.deferredRender(getStatsForQuery(query));
        }
    }
});

P.webPublication.pagePart({
    name: "hres:repository:research-institute:usage-stats",
    category: "hres:repository:research-institute:sidebar",
    sort: 1,
    deferredRender: function(E, context, options) {
        if(context.object) {
            let key = getKeyForResearchInstitute(context.object);
            let query = O.service("haplo:usage_tracking:query_database", {
                table: "repository"+key.level+"Totals",
                key: key.key
            });
            var template = context.publication.getReplaceableTemplate("hres:repo-usage-stats:page-part:statistics");
            return template.deferredRender(getStatsForQuery(query));
        }
    }
});