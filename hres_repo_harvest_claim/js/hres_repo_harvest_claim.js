/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.workUnit({
    workType: "claim_item",
    description: "Claim harvested repository item",
    render(W) {
        W.render({
            fullInfo: (W.context === "list") ? W.workUnit.ref.load().url() : null,
            list: (W.context === "list"),
            object: W.workUnit.ref,
            source: W.workUnit.data.source
        });
    }
});

P.implementService("hres_repo_harvest_sources:notify:source_object_saved", function(harvested) {
    harvested.object.every(A.Author, (v,d,q) => {
        let user = O.user(v);
        if(user && user.isActive) {
            O.work.create({
                workType: "hres_repo_harvest_claim:claim_item",
                actionableBy: user,
                ref: harvested.object.ref,
                data: {
                    source: harvested.source,
                    sourceIdentifier: harvested.identifier
                }
            }).save();
            // TODO: email?
        }
    });
});

// -------- Object page UI -----------------------------------

var changedAttributes = function(source, authority) {
    let changed = [],
        sourceDescs = [];
    source.every((v,d,q) => sourceDescs.push(d));
    sourceDescs = _.uniq(sourceDescs);
    _.each(sourceDescs, (d) => {
        if(!authority.valuesEqual(source, d) && (d !== A.AuthoritativeVersion)) {
            changed.push(d);
        }
    });
    return changed;
};

P.implementService("std:action_panel:repository_item", function(display, builder) {
    if(display.object.labels.includes(Label.SourceItem)) {
        let claimPanel = builder.panel(10);
        let wus = O.work.query("hres_repo_harvest_claim:claim_item").
            ref(display.object.ref).
            actionableBy(O.currentUser).
            isEitherOpenOrClosed();
        if(wus[0]) {
            if(wus[0].closed) {
                claimPanel.
                    status(5, "Record accepted by "+wus[0].closedBy.name);
            } else {
                claimPanel.
                    link(10, "/do/hres-repo-harvest-claim/claim/"+wus[0].id, "Claim", "primary").
                    link(15, "/do/hres-repo-harvest-claim/claim-edit/"+wus[0].id, "Claim with edits", "primary").
                    link(20, "/do/hres-repo-harvest-claim/disclaim/"+wus[0].id, "Disclaim", "secondary");
                // Show atrributes that will be updated for open workUnits, if there's already an
                // authority version
                if(display.object.first(A.AuthoritativeVersion)) {
                    let changedAttrs = changedAttributes(display.object, display.object.first(A.AuthoritativeVersion).load());
                    let changePanel = builder.panel(25);
                    changePanel.element(5, {title:"Fields to update on authoritative record"});
                    _.each(changedAttrs, (d) => {
                        changePanel.element(25, {label: SCHEMA.getAttributeInfo(d).name});
                    });
                }
            }
        }
        return false;
    }
});

// ------ Hooks ----------------------------------------------

var removeUserRefFromCitation = P.removeUserRefFromCitation = function(object, user) {
    let citeToAppend;
    object.remove(A.AuthorsCitation, (v,d,q) => {
        let ref = O.service("hres:author_citation:get_ref_maybe", v);
        if(ref == user.ref) {
            citeToAppend = v.toFields().value.cite;
            return true; // delete this value from the object
        }
    });
    O.service("hres:author_citation:append_citation_to_object", object, A.Author, null, {
        last: citeToAppend
    });
};

// TODO: This is an abuse of this hook, which works because this ref is removed before the 
//   hComputeAttributes hook in hres_author_citation adds the A.Author link
//   Ideally:
//          1. As a "final" compute action, remove the author from the citation
//          2. Call recompute hooks to remove the A.Author link.
P.hook('hComputeAttributes', function(response, object) {
    if(object.ref) {
        let wus = O.work.query("hres_repo_harvest_claim:claim_item").
            ref(object.ref).
            isClosed().
            anyVisibility().
            tag("disclaimed", "1");
        _.each(wus, (wu) => {
            let user = wu.closedBy;
            removeUserRefFromCitation(object, user);
        });
    }
});
