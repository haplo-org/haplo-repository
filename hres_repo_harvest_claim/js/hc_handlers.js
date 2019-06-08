/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// --------------------------------------------------------------------------
// Confirm the item is theirs, or disclaim because it's an incorrect match

P.respond("GET,POST", "/do/hres-repo-harvest-claim/claim", [
    {pathElement:0, as:"workUnit"}
], function(E, workUnit) {
    let harvested = workUnit.ref.load();
    if(E.request.method === "POST") {
        return E.response.redirect("/do/hres-repo-harvest-claim/review/"+workUnit.id);
    }
    E.render({
        pageTitle: "Claim item",
        backLink: harvested.url(),
        text: "Confirm that this is this one of your publications.",
        options: [{label:"Yes"}]
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

// --------------------------------------------------------------------------
// Docstore and forms for further claiming questions

var replaceAuthorCitations = function(object, authors) {
    let toAdd = [];
    let index = 0;
    object.remove(A.AuthorsCitation, (v,d,q) => {
        let spec = { cite: v.toString() };
        if(authors[index].linkTo) {
            spec.ref = O.ref(authors[index].linkTo);
        }
        toAdd.push(spec);
        index++;
        return true;    // remove the value from object
    });
    _.each(toAdd, (citeSpec) => {
        O.service("hres:author_citation:append_citation_to_object", object, A.Author, undefined, citeSpec);
    });
};

P.respond("GET,POST", "/do/hres-repo-harvest-claim/review", [
    {pathElement:0, as:"workUnit"}
], function(E, workUnit) {
    let instance = ClaimDocstore.instance(workUnit.id);
    let harvested = workUnit.ref;
    instance.handleEditDocument(E, {
        finishEditing: function(instance, E, complete) {
            if(complete) {
                let document = instance.currentDocument;
                let workUnit = O.work.load(instance.key);
                let harvested = workUnit.ref.load();
                workUnit.close(O.currentUser);
                workUnit.save();
                let shouldUpdateAuth = (!harvested.first(A.AuthoritativeVersion) || document.update);
                let updated = harvested.mutableCopy();
                replaceAuthorCitations(updated, document.authors);
                if(!document.correctMatchFound) {
                    updated.remove(A.AuthoritativeVersion);
                    if(document.manualAuthorityMatch) {
                        updated.append(O.ref(document.manualAuthorityMatch), A.AuthoritativeVersion);
                    }
                }
                if(!harvested.valuesEqual(updated)) {
                    updated.save();
                    harvested = updated;
                }
                if(shouldUpdateAuth) {
                    O.service("haplo_alternative_versions:copy_data_to_authoritative", harvested);
                }
                instance.commit(O.currentUser);
                return E.response.redirect(harvested.url());
            }
        },
        gotoPage: function(instance, E, formId) {
            E.response.redirect("/do/hres-repo-harvest-claim/review/"+workUnit.id+"/"+formId);
        },
        render: function(instance, E, deferredRender) {
            E.render({
                harvested: harvested,
                deferredForm: deferredRender
            });
        }
    });
});

P.respond("GET", "/do/hres-repo-harvest-claim/admin-view-claim", [
    {pathElement:0, as:"workUnit", allUsers: true}
], function(E, workUnit) {
    P.CanViewClaimForm.enforce();
    let instance = ClaimDocstore.instance(workUnit.id);
    let ui = instance.makeViewerUI(E, {
        showVersions: true
    });
    E.appendSidebarHTML(ui.sidebarHTML);
    E.render({
        pageTitle: "View claim form",
        backLink: workUnit.ref.load().url(),
        deferred: ui.deferredDocument
    });
});

P.dataSource("people", "object-lookup", [T.Person]);
P.dataSource("repositoryItems", "object-lookup", SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'));
var renderObjectHelper = function(object, style) {
    return P.template("std:object").render({
        object: object,
        style: "linkedheading"
    });
};

var AuthorMatch = P.form("authorMatch", "form/author-match.json");
var AuthorityMatch = P.form("authorityMatch", "form/authority-match.json");
var ManualAuthorityMatch = P.form("manualAuthorityMatch", "form/manual-authority-match.json");
var UseUpdatedFields = P.form("useUpdatedFields", "form/use-updated-fields.json");

var ClaimDocstore = P.defineDocumentStore({
    name: "claimDetails",
    formsForKey(key, instance, document) {
        if(instance.hasCommittedDocument) {
            // Show all forms for admins viewing document
            return [AuthorMatch, AuthorityMatch, ManualAuthorityMatch, UseUpdatedFields];
        } else {
            let workUnit = O.work.load(key);
            let harvested = workUnit.ref.load();
            let forms = [];
            if(harvested.every(A.AuthorsCitation).length > 1) {
                forms.push(AuthorMatch);
            }
            let authorityMaybe = harvested.first(A.AuthoritativeVersion);
            let previousWU = O.work.query("hres_repo_harvest_claim:claim_item").
                ref(workUnit.ref).
                isClosed()[0];
            // If it's been previously claimed, don't allow editing of authority version
            if(previousWU) {
                if(authorityMaybe) {
                    document.correctMatchFound = true;
                }
            } else {
                if(authorityMaybe) {
                    forms.push(AuthorityMatch);
                }
                if(!document.correctMatchFound) {
                    forms.push(ManualAuthorityMatch);
                }
            }
            let changedAttributes = O.service("haplo_alternative_versions:changed_attributes", harvested);
            if(changedAttributes.length) {
                forms.push(UseUpdatedFields);
            }
            return forms;
        }
    },
    prepareFormInstance(key, form, instance, context) {
        if(form.formId === "authorMatch") {
            let workUnit = O.work.load(key);
            let harvested = workUnit.ref.load();
        }
    },
    blankDocumentForKey(key) {
        let document = {authors: []};
        let workUnit = O.work.load(key);
        let harvested = workUnit.ref.load();
        harvested.every(A.AuthorsCitation, (v,d,q) => {
            let refStrMaybe = v.toFields().value.ref;
            document.authors.push({
                name: v.toString(),
                object: refStrMaybe ? renderObjectHelper(O.ref(refStrMaybe).load()) : undefined,
                linkTo: refStrMaybe ? refStrMaybe : undefined
            });
        });
        return document;
    },
    getAdditionalUIForEditor(key, instance, document, form) {
        if(form.formId === "useUpdatedFields") {
            if(document.correctMatchFound || document.manualAuthorityMatch) {
                let workUnit = O.work.load(key);
                let harvested = workUnit.ref.load();
                let authority = document.correctMatchFound ?
                    harvested.first(A.AuthoritativeVersion).load() :
                    O.ref(document.manualAuthorityMatch).load();
                let changed = O.service("haplo_alternative_versions:changed_attributes", harvested);
                let original = O.object().appendType(authority.firstType()),
                    updated = O.object().appendType(harvested.firstType());
                _.each(changed, (d) => {
                    authority.every(d, (v,d,q) => original.append(v,d,q));
                    harvested.every(d, (v,d,q) => updated.append(v,d,q));
                });
                return {
                    formTop: P.template("show_updated_values").deferredRender({
                        original: original,
                        updated: updated
                    })
                };
            }
        }
    }
});
