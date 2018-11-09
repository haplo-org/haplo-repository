/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// ------- Handlers ------------------------------------------

var copySourceDataOntoAuthority = function(workUnit) {
    let source = workUnit.ref.load();
    let authority;
    if(source.first(A.AuthoritativeVersion)) { 
        authority = source.first(A.AuthoritativeVersion).load().mutableCopy();
        let toRemove = [];
        // Only update attributes that exist on the source object
        source.every((v,d,q) => toRemove.push(d));
        _.each(_.uniq(toRemove), (d) => authority.remove(d));
    } else {
        authority = O.object();
    }
    source.every((v,d,q) => {
        if(d !== A.AuthoritativeVersion) {
            authority.append(v,d,q);
        }
    });
    return authority;
};

var closeSourceWorkUnitsAndNotify = function(workUnit, authority) {
    let wus = O.work.query("hres_repo_harvest_claim:claim_item").ref(workUnit.ref);
    _.each(wus, (wu) => {
        wu.close(O.currentUser);
        wu.save();
    });
    O.service("hres_repo_harvest_sources:notify:source_object_claimed", workUnit.ref, authority.ref);
};

P.respond("GET,POST", "/do/hres-repo-harvest-claim/claim", [
    {pathElement:0, as:"workUnit"}
], function(E, workUnit) {
    if(E.request.method === "POST") {
        let authority = copySourceDataOntoAuthority(workUnit);
        authority.save();
        closeSourceWorkUnitsAndNotify(workUnit, authority);
        return E.response.redirect(authority.url());
    }
    E.render({
        pageTitle: "Claim item",
        backLink: workUnit.ref.load().url(),
        text: "This will accept the record 'as-is', copying the metadata displayed onto an authoritative record "+
            "for the output.\nThis will overwrite any previously stored data on the authoritative record.",
        options: [{label:"Confirm"}]
    }, "std:ui:confirm");
});

P.respond("GET,POST", "/do/hres-repo-harvest-claim/claim-edit", [
    {pathElement:0, as:"workUnit"}
], function(E, workUnit) {
    if(E.request.method === "POST") {
        let authority = copySourceDataOntoAuthority(workUnit);
        // TODO: Fix this dirty hack
        authority.save();
        closeSourceWorkUnitsAndNotify(workUnit, authority);
        return E.response.redirect("/do/edit/"+authority.ref);
    }
    E.render({
        pageTitle: "Claim item",
        backLink: workUnit.ref.load().url(),
        text: "This will use this record as a template for editing, and then will copy the edited information "+
            "onto an authoritative record for the output.\nThis will overwrite any previously stored data "+
            "on the authoritative record.",
        options: [{label:"Confirm"}]
    }, "std:ui:confirm");
});

P.respond("GET,POST", "/do/hres-repo-harvest-claim/disclaim", [
    {pathElement:0, as:"workUnit"}
], function(E, workUnit) {
    if(E.request.method === "POST") {
        let source = workUnit.ref.load().mutableCopy();
        P.removeUserRefFromCitation(source, O.currentUser);
        let labelChanges = O.labelChanges();
        source.computeAttributesIfRequired();
        // If no authors linked any more, remove link to authoritative version and delete
        if(!source.first(A.Author)) {
            labelChanges.add(Label.DELETED);
            source.remove(A.AuthoritativeVersion);
            O.withoutPermissionEnforcement(() => {
                source.save(labelChanges);
            });
        }
        workUnit.tags["disclaimed"] = "1";
        workUnit.close(O.currentUser);
        workUnit.save();
        return E.response.redirect("/");
    }
    E.render({
        pageTitle: "Disclaim item",
        backLink: workUnit.ref.load().url(),
        text: "You are not an author of this item.",
        options: [{label:"Confirm"}]
    }, "std:ui:confirm");
});
