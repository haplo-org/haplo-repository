/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("hres:repository:earliest_publication_date", function(object) {
    if(object.isKindOfTypeAnnotated('hres:annotation:repository:practice-based-research')) {
        if(object.first(A.Date)) {
            return object.first(A.Date).start;
        }
    }
});

P.hresAuthorCitation.shadowAttribute(A.BookAuthor, A.BookAuthorShadowed);
P.hresAuthorCitation.shadowAttribute(A.Contributors, A.ContributorShadowed);
