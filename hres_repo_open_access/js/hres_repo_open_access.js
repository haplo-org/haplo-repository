/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(CanViewOADashboards)) {
        builder.panel(600).title("Open Access").
            link(200, "/do/hres-repo-open-access/repository-items/all", "Overview").
            link(300, "/do/hres-repo-open-access/research-institutes/"+T.Faculty, "Faculty listing").
            link(400, "/do/hres-repo-open-access/research-institutes/"+T.Department, "Department listing");
    }
});
    
var CanViewOADashboards = O.action("hres_repo_open_access:view_dashboards").
    title("View Open Access Dashboards").
    allow("group", Group.RepositoryEditors);

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("oaIsGoldOA",      "boolean",     "Gold").
        fact("oaIsGreenOA",     "boolean",     "Green").
        fact("oaIsNotOA",       "boolean",     "Not OA").
        filter("oaEligible", function(select) {
            select.or(function(sq) {
                sq.where("type", "=", T.ConferenceItem).
                    where("type", "=", T.JournalArticle);
            });
        });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    if(object.first(A.OpenAccess)) {
        var behaviour = object.first(A.OpenAccess).behaviour;
        row.oaIsGoldOA = (behaviour === "hres:list:open-access:gold");
        row.oaIsGreenOA = (behaviour === "hres:list:open-access:green");
        row.oaIsNotOA = (behaviour === "hres:list:open-access:not-open-access");
    }
});

var REPOSITORY_ITEM_LOOKUP = {
    "green": { title: "Green", fact: "oaIsGreenOA" },
    "gold": { title: "Gold", fact: "oaIsGoldOA" },
    "not-oa": { title: "Not Open Access", fact: "oaIsNotOA" },
    "all": { title: "Overview" } 
};

P.respond("GET,POST", "/do/hres-repo-open-access/repository-items", [
    {pathElement:0, as:"string"},
    {parameter:"year", as:"int", optional:true}
], function(E, oaType, year) {
    CanViewOADashboards.enforce();
    // define further filtering with pathElements. 
    //  0: A string identifying the providing implementation. Providing plugins must check this before
    //      adding their filter to the details object
    //  1: A ref for the providing implementation to filter against
    var pe = E.request.extraPathElements;
    var details = _.clone(REPOSITORY_ITEM_LOOKUP[oaType]);
    if(pe.length) {
        O.serviceMaybe("hres_repo_open_access:custom_dashboard_filtering", details, pe.slice(1));
    }
    var columns =  [
        {fact: "author", link:true},
        "type",
        {fact: "publisher", link:true}
    ];
    if(oaType === "all") {
        columns = columns.concat(["oaIsGreenOA", "oaIsGoldOA", "oaIsNotOA"]);
    }
    P.reporting.dashboard(E, {
        kind: "list",
        collection: "repository_items",
        name: "oa_repository_items",
        title: "Open Access Items: "+details.title,
        filter: "oaEligible"
    }).
        use("hres:schema:calendar_year_navigation", year, "year").
        filter(function(select) {
            if(details.fact) {
                select.where(details.fact, "=", true);
            }
            // Set by "hres_repo_open_access:custom_dashboard_filtering"
            if(details.filter) {
                details.filter(select);
            }
        }).
        columns(0, [{fact:"ref", heading:"Output", link:true}]).
        columns(100, columns).
        respond();
});

// -------------------------------------------------------------------

P.hook('hPostObjectChange', function(response, object, operation, previous) {
    if(operation === 'update' || operation === 'create' || operation === "relabel") {
        if(object.labels.includes(Label.AcceptedIntoRepository)) {
            object.every(A.Author, function(v,d,q) {
                O.service("std:reporting:update_required", "research_institutes", v.load().every(A.ResearchInstitute));
            });
        }
    }
});

var addOAFactsToCollection = function(collection) {
    collection.
        fact("oaGoldOutputs",       "json",      "Gold").
        fact("oaGreenOutputs",      "json",      "Green").
        fact("oaNotOAOutputs",      "json",      "Not OA").
        fact("oaTotalEligibleOutputs", "json",   "Total OA Eligible");
};
var getOAFactsForObject = function(object, row, collectRelevantRepositoryItems) {
    var relevant = [];
    var repositoryItems = O.query().link([T.ConferenceItem, T.JournalArticle], A.Type).execute();
    _.each(repositoryItems, function(item) {
        // Collects repository items relevant for Open Access
        collectRelevantRepositoryItems(row, relevant, item);
    });

    var oaGoldOutputs = {};
    var oaGreenOutputs = {};
    var oaNotOAOutputs = {};
    var oaTotalEligibleOutputs = {};
    _.each(O.deduplicateArrayOfRefs(relevant), function(ref) {
        var item = ref.load();
        if(item.first(A.Date)) {
            var year = new XDate(item.first(A.Date).start).getFullYear();
            oaTotalEligibleOutputs[year] = (oaTotalEligibleOutputs[year] || 0)+1;
            if(item.first(A.OpenAccess)) {
                var behaviour = item.first(A.OpenAccess).behaviour;
                if(behaviour === "hres:list:open-access:gold") {
                    oaGoldOutputs[year] = (oaGoldOutputs[year] || 0)+1;
                } else if(behaviour === "hres:list:open-access:green") {
                    oaGreenOutputs[year] = (oaGreenOutputs[year] || 0)+1;
                } else if(behaviour === "hres:list:open-access:not-open-access") {
                    oaNotOAOutputs[year] = (oaNotOAOutputs[year] || 0)+1;
                }
            }
        }
    });
    row.oaGoldOutputs = oaGoldOutputs;
    row.oaGreenOutputs = oaGreenOutputs;
    row.oaNotOAOutputs = oaNotOAOutputs;
    row.oaTotalEligibleOutputs = oaTotalEligibleOutputs;
};

// Expose to other plugins that may want to add these facts to their collections
P.implementService("hres_repo_open_access:add_oa_facts_to_collection", addOAFactsToCollection);
P.implementService("hres_repo_open_access:get_oa_facts_for_object", getOAFactsForObject);

P.implementService("std:reporting:collection:research_institutes:setup", addOAFactsToCollection);
P.implementService("std:reporting:collection:research_institutes:get_facts_for_object", function(object, row) {
    getOAFactsForObject(object, row, function(row, relevant, item) {
        var author = item.first(A.Author);
        if(author) {
            var rI = author.load().first(A.ResearchInstitute);
            var scan = 0;
            while(rI && scan < 10) {
                if(rI == row.ref) {
                    relevant.push(item);
                }
                rI = rI.load().firstParent();
                scan++;
            }
        }
    });
});

var getItemListUrl = function(oaType, riType, riRef, year) {
    var linkTypeString = (riType == T.Faculty ? "faculty" : "department");
    var url = "/do/hres-repo-open-access/repository-items/"+oaType+"/"+linkTypeString+"/"+riRef;
    if(year) {
        url = url+"?year="+year;
    }
    return url;
};

P.respond("GET,POST", "/do/hres-repo-open-access/research-institutes", [
    {pathElement:0, as:"ref"},
    {parameter:"year", as:"int", optional:true}
], function(E, type, year) {
    CanViewOADashboards.enforce();
    var dashboard = P.reporting.dashboard(E, {
        kind: "list",
        collection: "research_institutes",
        name: "oa_research_institutes",
        title: "Open Access: "+SCHEMA.getTypeInfo(type).name
    }).
        use("hres:schema:calendar_year_navigation_for_json_columns", year).
        filter(function(select) {
            select.where("type", "=", type);
        }).
        columns(0, [
            {fact: "ref", heading: SCHEMA.getTypeInfo(type).name, link: true}
        ]);
    if(type == T.Department) {
        dashboard.columns(25, [{fact:"parent", heading:"Faculty"}]);
    }
    dashboard.columns(100, [
            {
                type:"linked", column:"oaGreenOutputs", link: function(row) {
                    return getItemListUrl("green", type, row.ref, year);
            }},{
                type:"linked", column:"oaGoldOutputs", link: function(row) {
                    return getItemListUrl("gold", type, row.ref, year);
            }},{
                type:"linked", column:"oaNotOAOutputs", link: function(row) {
                    return getItemListUrl("not-oa", type, row.ref, year);
            }},{
                type:"linked", column:"oaTotalEligibleOutputs", link: function(row) {
                    return getItemListUrl("all", type, row.ref, year);
            }}
        ]).
        respond();
});

P.implementService("hres_repo_open_access:custom_dashboard_filtering", function(details, pathElements) {
    if(pathElements[0] === "department" || pathElements[0] === "faculty") {
        var ref = O.ref(pathElements[1]);
        details.filter = function(select) {
            select.where(pathElements[0], "=", ref);
        };
        details.title = ref.load().title+" ("+details.title+")";
    }
});
