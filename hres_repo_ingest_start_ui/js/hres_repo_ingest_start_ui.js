/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var AAMGuidanceNote = P.guidanceNote("repository", "ingest-aam",
    "Accepted Author Manuscript", "guidance/accepted-author-manuscript.xml");

// --------------------------------------------------------------------------

var CanViewRepositoryDashboards = O.action("hres:action:repository:view-overview-dashboards");

var CanAddOutput = O.action("hres:repository:ingest_start_ui:add_respository_item").
    title("Add repository item through simple ingest process").
    allow("group", Group.RepositoryEditors);

P.implementService("hres_repo_navigation:repository_item_page", function(object, builder) {
    // TODO: Better permissions for adding repository items via the UI
    if((O.currentUser.ref == object.ref) || O.currentUser.allowed(CanAddOutput)) {
        builder.sidebar.link("default", "/do/repository-ingest-start-ui/new-for/"+object.ref, "Add output", "primary");
    }
});

P.implementService("hres:repository:new_repository_item_url", function(person, type) {
    return P.template("new-for-edit-url").render({
        type: type,
        person: person.ref
    });
});

// --------------------------------------------------------------------------
// Dashboard for the re-ordering of output types

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(CanViewRepositoryDashboards)) {
        builder.panel(99999).
            link(400, "/do/repository-ingest-start-ui/admin-order", "Re-order repository output types");
    }
});
P.implementService("std:action_panel:activity:my_items:repository", function(display, builder) {
    if(O.currentUser.allowed(CanAddOutput)) {
        builder.panel(150).
            link(150, "/do/repository-ingest-start-ui/new-for", "Add output");
    }
});

// category can take values:
//  - primary
//  - secondary
//  - hidden
P.db.table("repositoryItemTypes", {
    type: { type: "ref" },
    priority: { type: "int" },
    category: { type: "text" }
});

P.respond("GET", "/do/repository-ingest-start-ui/admin-order", [
    {parameter: "updated", as: "int", optional: true},
], function(E, updated) {
    CanViewRepositoryDashboards.enforce();

    var types = getTypes();

    var primaryDivider = {
        dividerType: "divider-primary",
        dividerText: "Place important types above this line"
    };
    var hiddenTypesDivider = {
        dividerType: "divider-hidden",
        dividerText: "Types below this point will be hidden"
    };

    var allTypes = types.primaryTypes.concat(types.secondaryTypes).concat(types.hiddenTypes);
    var typesAndDividers = [];
    var previousCategory;
    _.each(allTypes, function(type) {
        if(type.category === "secondary" && previousCategory === "primary") {
            typesAndDividers.push(primaryDivider);
        }
        if(type.category === "hidden" && previousCategory && previousCategory !== "hidden") {
            typesAndDividers.push(hiddenTypesDivider);
            if(!_.some(typesAndDividers, (type) => type.dividerType === "divider-primary")) {
                typesAndDividers.push(primaryDivider);
            }
        }
        previousCategory = type.category;
        typesAndDividers.push(type);
    });

    if(!_.some(allTypes, (type) => type.category === "hidden")) {
        typesAndDividers.push(hiddenTypesDivider);
        if(!_.some(typesAndDividers, (type) => type.dividerType === "divider-primary")) {
            typesAndDividers.push(primaryDivider);
        }
    }

    E.render({
        updated: !!updated,
        types: typesAndDividers,
        backLink: "/do/activity/repository"
    });
});

P.respond("POST", "/do/repository-ingest-start-ui/admin-order/submit", [
    {parameter: "types", as: "string", optional: false}
], function(E, typesStr) {
    CanViewRepositoryDashboards.enforce();

    var types = typesStr.split(',');

    var areNotRefs = _.some(types,
        (type) => !(type === "divider-primary" || type === "divider-hidden" || O.ref(type))
    );
    if(areNotRefs) {
        O.stop("System Error: incorrect POST format");
    }

    P.db.repositoryItemTypes.select().deleteAll();

    var category = "primary";
    var priorityCounter = 1;
    _.each(types, function(type){
        if(type === "divider-primary" ) {
            if(category !== "hidden") {
                category = "secondary";
            }
            return;
        }
        if(type === "divider-hidden") {
            category = "hidden";
            return;
        }
        var ref = O.ref(type);
        if(ref.load()){
            P.db.repositoryItemTypes.create({
                type: ref,
                priority: priorityCounter,
                category: category
            }).save();
        }
        priorityCounter++;
    });

    E.response.redirect("/do/repository-ingest-start-ui/admin-order?updated=1");
});

// --------------------------------------------------------------------------

var notes = O.refdict();
if("ConferenceItem" in T) {
    notes.set(T.Book, 'A published book or conference volume. For grey literature such as technical reports or discussion papers use "Report" instead.');
    notes.set(T.BookChapter, "A chapter or section in a book, normally distributed through commercial channels. Use for conference papers published in the proceedings.");
    notes.set(T.ConferenceItem, 'A paper, poster, speech, lecture or presentation given at a conference, workshop or other event, or an artistic exhibition or performance. If the conference item has been published in a journal or published proceedings then please use "Article" or "Book Section" instead.');
    notes.set(T.Report, 'A monograph that would not be classified as a book. Examples include technical reports, project reports, documentation, manuals, working papers or discussion papers.');
    notes.set(T.Patent, 'A published patent. Do not include as yet unpublished patent applications.');
}

var getTypes = function() {

    var infosWithEntries = [];
    var infosWithoutEntries = [];

    _.each(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), function(type) {
        var typeEntries = P.db.repositoryItemTypes.select().where("type", "=", type);

        var info = SCHEMA.getTypeInfo(type);

        var hasEntry = typeEntries.length > 0;
        if(hasEntry) {
            var typeEntry = _.first(typeEntries);

            infosWithEntries.push({
                ref: type,
                name: info.name,
                category: typeEntry.category,
                priority: typeEntry.priority
            });
        } else {
            infosWithoutEntries.push({
                ref: type,
                name: info.name,
                category: undefined,
                priority: undefined
            });
        }
    });

    infosWithEntries = _.sortBy(infosWithEntries, "priority");
    infosWithoutEntries = _.sortBy(infosWithoutEntries, "name");

    var infos = infosWithEntries.concat(infosWithoutEntries);

    var primaryTypes = [];
    var secondaryTypes = [];
    var hiddenTypes = [];
    _.each(infos , function(info) {
        var typesList;
        if(info.category === "hidden") {
            typesList = hiddenTypes;
        } else if(info.category === "primary") {
            typesList = primaryTypes;
        } else {
            typesList = secondaryTypes;
        }
        typesList.push(info);
    });

    return {
        primaryTypes: primaryTypes,
        secondaryTypes: secondaryTypes,
        hiddenTypes: hiddenTypes
    };
};

P.implementService("hres:repository:ingest_ui:types", function() {
    var allTypes = getTypes();
    delete allTypes.hiddenTypes;
    return allTypes;
});

// --------------------------------------------------------------------------

P.respond("GET", "/do/repository-ingest-start-ui/new-for", [
    {pathElement:0, as:"object", optional:true}
], function(E, researcher) {
    var types = getTypes();
    var primaryTypes = types.primaryTypes;
    var secondaryTypes = types.secondaryTypes;
    var options = function(list) {
        return {options: _.chain(list)
            .filter( (i) => i.category !== "hidden")
            .map(function(i) {
                var guidanceRequired;
                if(O.serviceImplemented("hres_repo_ingest_start_ui:guidance_required")) {
                    guidanceRequired = O.service("hres_repo_ingest_start_ui:guidance_required", i.ref);
                } else {
                    guidanceRequired = (-1 !== SCHEMA.getTypeInfo(i.ref).attributes.indexOf(A.AcceptedAuthorManuscript));
                }
                return {
                    action: (guidanceRequired ? 
                        "/do/repository-ingest-start-ui/guidance-for/" :
                        "/do/repository-ingest-start-ui/new-for-edit/")+i.ref+(researcher ? '/'+researcher.ref : ""),
                    label: i.name,
                    indicator: "standard",
                    notes: notes.get(i.ref)
                };
            })
            .value()
        };
    };
    let primaryTypesOptions = options(primaryTypes);
    let secondaryTypesOptions = options(secondaryTypes);
    E.render({
        researcher: researcher,
        primary: primaryTypesOptions,
        secondary: secondaryTypesOptions,
        shouldHidePrimaryDivider: primaryTypesOptions.options.length === 0 || secondaryTypesOptions.options.length === 0
    });
});

// --------------------------------------------------------------------------

P.respond("GET", "/do/repository-ingest-start-ui/guidance-for", [
    {pathElement:0, as:"ref"},
    {pathElement:1, as:"object", optional:true}
], function(E, type, researcher) {
    E.renderIntoSidebar({
        elements: [{
            href: '/do/repository-ingest-start-ui/new-for-edit/'+type+(researcher ? '/'+researcher.ref : ""),
            label: "Continue",
            indicator: "primary"
        }]
    }, "std:ui:panel");
    E.render({
        researcher: researcher,
        typeInfo: SCHEMA.getTypeInfo(type),
        guidance: (O.serviceImplemented("hres_repo_ingest_start_ui:custom_guidance_for_output") ?
            O.service("hres_repo_ingest_start_ui:custom_guidance_for_output", type) :
            AAMGuidanceNote).deferredRender()
    });
});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/repository-ingest-start-ui/new-for-edit", [
    {pathElement:0, as:"ref"},
    {pathElement:1, as:"object", optional:true}
], function(E, type, researcher) {
    // Display template object
    var templateObject = O.object([Label.RepositoryItem]);
    templateObject.appendType(type);
    var attr = A.Author;
    var typeInfo = SCHEMA.getTypeInfo(type);
    if(-1 !== typeInfo.attributes.indexOf(A.EditorsCitation) && researcher) {
        // Type uses editors, ask user about their role, set desc
        if("role" in E.request.parameters) {
            if(E.request.parameters.role === 'editor') {
                attr = A.Editor;
            }
        } else {
            return E.render({   
                researcher: researcher,
                typeInfo: typeInfo,
                options: [
                    {action:"?role=author", label:"Author", notes:"I'm an author of this item", indicator:"standard"},
                    {action:"?role=editor", label:"Editor", notes:"I edited this item", indicator:"standard"}
                ]
            }, "new-output-role");
        }
    }
    if(researcher) {
        O.service("hres:author_citation:append_citation_to_object", templateObject, attr, null, {object:researcher});
    }
    E.render({
        researcher: researcher,
        type: type,
        typeInfo: typeInfo,
        templateObject: templateObject
    }, "new-output");
});
