/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var DISABLE_OA_SERVICE_FOR_OA_TYPE = O.application.config["hres_repo_open_access:disable_oa_service_for_oa_type"] || [];

P.implementService("hres:repository:open_access:is_green_oa", function(object) {
    if(_.contains(DISABLE_OA_SERVICE_FOR_OA_TYPE, "green")) { return; }
    return !!object.getAttributeGroupIds(A.AcceptedAuthorManuscript).length;
});
P.implementService("hres:repository:open_access:is_not_oa", function(object) {
    if(_.contains(DISABLE_OA_SERVICE_FOR_OA_TYPE, "not")) { return; }
    return (!object.first(A.OpenAccess) && !object.getAttributeGroupIds(A.AcceptedAuthorManuscript).length);
});

// --------------------------------------------------------------------------
// Test data generation

P.implementService("hres_repository:test_data:pre_item_save", function(generator, repositoryItem) {
    // OA only applies to journal article/conference items (assumption inferred from schema)
    if(repositoryItem.isKindOf(T.JournalArticle) || repositoryItem.isKindOf(T.ConferenceItem)) {
        var oaDistribution = [
            0.3, O.behaviourRefMaybe("hres:list:open-access:gold"),
            1, null
        ];
        var oa = generator.randomDistributedValue(oaDistribution);
        if(oa) { repositoryItem.append(oa, A.OpenAccess); }
    }
});
