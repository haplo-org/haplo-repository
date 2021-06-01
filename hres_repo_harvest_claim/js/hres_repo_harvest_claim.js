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
            source: W.workUnit.data.source,
            note: W.workUnit.data.taskNote
        });
    }
});

var authorHasVisibility = function(user, object) {
    let auth = object.first(A.AuthoritativeVersion);
    if(auth) {
        O.withoutPermissionEnforcement(() => {
            auth = auth.load();
        });
    }
    // Check user can update the object they'll have to claim and update the authoritative version (if it exists)
    return user.canRead(object) && (!auth || user.canUpdate(auth));
};

P.implementService("hres_repo_harvest_sources:notify:harvested_object_saved", function(object, source) {
    let existingWu = O.work.query("hres_repo_harvest_claim:claim_item").ref(object.ref)[0];
    if(existingWu) { return; }
    let createdWu = false;
    object.every(A.Author, (v,d,q) => {
        let user = O.user(v);
        if(user && user.isActive && authorHasVisibility(user, object)) {
            let wu = O.work.create({
                workType: "hres_repo_harvest_claim:claim_item",
                actionableBy: user,
                ref: object.ref,
                data: {source: source || "" }
            }).save();
            O.serviceMaybe("hres_repo_harvest_claim:notify:task_created", wu);
            createdWu = true;
        }
    });
    if(!createdWu) {
        let wu = O.work.create({
            workType: "hres_repo_harvest_claim:claim_item",
            actionableBy: Group.RepositoryEditors,
            ref: object.ref,
            data: {source: source || "" }
        }).save();
        O.serviceMaybe("hres_repo_harvest_claim:notify:task_created", wu);
    }
});

P.implementService("hres_repo_harvest_sources:change_harvested_object", function(object) {
    if(!object.ref) { return; }
    let latestWu = O.work.query("hres_repo_harvest_claim:claim_item").ref(object.ref).isClosed().latest();
    if(!latestWu) { return; }
    let authors = P.ClaimDocstore.instance(latestWu.id).lastCommittedDocument.authors;
    let toAdd = [];
    let index = 0;
    object.remove(A.AuthorsCitation, (v,d,q) => {
        let fields = v.toFields().value;
        let spec = { cite: fields.cite };
        if(fields.ref) { spec.ref = O.ref(fields.ref); }

        // Prefer match from source over a previous manual match
        if(!spec.ref && authors[index].linkTo) {
            // Only set ref if it's the same citation in same place as previously matched
            if(spec.cite === authors[index].name) {
                spec.ref = O.ref(authors[index].linkTo);
            }
        }
        toAdd.push(spec);
        index++;
        return true;
    });
    _.each(toAdd, (citeSpec) => {
        O.service("hres:author_citation:append_citation_to_object", object, A.Author, undefined, citeSpec);
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
        let latestWu = O.work.query("hres_repo_harvest_claim:claim_item").
            ref(display.object.ref).
            isEitherOpenOrClosed().
            latest();
        if(latestWu) {
            let str = "Record ";
            if(latestWu.closed) {
                str += !!latestWu.tags.disclaimed ? "disclaimed by " : "accepted by ";
                str += latestWu.closedBy.name;
            } else {
                str += "currently with " + latestWu.actionableBy.name;
            }
            claimPanel.
                status(5, str);
            if(!latestWu.closed && P.REPOSITORY_EDITOR_DELEGATION && O.currentUser.allowed(P.CanDelegateTaskToRepositoryEditors)) {
                claimPanel.link(10, "/do/hres-repo-harvest-claim/admin-takeover/"+display.object.ref,
                    "Delegate to "+NAME("Repository Editors"), "standard");
            }
            if(latestWu.closed && O.currentUser.allowed(CanViewClaimForm)) {
                claimPanel.
                    link(30, "/do/hres-repo-harvest-claim/admin-view-claim/"+latestWu.id, "View claim form");
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
    if(citeToAppend) {
        O.service("hres:author_citation:append_citation_to_object", object, A.Author, null, {
            last: citeToAppend
        });
    }
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
