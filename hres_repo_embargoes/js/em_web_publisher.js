/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("hres_repo_publication_common:collect_renders_for_file_groups", function(object, groupDesc, restrictions) {
    let q = P.getEmbargoData(object);
    if(q) {
        q.or(function(sq) {
            sq.where("desc", "=", groupDesc).
                where("desc", "=", null);
        });
        let activeEmbargoes = _.filter(q, (embargo) => {
            return embargo.isActive();
        });
        if(activeEmbargoes.length) {
            restrictions.push({
                sort: 10,
                deferredRender: P.template("web-publisher/restriction-panel").deferredRender({
                    embargoes: _.map(activeEmbargoes, (embargo) => {
                        // Find the number of files affected by this embargo in a non-crappy and terrible way
                        let number = 0;
                        if(embargo.extensionGroup) {
                            var group = object.extractSingleAttributeGroupMaybe(embargo.extensionGroup);
                            // Group can be missing if it's deleted from the object record without the corresponding embargo being removed
                            if(group) {
                                number = group.every(A.File).length;
                            }
                        }
                        return {
                            multipleFiles: (number > 1) ? number : false,
                            end: embargo.end
                        };
                    })
                })
            });
        }
   }
});