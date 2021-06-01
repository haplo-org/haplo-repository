/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// --------------------------------------------------------------------------
// Utility
// --------------------------------------------------------------------------

var findDuplicates = P.findDuplicates = function(output) {
    let possibleDuplicates = [];
    let duplicates = {};
    O.serviceMaybe("hres:repository:find_matching_items_by_identifier", output, possibleDuplicates);

    _.each(possibleDuplicates, (duplicate) => {
        let refStr = duplicate.object.ref.toString();
        if(!(refStr in  duplicates)) {
            duplicates[refStr] = [];
        }
        duplicates[refStr].push(duplicate.matchingDesc);
    });
    // Existing object will always match itself
    delete duplicates[output.ref.toString()];
    return duplicates;
};

// --------------------------------------------------------------------------
// Display
// --------------------------------------------------------------------------

var CanViewDuplicateItems = O.action("hres:repository:can_view_duplicate_items").
    title("Can view duplicate repository items").
    allow("group", Group.RepositoryEditors);

P.implementService("std:action_panel:category:hres:repository_item", function(display, builder) {
    if(!O.currentUser.allowed(CanViewDuplicateItems) &&
        !O.service("hres:repository:is_author", O.currentUser, display.object)) { return; }

    let duplicates = findDuplicates(display.object);
    if(_.isEmpty(duplicates)) { return; }

    let elementIndex = 0;
    let panel = builder.panel(25).element(elementIndex++, {title:"Duplicate outputs"});
    _.each(duplicates, (identifiers, ref) => {
        let displayIdentifiers =  _.map(identifiers, (identifier) => {
            return SCHEMA.getAttributeInfo(identifier).name;
        });
        let output = O.ref(ref).load();
        panel.element(elementIndex++, {
            innerLink: {
                href: output.url(),
                label: output.title
            },
            innerText: identifiers.length ? "Matched on: " + displayIdentifiers.join(", ") : ""
        });
    });
});