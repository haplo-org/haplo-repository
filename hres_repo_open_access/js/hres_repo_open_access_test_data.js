/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.implementService("hres_repository:test_data:pre_project_save", function(generator, repositoryItem) {
    // OA only applies to journal article/conference items (assumption inferred from schema)
    if(repositoryItem.isKindOf(T.JournalArticle) || repositoryItem.isKindOf(T.ConferenceItem)) {
        var oaDistribution = [
            0.2, O.behaviourRefMaybe("hres:list:open-access:not-open-access"),
            0.5, O.behaviourRefMaybe("hres:list:open-access:green"),
            0.8, O.behaviourRefMaybe("hres:list:open-access:gold"),
            1, null
        ];
        var oa = generator.randomDistributedValue(oaDistribution);
        if(oa) { repositoryItem.append(oa, A.OpenAccess); }
    }
});
