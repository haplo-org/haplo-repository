/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Taken from Haplo usage tracking 
var KIND_ENUM = {
    'view': 0,
    'download': 1
};

P.db.table("lastAccess", {
    // If double storing outputs fail loudly
    output: { type: "ref", uniqueIndex: true, indexed: true },
    lastDownload: { type: "datetime" }
});

P.implementService("haplo_usage_tracking:notify:event", function(event) {
    // Only want third party downloads to be acted on
    if(!(event.publication && event.object && event.kind === KIND_ENUM.download)) { return; }
    let object;
    O.withoutPermissionEnforcement(() => { object = event.object.load(); });
    if(!object.isKindOfTypeAnnotated("hres:annotation:repository-item")) { return; }

    let query = P.db.lastAccess.select().where("output", "=", event.object).limit(1),
        row;
    if(query.count() > 0) {
        row = query[0];
    } else {
        row = P.db.lastAccess.create({
            output: event.object
        });
    }
    row.lastDownload = new Date();
    row.save();
});

P.implementService("hres:repository:get_last_access_for_output", function(objectOrRef) {
    let output = O.isRef(objectOrRef) ? objectOrRef : objectOrRef.ref;
    if(!output) { return; }
    let access = P.db.lastAccess.select().where("output", "=", output).limit(1);
    if(access.count() > 0) { return access[0]; }
});

// --------------------------------------------------------------------------
// Migration - Delete after use | Also delete service "haplo_usage_tracking:TEMP:query_events"
// --------------------------------------------------------------------------

P.backgroundCallback("task", function(data) {
    O.impersonating(O.SYSTEM, () => {
        P.data.lastAccessMigrationStarted = true;
        let allOutputs = O.query().link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), A.Type).execute();

        _.each(allOutputs, (output) => {
            // Service returns query with descending datetime already a clause
            let eventsQuery = O.serviceMaybe("haplo_usage_tracking:TEMP:query_events").
                where("object", "=",output.ref).
                where("kind", "=", KIND_ENUM.download).
                // MAGIC NUMBER: 0 is the key for default user in haplo_usage_tracking
                where("classification", "=", 0).
                limit(1);

            if(eventsQuery.count() < 1) { return; }
            let query = P.db.lastAccess.select().where("output", "=", output.ref).limit(1),
                row;
            if(query.count() > 0) {
                row = query[0];
            } else {
                row = P.db.lastAccess.create({
                    output: output.ref
                });
            }
            row.lastDownload = eventsQuery[0].datetime;
            row.save();
        });

        P.data.lastAccessTableRowsEnd = P.db.lastAccess.select().count();
        P.data.lastAccessMigrationComplete = true;
    });
});

P.respond("GET,POST", "/do/hres-repo-last-access/import-last-accesses", [], function(E) {
    O.action("std:action:administrator_override").enforce();
    if(E.request.method === "POST") {
        P.data.lastAccessTableRowsStart = P.db.lastAccess.select().count();
        if(E.request.parameters.unblock) {
            P.data.lastAccessMigrationStarted = false;
            P.data.lastAccessMigrationComplete = false;
        } else {
            O.background.run("hres_repo_last_access:task", {});
            return E.response.redirect("/");
        }
    }
    if(!P.data.lastAccessMigrationComplete) {
        let note = P.data.lastAccessMigrationStarted ? " Note: the migration has started." : "";
        note += "\nRows in last access table at start of migration: "+P.data.lastAccessTableRowsStart;
        E.render({
            pageTitle: "Migrate last access dates",
            backLink: "",
            text: "Would you like to copy the last access date for every output into the last access table?\n"+
                "HAVE YOU ADDED THE INDEX ON 'object' AND 'kind' TO THE haplo_usage_tracking EVENTS TABLE?"+note,
            options: [{label:"Confirm"}]
        }, "std:ui:confirm");
    } else {
        let note = "\nRows in last access table at start of migration: "+P.data.lastAccessTableRowsStart+
            "\nRows in last access table at end of migration: "+P.data.lastAccessTableRowsEnd;
        E.render({
            pageTitle: "Migration completed",
            backLink: "",
            text: "The migration is complete. Would you like to unblock this migration?\n"+
                "PLEASE ENSURE YOU REMOVE THE INDEX ON 'object' AND 'kind' FROM THE haplo_usage_tracking EVENTS TABLE!"+note,
            options: [{
                label:"Unblock",
                parameters: { "unblock": true }
            }]
        }, "std:ui:confirm");
    }
});