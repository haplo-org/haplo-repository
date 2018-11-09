/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// NOTE: Called 'Outputs' in the UI, even if they're not strictly speaking outputs, as this is a recognisable term
P.implementService("std:action_panel:category:hres:person", function(display, builder) {
    builder.panel(1600).link("default", "/do/repository/outputs/researcher/"+display.object.ref, "Research outputs");
});

var myOutputsBuilder = function(builder, user) {
    if(user.ref) {
        builder.link("default", "/do/repository/outputs/researcher/"+user.ref, "My Research Outputs");
    }
};
P.implementService("std:action_panel:home_page_my_links", function(display, builder) {
    myOutputsBuilder(builder, O.currentUser);
});
P.implementService("std:action_panel:activity:my_items:repository", function(display, builder) {
    myOutputsBuilder(builder, O.currentUser);
});

var PANEL_SERVICES = {
    "faculty": "faculty_navigation",
    "department": "department_navigation",
    "research-group": "research_group_navigation"
};
_.each(PANEL_SERVICES, function(panel, kind) {
    P.implementService("std:action_panel:"+panel, function(display, builder) {
        builder.panel(1600).
            element(0, {title:"Outputs"}).
            link("default", "/do/repository/outputs/"+kind+"/"+display.object.ref, "Recent outputs");
    });
});

// -------- Outputs information page ----------------

P.respond("GET", "/do/repository/outputs", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"object"}
], function(E, kindStr, object) {
    var kind = KIND_HANDLING[kindStr];
    if(!kind) { O.stop("Bad url requested."); }
    let selected = E.request.parameters;
    let filterData = getFilterData(selected);
    let info = O.service("haplo:information_page:overview", {
        buildService: "hres_repo_navigation:repository_item_page",
        pageTitle: "Research outputs",
        object: object
    });
    info.
        keyObject(0, object).
        section(100, P.template("outputs").deferredRender({
            query: makeQueryString(selected, kind, object),
            sort: "date",
            showResultCount: true,
            showSearchWithinLink: true
        })).
        sidebar.panel(10000).style("special").element(1, {
            deferred: P.template("search-filter").deferredRender({
                filterData: filterData
            })
        });
    info.respond(E);
});

// ---------- Filtering ------------------------

var KIND_HANDLING = {
    researcher(researcher) {
        return "#L"+researcher.ref.toString()+"/d"+A.Author.toString()+"#"+
                " or (#L"+researcher.ref.toString()+"/d"+A.Editor.toString()+"# and #L"+T.Book.toString()+
                "/d"+A.Type.toString()+"#)";
    },
    faculty(institute) {
        return "(>> (#L"+institute.ref.toString()+"# and type:person))";
    }
};
KIND_HANDLING["department"] = KIND_HANDLING.faculty;
KIND_HANDLING["research-group"] = KIND_HANDLING.faculty;

var getFilterData = function(selected) {
    let data = [];
    let yearOptions = [];
    let date = new XDate();
    for(let x = 0; x < 20; x++) {
        yearOptions.push(date.toString("yyyy"));
        date.addYears(-1);
    }
    data.push({
        title: "Year",
        isDropdownSelection: true,
        parameter: "y",
        options: _.map(yearOptions, (year) => { 
            return { yearStr:year, selected:selected["y"] === year };
        })
    });
    let types = [];
    if(O.serviceImplemented("hres:repository:ingest_ui:types")) {
        let sortedTypes = O.serviceMaybe("hres:repository:ingest_ui:types");
        types = types.concat(_.map(sortedTypes.primaryTypes, (typeInfo) => typeInfo.ref.load()));
        types = types.concat(_.map(sortedTypes.secondaryTypes, (typeInfo) => typeInfo.ref.load()));
    } else {
        types = _.map(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), (t) => t.load());
        types = _.sortBy(types, (t) => t.title);
    }
    data.push(
        getFilterObject(
            selected,
            "Output types",
            types,
            "t"
        )
    );
    return data;
};

var getFilterObject = function(selected, title, filterValues, parameter) {
    return {
        title: title,
        objs: _.map(filterValues, (f) => {
            let str = f.ref.toString();
            return {
                ref: str,
                parameter: parameter,
                checked: (selected[parameter] ? (_.keys(selected[parameter]).indexOf(str) !== -1) : false),
                title: f.title
            };
        })
    };
};

var makeQueryString = function(selected, kindQuery, object) {
    let str = "("+kindQuery(object)+") and (";
    let types = "t" in selected ? _.keys(selected.t) :
        _.map(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), (t) => t.toString());
    _.each(types, (refStr, index) => {
        str += (!!index ? " or " : "")+"#L"+refStr+"/d"+A.Type.toString()+"#";
    });
    str += ")";
    if(selected.y) {
        str += " and date: "+selected.y+"-01-01 .. "+selected.y+"-12-31";
    }
    return str;
};