/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// TODO: Make list of types for repository editors to maintain configurable (remembering permissions to edit)
var LIST_TYPES = [T.Publisher, T.Journal];
if("Funder" in T) {
    LIST_TYPES.push(T["Funder"]);
}

// --------------------------------------------------------------------------

P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    setup.groupPermission(Group.RepositoryEditors, "read-write", T.Organisation);
    setup.groupPermission(Group.RepositoryEditors, "read-write", T.Journal);
});

var CanManageRepositoryLists = O.action("hres:action:repository:manage-lists").
    title("Manage lists of objects relevant to the Repository").
    allow("group", Group.RepositoryEditors);

// --------------------------------------------------------------------------

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(CanManageRepositoryLists)) {
        var panel = builder.panel(1300).title("Manage lists");
        LIST_TYPES.forEach(function(type) {
            panel.link(100, "/do/repository-list-management/list/"+type, SCHEMA.getTypeInfo(type).name);
        });
    }
});

P.respond("GET", "/do/repository-list-management/list", [
    {pathElement:0, as:"ref"}
], function(E, type) {
    CanManageRepositoryLists.enforce();
    E.render({
        type: type,
        name: SCHEMA.getTypeInfo(type).name,
        search: {
            query: "#L"+type+"#",
            sort: "title",
            miniDisplay: true,
            showResultCount: true,
            showSearchWithinLink: true
        }
    });
});

P.respond("GET", "/do/repository-list-management/new", [
    {pathElement:0, as:"ref"}
], function(E, type) {
    CanManageRepositoryLists.enforce();
    var templateObject = O.object();
    templateObject.appendType(type);
    var listurl = "/do/repository-list-management/list/"+type;
    E.render({
        pageTitle: "New "+SCHEMA.getTypeInfo(type).name,
        backLink: listurl, backLinkText: "Cancel",
        templateObject: templateObject,
        successRedirect: listurl
    }, "std:new_object_editor");
});
