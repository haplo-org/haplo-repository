/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("hres_repository:test_data:pre_item_save", function(generator, repositoryItem) {

    if(repositoryItem.isKindOfTypeAnnotated("hres:annotation:repository:practice-based-research")) {
        let citations = [];
        repositoryItem.remove(A["hres:attribute:authors-citation"], (v,d,q) => {
            citations.push(v);
            return true; // remove
        });
        _.each(citations, (v) => {
            let q = (Math.random() > 0.4) ? SCHEMA.QUAL[generator.randomListMember(CREATOR_QUALS)] : null;
            repositoryItem.append(v, A["hres:attribute:authors-citation"], q);
        });
    }

});

var CREATOR_QUALS = [
    "hres:qualifier:actor",
    "hres:qualifier:animator",
    "hres:qualifier:author-of-screenplay",
    "hres:qualifier:calligrapher",
    "hres:qualifier:choreographer",
    "hres:qualifier:cinematographer",
    "hres:qualifier:composer",
    "hres:qualifier:conductor",
    "hres:qualifier:conference-organizer",
    "hres:qualifier:costume-designer",
    "hres:qualifier:curator",
    "hres:qualifier:dancer",
    "hres:qualifier:designer",
    "hres:qualifier:director",
    "hres:qualifier:exhibitor",
    "hres:qualifier:film-editor",
    "hres:qualifier:illustrator",
    "hres:qualifier:instrumentallist",
    "hres:qualifier:librettist",
    "hres:qualifier:lighting-designer",
    "hres:qualifier:lyricist",
    "hres:qualifier:musician",
    "hres:qualifier:performer",
    "hres:qualifier:photographer",
    "hres:qualifier:printmaker",
    "hres:qualifier:producer",
    "hres:qualifier:production-personnel",
    "hres:qualifier:programmer",
    "hres:qualifier:recording-engineer",
    "hres:qualifier:researcher",
    "hres:qualifier:set-designer",
    "hres:qualifier:singer",
    "hres:qualifier:translator",
    "hres:qualifier:videographer",
    "hres:qualifier:vocalist"
];
