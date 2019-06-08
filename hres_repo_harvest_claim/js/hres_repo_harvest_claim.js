/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.workUnit({
    workType: "claim_item",
    description: "Claim harvested repository item",
    render(W) {
        if(W.workUnit.closed && (W.context === "object")) { return; }
        W.render({
            fullInfo: (W.context === "list") ? W.workUnit.ref.load().url() : null,
            list: (W.context === "list"),
            object: W.workUnit.ref,
            source: W.workUnit.data.source
        });
    }
});

P.implementService("hres_repo_harvest_sources:notify:harvested_object_saved", function(object) {
    let existingWu = O.work.query("hres_repo_harvest_claim:claim_item").ref(object.ref)[0];
    if(existingWu) { return; }
    object.every(A.Author, (v,d,q) => {
        let user = O.user(v);
        if(user && user.isActive) {
            O.work.create({
                workType: "hres_repo_harvest_claim:claim_item",
                actionableBy: user,
                ref: object.ref
            }).save();
        }
    });
});

// -------- Object page UI -----------------------------------

var CanViewClaimForm = P.CanViewClaimForm = O.action("hres_repo_harvest_claim:view_claim").
    title("View harvested object claim form").
    allow("group", Group.RepositoryEditors);

P.implementService("std:action_panel:alternative_versions", function(display, builder) {
    let claimPanel = builder.panel(10);
    let openWu = O.work.query("hres_repo_harvest_claim:claim_item").
        ref(display.object.ref).
        actionableBy(O.currentUser)[0];
    if(openWu) {
        claimPanel.
            link(10, "/do/hres-repo-harvest-claim/claim/"+openWu.id, "Claim", "primary").
            link(20, "/do/hres-repo-harvest-claim/disclaim/"+openWu.id, "Disclaim", "secondary");
    } else {
        let closedWu = O.work.query("hres_repo_harvest_claim:claim_item").
            ref(display.object.ref).
            isClosed()[0];
        if(closedWu) {
            claimPanel.
                status(5, "Record accepted by "+closedWu.closedBy.name);
            if(O.currentUser.allowed(CanViewClaimForm)) {
                claimPanel.
                    link(30, "/do/hres-repo-harvest-claim/admin-view-claim/"+closedWu.id, "View claim form");
            }
        }
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
