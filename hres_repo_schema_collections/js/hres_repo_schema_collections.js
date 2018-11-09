/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var addCreators = function(collection, creators, seenVQs) {
    _.each(creators, (vq) => {
        // Don't add duplicate creators
        let f = vq[0].toFields();
        let keyStart = !!f.value.ref ? f.value.ref.toString() : f.value.cite;
        let key = keyStart+vq[1];
        if(!seenVQs[key]) {
            collection.append(vq[0], A.AuthorsCitation, vq[1]);
        }
        seenVQs[key] = 1;
    });
};

var recalculateCreators = function(collection) {
    let citationValue = collection.first(A.AuthorsCitation);
    // Citation values are removed and rewritten for display, into a special purpose display text type.
    // hComputeAttributes is called on display to deal with restrictions, but this implementation has no
    // effect other than to overwrite the hres:author_citation_list_display text type. So instead we 
    // block it from recalculating on displaying, by checkin if that text type is present.
    if(citationValue && O.isPluginTextValue(citationValue, "hres:author_citation_list_display")) { return; }
    let firstCreators = []; // put first authors listed on outputs at start of Collections list
    let otherCreators = [];
    collection.every(A.CollectionItem, (v,d,q) => {
        let first = true;
        v.load().every(A.AuthorsCitation, (v,d,q) => {
            let list = first ? firstCreators : otherCreators;
            list.push([v,q]);
            first = false;
        });
    });
    // Note order is significant, so do recalculate even if it's only a position change
    collection.remove(A.AuthorsCitation);
    let seen = {};
    addCreators(collection, firstCreators, seen);
    addCreators(collection, otherCreators, seen);
};

P.hook('hComputeAttributes', function(response, object) {
    if(object.isKindOfTypeAnnotated('hres:annotation:repository:collection')) {
        recalculateCreators(object);
    }
});

P.hook('hPostObjectChange', function(response, object, operation, previous) {
    if(O.service("hres:repository:is_repository_item", object)) {
        if(operation === "update" || operation === "relabel") {
            O.background.run("hres_repo_schema_collections:recompute_collection_creators", {
                ref: object.ref.toString()
            });
        }
    }
});

P.backgroundCallback("recompute_collection_creators", function(data) {
    O.withoutPermissionEnforcement(() => {    
        O.query().
            link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository:collection'), A.Type).
            link(O.ref(data.ref), A.CollectionItem).
            execute().each((obj) => {
                let mObj = obj.mutableCopy();
                mObj.computeAttributesForced();
                mObj.remove(20);
                if(!obj.valuesEqual(mObj)) {
                    mObj.save();
                }
            });
    });
});


// ------- Object creation -------------------------------------------------

P.implementService("hres_repo_ingest_start_ui:guidance_required", function(type) {
    if(type == T.Collection) {
        return true;
    }
});

P.implementService("hres_repo_ingest_start_ui:custom_guidance_for_output", function(type) {
    if(type == T.Collection) {
        return P.template("new-collection-guidance");
    }
});

P.hook("hTrayPage", function(response) {
    let buttons = response.buttons || {};
    buttons["*HRES-COLLECTION-ITEMS"] = [["/do/hres-repo-collections/collect-items", "Create Collection"]];
    response.buttons = buttons;
});

P.hook("hPreObjectEdit", function(response, object, isTemplate) {
    if(isTemplate && object.isKindOfTypeAnnotated('hres:annotation:repository:collection')) {
        if(O.session["hres_repo_collections:tray_contents"]) {
            let r = response.replacementObject || object.mutableCopy();
            _.each(O.session["hres_repo_collections:tray_contents"], (ref) => {
                r.append(O.ref(ref),  A.CollectionItem);
            });
            response.replacementObject = r;
        }
    }
});

P.respond("GET,POST", "/do/hres-repo-collections/collect-items", [
], function(E) {
    let repositoryTrayContent = _.filter(O.tray, (ref) => {
        return O.service("hres:repository:is_repository_item", ref.load());
    });
    if(E.request.method === "POST") {
        O.session["hres_repo_collections:tray_contents"] = _.map(repositoryTrayContent, (r) => r.toString());
        let newObjectPage = O.serviceMaybe("hres:repository:new_repository_item_url", O.currentUser, T.Collection);
        return E.response.redirect(newObjectPage || "/do/edit?new="+T.Collection.toString());
    }
    E.render({
        contents: repositoryTrayContent
    });
});
