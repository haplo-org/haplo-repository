/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanViewDataMonitoringDashboards = O.action("hres-repo-data-monitoring:view-reports").
    title("View repository data monitoring reports").
    allow("group", Group.RepositoryEditors);

var REPOSITORY_TYPES = SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item');
var statistics = [];

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.statistic({
        name: "totalMissingAuthors", description: "Total",
        filter: function(select) {
            select.where("author", "=", null);
        },
        aggregate: "COUNT"
    });
    O.service("hres:repository:each_repository_item_type", type => {
        let typeInfo = SCHEMA.getTypeInfo(type);
        let name = "noAuthor:"+typeInfo.code;
        statistics.push(name);
        collection.statistic({
            name: name, description: typeInfo.name,
            filter: function(select) {
                select.where("author", "=", null).or(sq => {
                    sq.where("type", "=", type);
                    // TODO: change the below if this service changes to include child types
                    _.each(typeInfo.childTypes, childType => sq.where("type", "=", childType));
                });
            },
            aggregate: "COUNT"
        });
    });
});

P.respond("GET,POST", "/do/hres-repo-data-monitoring/outputs-missing-authors", [
], function(E) {
    CanViewDataMonitoringDashboards.enforce();
    let dashboard = P.reporting.dashboard(E, {
        kind:"list",
        collection:"repository_items",
        name:"researchers_missing_departments",
        title:"Outputs without authors"
    }).
        summaryStatistic(0, "totalMissingAuthors");
    _.each(statistics, (stat, i) => dashboard.summaryStatistic(i, stat));
    dashboard.
        use("std:row_object_filter", {fact:"type", objects: O.service("hres:repository:sorted_type_filter_spec")}).
        filter(function(select) {
            select.where("author", "=", null);
        }).
        columns(100, [
            {fact:"ref", heading:"Output", link:true},
            {fact:"type"},
            {fact:"year", type:"lookup", lookup:(date) => {
                if(date) {
                    return new XDate(date).getFullYear();
                }
            }}
        ]).
        respond();
});


