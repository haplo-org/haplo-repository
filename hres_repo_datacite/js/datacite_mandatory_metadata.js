/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var DATACITE_MANDATORY_ELEMENTS = [
    // So far only use of this is for Minting, at which point DOI is not expected
    // { name: "Identifier", requires: A.DOI },
    { name: "Creator", requires: A.Author },
    { name: "Title", requires: A.Title },
    { name: "Publisher", requires: A.Publisher, label(object) {
        if(object.isKindOfTypeAnnotated("hres:annotation:repository:practice-based-research")) {
            // TODO: No way currently of finding the aliased attribute from the object record, or
            // the name of the aliased attribute from the installed schema
            return "Publisher or commissioning body";
        } else {
            return SCHEMA.getAttributeInfo(A.Publisher).name;
        }
    }},
    { name: "PublicationYear", requires: A.Date, label(object) { return "Year"; }},
    { name: "ResourceType", requires: A.Type }
];

var missingMandatoryMetadata = function(object) {
    return _.filter(DATACITE_MANDATORY_ELEMENTS, (m) => {
        return !object.first(m.requires);
    });
};

P.implementService("hres_repo_datacite:missing_metadata_details", function(object) {
    let missing = missingMandatoryMetadata(object);
    if(missing.length) {
        return P.template("missing_metadata").deferredRender({
            missing: _.map(missing, (m) => {
                return {
                    name: m.name,
                    attribute: ("label" in m) ? m.label(object) : SCHEMA.getAttributeInfo(m.requires).name
                };
            })
        });
    }
});
