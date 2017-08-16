/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.implementService("hres_repository:test_data:pre_project_save", function(generator, repositoryItem) {
    // isREFOARelevant implies article/conference items are the main things where this is cared about
    // so higher chance for them to have a REF attr
    if(repositoryItem.isKindOf(T.JournalArticle) || repositoryItem.isKindOf(T.ConferenceItem)) {
        if(Math.random() > 0.8) { return; } // % that get a ref unit
    } else {
        if(Math.random() > 0.15) { return; } // % that get a ref unit
    }
    var refUnits = O.query().link(T.REFUnitOfAssessment, A.Type).execute(); // slow/expensive query? cache?
    var unit = generator.randomListMember(refUnits);
    if(unit && unit.ref) { repositoryItem.append(unit, A.REFUnitOfAssessment); }
});
