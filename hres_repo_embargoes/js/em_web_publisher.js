/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("hres_repo_publication_common:collect_renders_for_restricted_desc", function(object, desc, restrictions) {
    
    var q = P.getEmbargoData(object);
    if(q) {
        q.or(function(sq) {
            // TODO remove this when "whole object" restrictions are implemented in the Publication UI
            sq.where("desc", "=", desc).
                where("desc", "=", null);
        });
        if(q.length) {
            var activeEmbargoes = _.filter(q, function(embargo) {
                return embargo.isActive();
            });
            if(activeEmbargoes.length) {
                restrictions.push({
                    sort: 10,
                    deferredRender: P.template("web-publisher/restriction-panel").deferredRender({
                        embargoes: _.map(activeEmbargoes, function(embargo) {
                            return {
                                end: embargo.end
                            };
                        })
                    })
                });
            }
        }
   }
 
});