/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */



// Database for identifying StoreObjects to update in response to source data received
P.db.table("sourceObjects", {
    ref: {type: "ref"},
    source: {type: "text"},             // Haplo identifer for this source
    sourceIdentifier: {type: "text"},   // identifier for the item in the source system
});

P.implementService("haplo_alternative_versions:source_for_alternative_object", function(object) {
    let q = P.db.sourceObjects.select().where("ref", "=", object.ref);
    if(q.length) {
        return {
            source: q[0].source,
            identifier: q[0].sourceIdentifier,
            name: sourceName(q[0].source)
        };
    }
});

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
var _sourceNames;
var sourceName = function(source) {
    if(!_sourceNames) {
        _sourceNames = {};
        O.service("haplo:service-registry:query", [
            "hres:repository:harvest-source"
        ]).eachService((s) => {
            _sourceNames[s.metadata["source"]] = s.metadata["name"];
        });
    }
    return _sourceNames[source];
};
var _matchServices;
var matchServices = function() {
    if(!_matchServices) {
        _matchServices = O.service("haplo:service-registry:query", [
            "conforms-to hres:repository:match-item-to-existing-in-list",
            "list-of repository-items"
        ]);
    }
    return _matchServices;
};

// ------- Harvest updates from sources -----------------------

P.implementService("hres_repo_harvest_sources:get_updates_from_sources", function() {
    // check P.data.lastrun to get the date from which to look.
    getUpdatesFromSources();
});

P.implementService("hres_repo_harvest_sources:update", function(harvest) {
    getUpdatesFromSources(harvest);
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
            item.source = sourceService.metadata["source"];
            item.name = sourceService.metadata["name"];
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
                // To ensure the refs don't change
                sourceObject = query[0].ref.load();
                matchObject = sourceObject.first(A.AuthoritativeVersion);
                if(sourceObject.labels.includes(Label.DELETED)) { return; }
                // Remove the previously harvested values
                let removeDescs = [];
                sourceObject.every((v,d,q) => {
                    if((-1 === removeDescs.indexOf(d)) && d !== A.AuthoritativeVersion) {
                        removeDescs.push(d);
                    }
                });
                let copy = sourceObject.mutableCopy();
                _.each(removeDescs, (d) => copy.remove(d));
                // ... and then replace them with the newly harvested values
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
        // May be a no-op
        if(matchObject) {
            harvested.object.remove(A.AuthoritativeVersion);
            harvested.object.append(matchObject, A.AuthoritativeVersion);
        }

        let changed = false;
        // No-op if item already exists
        O.impersonating(O.SYSTEM, () => {
            harvested.object.computeAttributesIfRequired();
            // TODO: Unlikely, but could theoretically be the case that just the embargo is new. Should ensure
            // notify service is triggered even if there are only database changes
            if(!sourceObject || !sourceObject.valuesEqual(harvested.object)) {
                harvested.object.save(O.labelChanges([Label.Harvested, Label.AlternativeVersion]));
                changed = true;
                if(harvested.embargo) {
                    // error if embargo plugin not installed
                    harvested.embargo.object = harvested.object.ref;
                    O.service("hres_repo_embargoes:set_embargo", harvested.embargo);
                }
            }
        });
        if("postHarvest" in harvested) {
            changed = harvested.postHarvest(harvested.object) || changed;
        }
        if(changed) {
            O.serviceMaybe("hres_repo_harvest_sources:notify:harvested_object_saved", harvested.object);
        }

        // Save source object to database if it's new
        if(!(query && query.length)) {
            // No point saving it if there's no identifier to find it again
            if(harvested.identifier) {
                P.db.sourceObjects.create({
                    source: harvested.source,
                    sourceIdentifier: harvested.identifier,
                    ref: harvested.object.ref
                }).save();
            }
        }
    });
};

// --------------------------------------------------------------------------
// TODO: Remove this temp edit freeze implementation when DENY permissions are possible in the platform

P.hook("hPreObjectEdit", function(response, object, isTemplate, isNew) {
    if(object.labels.includes(Label.Harvested)) {
        response.redirectPath = "/do/hres-repo-harvest-sources/edit-notice";
    }
});

P.respond("GET", "/do/hres-repo-harvest-sources/edit-notice", [
], function(E, object) {
    E.render({
        pageTitle: "Object not editable",
        message: "This version of the object is not editable as it has been harvested from an "+
            "external data source."
    }, "std:ui:notice");
});
