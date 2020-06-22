/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var REPOSITORY_TYPES = SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item");

var updatePerson = function(person, object) {
    if(!(person.isKindOf(T.Person))) { 
        console.log("ERROR: unexpected type in author/editor attribute for user: ", person, " on object: ", object);
        return;
    }

    let personIsPublic = person.labels.includes(Label.ResearcherPublishedToRepository);
    let linkedOutputs = O.query().
        link(REPOSITORY_TYPES, A.Type).
        linkDirectly(person.ref).
        execute();
    let personIsActive = !!_.find(linkedOutputs, (output) => {
        return O.service("hres:repository:is_author", person, output);
    });

    if(personIsPublic && !personIsActive) {
        person.relabel(O.labelChanges().remove([Label.ResearcherPublishedToRepository]));
    } else if(!personIsPublic && personIsActive) {
         person.relabel(O.labelChanges().add([Label.ResearcherPublishedToRepository]));
    }
};

P.hook("hPostObjectChange", function(response, object, operation, previous) {
    if(!object.isKindOfTypeAnnotated("hres:annotation:repository-item")) { return; }
    let seen = {};

    _.each([A.Author, A.Editor], desc => {
        let people = previous ? object.every(desc).concat(previous.every(desc)) : object.every(desc);
        _.each(people, personRef => {
            if(!O.isRef(personRef) || seen[personRef.toString()]) { return; }
            O.impersonating(O.SYSTEM, () => updatePerson(personRef.load(), object));
            seen[personRef.toString()] = true;
        });
    });
});
// --------------------------------------------------------------------------
// Migration to update all non-academic authors with the correct label
// --------------------------------------------------------------------------

P.backgroundCallback("relabel_authors", function(data) {
    O.impersonating(O.SYSTEM, () => {
        P.data.relabellingMigrationStarted = true;
        O.query().
            not((sq) => {
                sq.link(T.Person, A.Type).
                    link(T.Researcher, A.Type);
            }).
            execute().
            each((person) => updatePerson(person));
        P.data.relabellingMigrationComplete = true;
    });
});

P.respond("GET,POST", "/do/hres-repo-publication-author-auto/relabel-authors", [], function(E) {
    O.action("std:action:administrator_override").enforce();
    if(E.request.method === "POST") {
        if(E.request.parameters.unblock) {
            P.data.relabellingMigrationStarted = false;
            P.data.relabellingMigrationComplete = false;
        } else {
            O.background.run("hres_repo_publication_author_auto:relabel_authors", {});
            return E.response.redirect("/");
        }
    }
    if(!P.data.relabellingMigrationComplete) {
        let note = P.data.relabellingMigrationStarted ? " Note: the migration has started." : "";
        E.render({
            pageTitle: "Relabel non-academics",
            backLink: "/",
            text: "Would you like to relabel all non-academic people to give them public repository pages"+note,
            options: [{label:"Confirm"}]
        }, "std:ui:confirm");
    } else {
        let note = "\n";
        if(P.data.relabellingMigrationStarted) { note += "The migration has started.\n"; }
        if(P.data.relabellingMigrationComplete) { note += "The migration is complete"; }
        E.render({
            pageTitle: "Migration completed",
            backLink: "",
            text: "Would you like to unblock this migration?"+note,
            options: [{
                label:"Unblock",
                parameters: { "unblock": true }
            }]
        }, "std:ui:confirm");
    }
});