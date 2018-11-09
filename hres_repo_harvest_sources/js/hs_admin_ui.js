/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanViewSources = O.action("hres_repo_harvest_sources:view_source_objects").
    title("View harvested source objects").
    allow("group", Group.RepositoryEditors);

P.element("source_objects", "Source objects for harvested repository items", function(L) {
    if(O.service("hres:repository:is_author", O.currentUser, L.object) || O.currentUser.allowed(CanViewSources)) {
        let q = P.db.sourceObjects.select().or((sq) => {
            sq.where("sourceObject", "=", L.object.ref).
                where("matchObject", "=", L.object.ref);
        });
        if(q.length) {
            let tabs = [];
            let authorityObject;
            q.each((row) => {
                if(row.matchObject) {
                    authorityObject = row.matchObject;
                }
                tabs.push({
                    href: row.sourceObject.load().url(),
                    label: row.source,
                    selected: (row.sourceObject == L.object.ref)
                });
            });
            if(authorityObject) {
                tabs.unshift({
                    href: authorityObject.load().url(),
                    label: "Authoritative record",
                    selected: (authorityObject == L.object.ref)
                });
            }
            L.render({
                isSource: (authorityObject != L.object.ref),
                "std:ui:tabs:links": {
                    tabs: tabs
                },
                "std:ui:notice": {
                    message: "This is a record of the item harvested from an external source. The version saved to "+
                        "the repository is the Authoritative record."
                }
            }, "tabs-element");
        }
    }
});
