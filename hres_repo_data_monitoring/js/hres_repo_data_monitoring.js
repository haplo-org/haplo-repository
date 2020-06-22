/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.implementService("std:action_panel_priorities", function(priorities) {
    _.extend(priorities, {
        "hres:repository_menu:data_monitoring": 9999,
    });
});

var CanViewDataMonitoringDashboards = O.action("hres-repo-data-monitoring:view-reports").
    title("View repository data monitoring reports").
    allow("group", Group.RepositoryEditors);

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(!O.currentUser.allowed(CanViewDataMonitoringDashboards)) { return; }
    let i = P.locale().text("template");
    builder.panel("hres:repository_menu:data_monitoring").
        title(i["Data monitoring"]).
        link("default", "/do/hres-repo-data-monitoring/citation-matching", "Citation to author matching");
});

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


// --------------------------------------------------------------------------
// Citation Matching
// --------------------------------------------------------------------------

P.db.table("hiddenCitations", {
    citation: { type: "text" }
});

var _citeToOutputs;
var getCitationToOutputMap = function() {
    if(!_citeToOutputs) {
        _citeToOutputs = {};
        let outputs = O.query().link(REPOSITORY_TYPES, A.Type).execute();
        _.each(outputs, output => {
            output.every(A.AuthorsCitation, v => {
                //If linked to an author skip
                if(v.toFields().value.ref) { return; }
                let cite = v.toString();
                if(_citeToOutputs[cite] !== undefined) {
                    _citeToOutputs[cite].push(output.ref);
                } else {
                    _citeToOutputs[cite] = [output.ref];
                }
            });
        });
    }
    return _citeToOutputs;
};

P.hook("hPostObjectChange", function(response, object, operation, previous) {
    // Reset cache on potential invalidation
    if(_citeToOutputs &&
        (_.contains(["create", "erase"], operation) || !object.valuesEqual(previous, A.AuthorsCitation))) {
            _citeToOutputs = undefined;
    }
});

P.respond("POST", "/do/hres-repo-data-monitoring/citation-matching", [
], function(E) {
    if(!O.currentUser.allowed(CanViewDataMonitoringDashboards)) { O.stop("Not permitted"); }
    let citation = E.request.parameters.citation,
        ref = O.ref(E.request.parameters.ref),
        citeToOutputs = getCitationToOutputMap(),
        hiddenCitations = _.pluck(P.db.hiddenCitations.select(), "citation"),
        outputs = citeToOutputs[citation];

    _.each(outputs, output => {
        output = output.load();
        let mutable = output.mutableCopy();
        let citations = [];
        mutable.remove(A.AuthorsCitation, v => {
            citations.push(v);
            return true;
        });
        _.each(citations, cite => {
            if(cite.toString() === citation) {
                //Append new citation as correct text type
                O.service("hres:author_citation:append_citation_to_object", mutable, A.Author, null, {ref:ref});
            } else {
                mutable.append(cite, A.AuthorsCitation);
            }
        });
        if(!output.valuesEqual(mutable, A.AuthorsCitation)) {
            mutable.save();
        }
    });

    //Preventing 404 error in web inspector console
    E.response.statusCode = HTTP.OK;
    E.response.body = "";
});

P.respond("GET", "/do/hres-repo-data-monitoring/citation-matching", [
    {parameter:"action", as:"string", optional:true},
    {parameter:"citation", as:"string", optional:true}
], function(E, action, citation) {
    if(!O.currentUser.allowed(CanViewDataMonitoringDashboards)) { O.stop("Not permitted"); }
    let citeToOutputs = getCitationToOutputMap();
    let hiddenCitations = _.pluck(P.db.hiddenCitations.select(), "citation");
    switch(action) {
        case "show":
            P.db.hiddenCitations.select().where("citation", "=", citation).deleteAll();
            return E.response.redirect("/do/hres-repo-data-monitoring/citation-matching");
        case "hide":
            if(!P.db.hiddenCitations.select().where("citation", "=", citation).limit(1).count()) {
                P.db.hiddenCitations.create({citation: citation}).save();
            }
            return E.response.redirect("/do/hres-repo-data-monitoring/citation-matching");
        case "showAll":
            P.db.hiddenCitations.select().deleteAll();
            return E.response.redirect("/do/hres-repo-data-monitoring/citation-matching");
        case "list": 
            return E.render({
                outputs: _.map(citeToOutputs[citation], output => { return output.load(); }),
                citation: citation
            }, "list-outputs-for-citation");
    }

    let people = O.query().link(T.Person, A.Type).execute();
    let citeToPeople = {};
    _.each(people, person => {
        let citation = O.service("hres:author_citation:get_citation_text_for_person_object", person);
        if(!_.contains(hiddenCitations, citation)) {
            let object = {
                ref: person.ref,
                name: person.title,
                type: person.firstType().load().title,
            };
            if(citeToPeople[citation] === undefined) {
                citeToPeople[citation] = [object];
            } else {
                citeToPeople[citation].push(object);
            }
        }
    });

    let matches = [];
    _.each(citeToOutputs, (outputs, citation) => {
        let possibleAuthors = citeToPeople[citation];
        if(outputs && possibleAuthors) {
            matches.push({
                citation: citation,
                authors: possibleAuthors,
                affected: outputs.length
            });
        }
    });
    E.render({
        matches: _.sortBy(matches, "affected").reverse(),
        hidden: hiddenCitations
    });
});
