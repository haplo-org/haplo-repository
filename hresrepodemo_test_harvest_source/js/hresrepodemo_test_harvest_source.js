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
    {parameter:"newItem", as:"string", optional:true}
], function(E, newItem) {
    if(E.request.method === "POST") {
        if(!P.data.exampleResearcher || !P.data.exampleIdentifier || (newItem === "yes")) {
            _.find(_.shuffle(O.query().link(T.Researcher, A.Type).execute()), (r) => {
                if(O.user(r.ref)) {
                    P.data.exampleResearcher = r.ref.toString();
                }
            });
            P.data.exampleIdentifier = Math.random().toString();
        }
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
        options: [
            {label:"Confirm - re-harvest previous output"},
            {label:"Confirm - create new output", parameters:{"newItem":"yes"}}
        ]
    }, "std:ui:confirm");
});

var embargoDataIsEqual = function(databaseQuery, embargoData) {
    if(!databaseQuery && embargoData) { return false; }
    if(databaseQuery && !embargoData) { return false; }
    if(databaseQuery.count() !== embargoData.length) { return false; }
    let changed = false;
    databaseQuery.each((row) => {
        let foundMatch = _.find(embargoData, (embargo) => {
            if(!row.desc && embargo.desc) { return false; }
            if(row.desc && !embargo.desc) { return false; }
            if(row.desc !== embargo.desc) { return false; }
            if(!row.licenseURL && embargo.licenseURL) { return false; }
            if(row.licenseURL && !embargo.licenseURL) { return false; }
            if(row.licenseURL !== embargo.licenseURL) { return false; }
            if(row.start.getTime() !== embargo.start.getTime()) { return false; }
            if(row.end || embargo.end) {
                if(!row.end && embargo.end) { return false; }
                if(row.end && !embargo.end) { return false; }
                if(row.end.getTime() !== embargo.end.getTime()) { return false; }
            }
            return true;       // all fields are the same --> match
        });
        if(!foundMatch) {
            changed = true;
        }
    });
    return !changed;
};

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
    object.append(O.text(O.T_TEXT_PARAGRAPH, abs), A.Abstract);
    // 3. return harvest item objects, with keys:
    //      object: storeObject of harvested item
    //      identifier: identifier in the source system
    //      postHarvest: function to do other things with the saved object, eg. save data to databases
    //          returns `true` if an update has happened, so harvest/claim can be notified correctly
    let identifier = P.data.exampleIdentifier;
    object.remove(A.DOI);   // when we're playing with the identifiers for testing, this will confuse things
    return [{
        object: object,
        identifier: identifier || null,
        postHarvest(harvestedObject) {
            let currentEmbargos = O.service("hres_repo_embargoes:get_embargo", harvestedObject);
            // usually should be read from input data, this is just for testing
            let embargoData = [
                {
                    object: harvestedObject.ref,
                    start: new XDate().clearTime().toDate(),
                    licenseURL: "example.com",
                    desc: A.File
                },
                {
                    object: harvestedObject.ref,
                    start: new XDate().clearTime().toDate(),
                    licenseURL: "example.com",
                    desc: A.AcceptedAuthorManuscript
                }
            ];
            if(!embargoDataIsEqual(currentEmbargos, embargoData)) {
                if(currentEmbargos) { currentEmbargos.deleteAll(); }
                _.each(embargoData, (embargo) => {
                    O.service("hres_repo_embargoes:set_embargo", embargo);
                });
                return true;    // changed something
            }
        }
    }];
});
