/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    setup.groupRestrictionLabel(Group.RepositoryEditors, Label.LiftAllFileControls);
    
    setup.groupRestrictionLabel(Group.DataPreparers, Label.LiftAllFileControls);
    setup.groupRestrictionLabel(Group.DataPreparers, Label.ViewPreparedFiles);
});

P.hook("hObjectAttributeRestrictionLabelsForUser", function(response, user, object) {
    if(O.serviceMaybe("hres:repository:is_author", user, object)) {
        response.userLabelsForObject.add(Label.LiftAllFileControls);
    }
});

P.implementService("hres:repository:access_requests:has_restricted_files_for_user", function(user, object) {
    if(object.labels.includes(Label.ControlAllFiles)) {
        var hasControlledFiles = false;
        object.every(function(v,d,q) {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                if(!object.canReadAttribute(d, user)) { 
                    hasControlledFiles = true;
                }
            }
        });
        return hasControlledFiles;
    }
});

// -------------------------------------------------------------------

var filesAreRestricted = function(object) {
    var access = object.first(A.AccessLevel);
    var dataTypes = SCHEMA.getTypesWithAnnotation("hres:annotation:repository:research-data");
    // Data files are more sensitive - restrict by default
    if(_.any(dataTypes, function(type) { return object.isKindOf(type); })) {
        return !(access && access.behaviour === "hres:list:file-access-level:open");
    } else {
        return (access && access.behaviour !== "hres:list:file-access-level:open");
    }
};

var modifyLabelChangesForRepoObject = function(object, changes) {
    // These are removed from the 'remove' list when they are later 'added'
    changes.remove([
        Label.ControlAllFiles
    ]);
    // TODO: Currently is only a "whole object" access level - this should be extended to 
    // apply a restriction per attribute when the schema is extended
    if(filesAreRestricted(object)) {
        changes.add(Label.ControlAllFiles);
    }
};

// TODO: Remove this workaround as soon as possible.
// Authors shouldn't have general relabel permissions, but *can* change the access level of files
P.hook("hPostObjectChange", function(response, object, operation, previous) {
    if(operation === "create" || operation === "update") {
        if(O.service("hres:repository:is_repository_item", object)) {
            var shouldBeRestricted = filesAreRestricted(object);
            var isRestricted = object.labels.includes(Label.ControlAllFiles);
            if(shouldBeRestricted !== isRestricted) {
                O.background.run("hres_repo_access_level_policy:TEMP_relabel_on_change", {ref: object.ref.toString()});
            }
        }
    }
});

P.backgroundCallback("TEMP_relabel_on_change", function(data) {
    O.withoutPermissionEnforcement(function() {
        var object = O.ref(data.ref).load();
        var changes = O.labelChanges();
        modifyLabelChangesForRepoObject(object, changes);
        object.relabel(changes);
    });
});
