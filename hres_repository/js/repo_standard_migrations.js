/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var COPY_PUBLISHER_FROM_JOURNAL = O.application.config["hres:repository:copy-publisher-from-journal"];
var COMPUTE_PUBLISHER_FROM_JOURNAL = O.application.config["hres:repository:compute-publisher-from-journal"];

var appendPublisherFromJournal = function(mutableObject) {
    mutableObject.every(A.Journal, (v,d,q) => {
        if(!O.isRef(v)) { return; }
        let journal = v.load();
        journal.every(A.Publisher, (v,d,q) => {
            if(!mutableObject.has(v,d,q)) {
                mutableObject.append(v,d,q);
            }
        });
    });
};

if(!!COPY_PUBLISHER_FROM_JOURNAL) {
    P.hook('hPostObjectEdit', function(response, object, previous) {
        if(O.serviceMaybe("hres:repository:is_repository_item", object)) {
            let output = response.replacementObject || object.mutableCopy();
            appendPublisherFromJournal(output);
            response.replacementObject = output;
        }
    });
}

if(!!COMPUTE_PUBLISHER_FROM_JOURNAL) {
    P.hook('hComputeAttributes', function(response, object) {
        if(O.serviceMaybe("hres:repository:is_repository_item", object)) {
            object.remove(A.Publisher);
            appendPublisherFromJournal(object);
        }
    });
}
// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/hres-repository/archive-unused-journals", [
], function(E) {
    O.action("std:action:administrator_override").enforce();
    if(E.request.method === "POST") {
        O.query().
            not((sq) => {
                sq.link(T.Journal, A.Type).
                    linkFromQuery((sqq) => sqq.link(P.REPOSITORY_TYPES, A.Type));
            }).
            execute().
            each((journal) => journal.relabel(O.labelChanges().add([Label.ARCHIVED])));
        E.response.redirect("/");
    }
    E.render({
        pageTitle: "Delete unused journals",
        backLink: "/",
        text: "Are you sure you would like to archive all journals that aren't linked to any outputs?",
        options: [{label:"Archive"}]
    }, "std:ui:confirm");
});

// --------------------------------------------------------------------------

var normaliseTitle = function(title){
    return title.toLowerCase().replace(/[^a-z0-9]/g, "");
};

P.backgroundCallback("plaintext_journal_linking", function(data) {
    O.impersonating(O.SYSTEM, () => {
        P.data.journalLinkingMigrationStarted = true;
        let normalisedTitleToJournal = {};

        O.query().link(T.Journal, A.Type).execute().each((journal) => {
            normalisedTitleToJournal[normaliseTitle(journal.title)] = journal;
        });

        let allRepositoryItems = O.service("hres:repository:store_query").execute();
        _.each(allRepositoryItems, (output) => {
            let journals = [];
            let mutable = output.mutableCopy();
            mutable.remove(A.Journal, (v,d,q) => {
                if(O.isRef(v)) {
                    journals.push({v: v, q: q});
                } else {
                    let normalisedTitle = normaliseTitle(v.toString());
                    let matchingJournal = normalisedTitleToJournal[normalisedTitle];
                    journals.push({
                        v: matchingJournal ? matchingJournal.ref : v,
                        q: q
                    });
                }
                return true; // Remove journal
            });
            // Ensures order unaffected and prevents duplicate journal entries
            _.each(journals, (journal) => {
                if(!mutable.has(journal.v, A.Journal, journal.q)) {
                    mutable.append(journal.v, A.Journal, journal.q);
                }
            });
            if(!output.valuesEqual(mutable)) {
                // hPostObjectEdit not called for programmatic edits
                if(COPY_PUBLISHER_FROM_JOURNAL) { appendPublisherFromJournal(mutable); }
                mutable.save();
            }
        });
        P.data.journalLinkingMigrationComplete = true;
    });
});

P.respond("GET,POST", "/do/hres-repository/link-plaintext-journals-to-object", [
], function(E) {
    O.action("std:action:administrator_override").enforce();
    if(E.request.method === "POST") {
        if(E.request.parameters.unblock) {
            P.data.journalLinkingMigrationStarted = false;
            P.data.journalLinkingMigrationComplete = false;
        } else {
            O.background.run("hres_repository:plaintext_journal_linking", {});
            return E.response.redirect("/");
        }
    }
    let view = {
        pageTitle: "Migrate unlinked journals",
        backLink: "/",
        text: "Are you sure you would like to link outputs with plain text journals to the journal object?"+
            (P.data.journalLinkingMigrationStarted ? "\nThis migration has been started" : ""),
        options: [{label:"Migrate outputs"}]
    };
    if(P.data.journalLinkingMigrationComplete) {
        view = _.extend(view, {
            text: "The  migration has been completed. Would you like to unblock this migration?",
            options: [{
                label:"Unblock",
                parameters: { "unblock": true }
            }]
        });
    }
    E.render(view, "std:ui:confirm");
});