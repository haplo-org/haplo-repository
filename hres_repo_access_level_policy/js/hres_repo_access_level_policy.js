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

P.hook("hObjectAttributeRestrictionLabelsForUser", function(response, user, object, container) {
    if(O.serviceMaybe("hres:repository:is_author", user, object)) {
        response.userLabelsForObject.add(Label.LiftAllFileControls);
    }
    if(container && O.serviceMaybe("hres:repository:is_author", user, container)) {
        response.userLabelsForObject.add(Label.LiftAllFileControls);
    }
});

var objectOrGroupHasControlledFiles = function(user, obj) {
    // Check to ensure a restriction is due to access level policy, not something else
    if(obj.labels.includes(Label.ControlAllFiles) ||
        obj.labels.includes(Label.RestrictAllFiles) || 
        obj.labels.includes(Label.SafeguardAllFiles)) {
        var hasControlledFiles = false;
        obj.every(function(v,d,q) {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                if(!obj.canReadAttribute(d, user)) {
                    hasControlledFiles = true;
                }
            }
        });
        return hasControlledFiles;
    }
};

P.implementService("hres:repository:access_requests:has_restricted_files_for_user", function(user, object) {
    var objectGroups = object.extractAllAttributeGroups();
    var hasControlledFiles = false;
    if(objectOrGroupHasControlledFiles(user, object)) { hasControlledFiles = true; }
    _.each(objectGroups.groups, function(group) {
        if(objectOrGroupHasControlledFiles(user, group.object)) { hasControlledFiles = true; }
    });
    return hasControlledFiles;
});

// -------------------------------------------------------------------

P.hook("hLabelAttributeGroupObject", function(response, container, object, desc, groupId) {
    // These will be removed from the 'remove' list if they are later 'added'
    response.changes.remove([Label.ControlAllFiles, Label.RestrictAllFiles, Label.SafeguardAllFiles]);
    var accessLevel = object.first(A.AccessLevel);
    if(accessLevel) {
        if(accessLevel.behaviour === "hres:list:file-access-level:controlled") {
            response.changes.add(Label.ControlAllFiles);
        } else if(accessLevel.behaviour === "hres:list:file-access-level:restricted") {
            response.changes.add(Label.RestrictAllFiles);
        } else if(accessLevel.behaviour === "hres:list:file-access-level:safeguarded") {
            response.changes.add(Label.SafeguardAllFiles);
        }
    } else {
        // Data file deposits are closed by default
        if(container.isKindOfTypeAnnotated("hres:annotation:repository:research-data")) {
            response.changes.add([Label.ControlAllFiles, Label.RestrictAllFiles, Label.SafeguardAllFiles]);
        }
    }
});
