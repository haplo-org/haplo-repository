/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:descriptive_object_labelling:setup", function(type) {
    type(T.Impact, {
        labels: [Label.ActivityRepository],
        labelWithCreator: true,
        labelWith: [A.Researcher]
    });

    type(T.ImpactEvidence, {
        labels: [Label.ActivityRepository],
        labelWithCreator: true,
        labelWith: [A.Researcher]
    });
});

P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    // TODO: better permissions
    setup.groupPersonalRole(Group.Everyone, "Is: Repository Impact Editor");
    
    setup.groupPermission(Group.Everyone, "create", T.Impact);
    setup.groupPermission(Group.Everyone, "create", T.ImpactEvidence);
    setup.roleOversightPermission("Is: Repository Impact Editor", "read-edit", [T.Impact, T.ImpactEvidence]);

    setup.groupPermission(Group.RepositoryEditors, "read-write", T.Impact);
    setup.groupPermission(Group.RepositoryEditors, "read-write", T.ImpactEvidence);
});

// TODO: Remove this when haplo_user_roles_permissions has been extended to check changes to object labels
// Implemented to allow people with edit permissions to edit authors and other label-controlling attributes.
P.hook("hOperationAllowOnObject", function(response, user, object, operation) {
    if((operation === "relabel") &&
        (object.isKindOf(T.Impact) || object.isKindOf(T.ImpactEvidence)) &&
        object.labels.includes(user.ref)) {
        response.allow = true;
    }
});

// ----------------------------------------------------------
// For public access via service users

P.hook('hUserPermissionRules', function(response, user) {
    if(user.isMemberOf(Group.PublicRepositoryAccess)) {
        // TODO: Label AcceptedIntoRepository?
        response.rules.rule(T.Impact, O.STATEMENT_ALLOW, O.PERM_READ);
    }
});
