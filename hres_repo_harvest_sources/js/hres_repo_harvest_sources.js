/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */



// Database for identifying StoreObjects to update in response to source data received
P.db.table("sourceObjects", {
    source: {type: "text"},                             // Unique, Human-readable string of the source
    sourceIdentifier: {type: "text", nullable:true},    // identifier for the item in the source system
    sourceObject: {type: "ref"},
    matchObject: {type: "ref", nullable:true}           // null until the item is claimed
});

// ------------------------------------------------------------
// Permissions - harvested == non-editable

// --- Source and Match service registries -------------------

var _sourceServices;
var sourceServices = function() {
    if(!_sourceServices) {
        _sourceServices = O.service("haplo:service-registry:query", [
            "hres:repository:harvest-source"
        ]);
    }
    return _sourceServices;
};
var _matchServices;
var matchServices = function() {
    if(!_matchServices) {
        _matchServices = O.service("haplo:service-registry:query", [
            "hres:repository:match-item-to-existing-in-list"
        ]);
    }
    return _matchServices;
};

// ------- Update when source is claimed ----------------------

P.implementService("hres_repo_harvest_sources:notify:source_object_claimed", function(source, authority) {
    let q = P.db.sourceObjects.select().where("sourceObject", "=", source);
    if(q.count() !== 1) { throw new Error("Logic error"); }
    q[0].matchObject = authority;
    q[0].save();
});

// ------- Harvest updates from sources -----------------------

P.implementService("hres_repo_harvest_sources:get_updates_from_sources", function() {
    getUpdatesFromSources();
});

var getUpdatesFromSources = function() {
    let harvest = [];
    sourceServices().eachService((sourceService) => {
        // returns array of harvested items, objects with keys"
        // object: storeObject of harvested item
        // identifier: identifier in the source system
        // source: string identifier for the source installation (note could be multiple of a 
        //      kind of source in a system)
        _.each(O.service(sourceService.name), (item) => {
            harvest.push(item);
        });
    });

    let allRepositoryItems = O.query().link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), A.Type).execute();
    harvest.forEach((harvested) => {
        let matchObject, sourceObject, query;
        // Check if object has an identifier we can query on
        if(harvested.identifier) {
            // search DB for it
            query = P.db.sourceObjects.select().
                where("source", "=", harvested.source).
                where("sourceIdentifier", "=", harvested.identifier);
            if(query.length) {
                matchObject = query[0].matchObject;
                // To ensure the refs don't change
                sourceObject = query[0].sourceObject.load();
                if(sourceObject.labels.includes(Label.DELETED)) { return; }
                let copy = sourceObject.mutableCopy();
                sourceObject.every((v,d,q) => { copy.remove(d,q); });
                harvested.object.every((v,d,q) => {
                    copy.append(v,d,q);
                });
                harvested.object = copy;
            }
        }
        if(!matchObject) {
            // TODO: Matching policies. eg. DOI, title, ISSN, ISBN, PubMed ID, etc.
            matchServices().eachService((matcher) => {
                if(matchObject) { return; } // Return first found match for simplicity
                matchObject = O.service(matcher.name, harvested.object, allRepositoryItems);
            });
        }
        if(matchObject) {
            harvested.object.append(matchObject, A.AuthoritativeVersion);
        }

        // No-op if item already exists
        let changes = O.labelChanges().add([Label.ARCHIVED, Label.SourceItem]);
        O.impersonating(O.SYSTEM, () => {
            harvested.object.computeAttributesIfRequired();
            if(!(sourceObject && sourceObject.valuesEqual(harvested.object))) {
                harvested.object.save(changes);
                O.serviceMaybe("hres_repo_harvest_sources:notify:source_object_saved", harvested);
            }
        });
        // Save source object to database if it's new
        if(!(query && query.length)) {
            P.db.sourceObjects.create({
                source: harvested.source,
                sourceIdentifier: harvested.identifier || null,
                sourceObject: harvested.object
            }).save();
        }
    });
};
