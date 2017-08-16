/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanDownloadAllRepositoryFiles = O.action("hres_repo_access_level_policy:bypass_restrictions").
    title("Download All Repository Files").
    allow("group", Group.RepositoryEditors).
    allow("group", Group.DataPreparers);

var filesAreRestrictedFor = 
    P.filesAreRestrictedFor = function(user, object) {
    if(O.serviceMaybe("hres:repository:is_repository_item", object) &&
        !(user.allowed(CanDownloadAllRepositoryFiles) ||
          O.serviceMaybe("hres:repository:is_author", user, object))) {
        return filesAreRestricted(object);
    }
};

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

P.hook('hPreFileDownload', function(response, file, transform) {
    var allow = false;
    var objects = O.query().identifier(file.identifier()).execute();
    if(objects.length) {
        _.each(objects, function(object) {
            if(allow) { return; }
            if(!filesAreRestrictedFor(O.currentUser, object)) {
                allow = true;
            }
        });
    } else {
        allow = true; // not attached to any object?
    }
    if(!allow) {
        response.redirectPath = O.serviceMaybe("hres_repo_access_level_policy:access_redirect_path", file) ||
            "/do/hres-repo-acess-level-policy/denied";
    }
});

P.respond("GET", "/do/hres-repo-acess-level-policy/denied", [
], function(E) {
    E.render({
        pageTitle: "File access restricted",
        message: "Access to this file is restricted. Please contact the repository administrators to request "+
            "a copy of the file"
    }, "std:ui:notice");
});
