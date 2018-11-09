/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.isMemberOf(Group.Administrators)) {
        builder.panel(500).
            link(999999, " /do/hresrepodemo-test-harvest-source/test", "Test harvesting item from external source");
    }
});

P.respond("GET,POST", "/do/hresrepodemo-test-harvest-source/test", [
], function(E) {
    if(!P.data.exampleResearcher) {
        _.find(O.query().link(T.Researcher, A.Type).execute(), (r) => {
            if(O.user(r.ref)) {
                P.data.exampleResearcher = r.ref.toString();
                return true;
            }
        });
    }
    if(E.request.method === "POST") {
        O.service("hres_repo_harvest_sources:get_updates_from_sources");
        return E.response.redirect(O.ref(P.data.exampleResearcher).load().url());
    }
    E.render({
        pageTitle: "Test harvesting items into the repository",
        text: "This will harvest a record into the repository from a dummy external source.\n"+
            "Clicking 'Confirm' will redirect to the profile page of the author of the record, "+
            "who will have received a task and email notifying them that the item has been "+
            "harvested and requires review.\n For instructions on impersonating users, see "+
            "the home page of this application.",
        options: [{label:"Confirm"}]
    }, "std:ui:confirm");
});



P.implementService("hres:repository:harvest-source:test-example", function() {
    console.log("test source called");
    // 1. perform query.
    let xml = P.loadFile("dataciteSource.xml").readAsString();
    // 2. for each retrieved item, convert to StoreObjects from receieved data
    let object = O.object();
    // (in this example file is a single record, so pass xml directly)
    let cursor = O.xml.parse(xml).cursor();
    O.service("hres:repository:datacite:apply-xml-to-object", cursor, object);
    // Add the test system "exampleResearcher" rather than the person harvested from the XML, for ease
    object.remove(A.AuthorsCitation);
    O.service("hres:author_citation:append_citation_to_object", object, A.Author, null, {
        ref: O.ref(P.data.exampleResearcher)
    });
    // Append a random string to the end of the abstract, so testing again pushes an update
    let abs = object.first(A.Abstract) ? object.first(A.Abstract).toString() : "";
    abs = abs+Math.random();
    object.remove(A.Abstract);
    object.append(abs, A.Abstract);
    // 3. return harvest item objects, with keys:
    //      object: storeObject of harvested item
    //      identifier: identifier in the source system
    //      source: string identifier for the source installation (note could be multiple of a 
    //              kind of source in a system)
    let identifier;
    if(cursor.firstChildElementMaybe("resource")) {
        identifier = cursor.getTextOfFirstChildElementMaybe("identifier");
    }
    return [{
        object: object,
        identifier: identifier || null,
        source: "An external source (eg. Datacite)"
    }];
});
