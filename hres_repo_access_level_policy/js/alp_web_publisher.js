/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("hres_repo_file_restrictions:collect_file_restrictions", function(user, object, restrictions) {

    if(P.filesAreRestrictedFor(O.currentUser, object)) {
        restrictions.push({
            sort: 250,
            deferredRender: function(E, context, options) {
                var requestUrl = O.serviceMaybe("hres:repository:web_publisher:access_request_start_url", context.object);
                if(requestUrl) {
                    return P.template("web-publisher/restriction-panel").deferredRender({
                        requestUrl: requestUrl
                    });
                }
            }
        });
    }
    
});
