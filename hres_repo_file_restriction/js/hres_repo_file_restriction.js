/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


if(O.featureImplemented("std:web-publisher")) {

    P.use("std:web-publisher");

    var collectApplicableRestrictionsFor = function(user, object) {
        var applicableRestrictions = [];
        O.serviceMaybe("hres_repo_file_restrictions:collect_file_restrictions", user, object, applicableRestrictions);
        return applicableRestrictions;
    };

    P.webPublication.pagePart({
        name: "hres:repository:restricted-files",
        category: "hres:repository:output:sidebar",
        sort: 500,
        deferredRender: function(E, context, options) {
            var applicableRestrictions = collectApplicableRestrictionsFor(O.currentUser, context.object);
            if(applicableRestrictions.length) {
                var restriction = _.sortBy(applicableRestrictions, 'sort')[0];
                return restriction.deferredRender(E, context, options);
            } 
        }
    });

    P.webPublication.feature("hres:repository:file-restriction", function(publication) {

        publication.addFileDownloadPermissionHandler(function(fileOrIdentifier, result) {
            var objects = O.query().identifier(fileOrIdentifier.identifier()).execute();
            var restricted = _.every(objects, function(object) {
                return collectApplicableRestrictionsFor(O.currentUser, object).length;
            });
            if(restricted) {
                // TODO: Currently rely on unguessable file digest hash for security of files. Will add
                // further layer of security to this in future versions.
                // result.deny = true;
            }
        });
        
    });

}
