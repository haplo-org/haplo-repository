/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var TEST_PREFIX = "10.5072/";

P.implementService("hres_repository:test_data:pre_item_save", function(generator, repositoryItem) {

    // Add dummy DOIs to repository items. Note that these will not resolve,
    // and are just for display purposes
    if(Math.random() < 0.5) {
        repositoryItem.append(P.DOI.create(TEST_PREFIX+Math.random()), A.DOI);
    }

});
