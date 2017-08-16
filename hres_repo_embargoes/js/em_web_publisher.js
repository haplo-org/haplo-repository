/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("hres_repo_file_restrictions:collect_file_restrictions", function(user, object, restrictions) {
    
    var embargo = P.getEmbargoData(object);
    if(embargo && embargo.isUnderEmbargo()) {
        restrictions.push({
            sort: 10,
            deferredRender: function(E, context, options) {
                return P.template("web-publisher/restriction-panel").deferredRender({
                    dates: embargo.getDatesForDisplay()
                });
            }
        });
    }
    
});