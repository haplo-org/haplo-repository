/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

t.test(function() {
    // --------------------------------------------------------------------------
    // Setup
    let matchObject;
    let matchServices = O.service("haplo:service-registry:query", [
        "conforms-to hres:repository:match-item-to-existing-in-list",
        "list-of repository-items"
    ]);

    let createObjectWithPMID = function(pmid, desc) {
        return O.object().
            appendType(TYPE["std:type:book"]).
            append(pmid, desc);
    };

    let pmidOne = P.PMID.create(Math.random().toString());
    let pmidTwo = P.PMID.create(Math.random().toString());
    let pmidThree = P.PMID.create(Math.random().toString());

    // --------------------------------------------------------------------------
    _.each([A.PubMedID, A.PubMedCentralID], (desc) => {
        let objectOne = createObjectWithPMID(pmidOne, desc);
        let objectTwo = createObjectWithPMID(pmidTwo, desc);
        let testList = [objectOne, objectTwo];
        let shouldMatch = createObjectWithPMID(pmidTwo, desc);

        // --------------------------------------------------------------------------
        // Matching on first pmid
        matchServices.eachService((matcher) => {
            if(matchObject) { return; }
            matchObject = O.service(matcher.name, shouldMatch, testList);
        });
        t.assert(matchObject.ref == objectTwo.ref);
        matchObject = null;
        // --------------------------------------------------------------------------

        // --------------------------------------------------------------------------
        // Matching on multiple pmids
        objectOne.append(pmidTwo, desc);
        matchServices.eachService((matcher) => {
            if(matchObject) { return; }
            matchObject = O.service(matcher.name, shouldMatch, testList);
        });
        t.assert(matchObject.ref == objectOne.ref);
        matchObject = null;
        // --------------------------------------------------------------------------

        // --------------------------------------------------------------------------
        // No false matching
        let shouldNotMatch = createObjectWithPMID(pmidThree, desc);
        matchServices.eachService((matcher) => {
            if(matchObject) { return; }
            matchObject = O.service(matcher.name, shouldNotMatch, testList);
        });
        t.assert(!matchObject);
        matchObject = null;
        // --------------------------------------------------------------------------
    });
});