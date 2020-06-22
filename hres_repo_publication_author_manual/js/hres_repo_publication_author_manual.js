/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CreatePublicPage = O.action("repository:action:create-public-page").
    title("Create public page for record").
    allow('group', Group.RepositoryEditors);

var addLink = function(display, builder) {
    if(O.currentUser.allowed(CreatePublicPage)) {
        let object = display.object;
        let isPublic = object.labels.includes(Label.ResearcherPublishedToRepository);
        builder.panel(140).
            link('default',
                "/do/hres-repo-publication-author-manual/update-author/"+object.ref,
                (isPublic ? "De-activate" : "Create")+" public repository page");
    }
};

P.implementService("std:action_panel:staff", addLink);
P.implementService("std:action_panel:researcher_past", addLink);

P.respond("GET,POST", "/do/hres-repo-publication-author-manual/update-author", [
    {pathElement:0, as:"object"}
], function(E, object) {
    CreatePublicPage.enforce();
    if(!(object.isKindOf(T.Person))) { O.stop("Not permitted."); }
    let isPublic = object.labels.includes(Label.ResearcherPublishedToRepository);
    if(E.request.method === "POST") {
        let changes = O.labelChanges();
        if(isPublic) {
            changes.remove([Label.ResearcherPublishedToRepository]);
        } else {
            changes.add([Label.ResearcherPublishedToRepository]);
        }
        O.withoutPermissionEnforcement(() => { object.relabel(changes); });
        return E.response.redirect(object.url());
    }
    E.render({
        pageTitle: (isPublic ? "De-activate" : "Create")+" public repository page",
        backLink: object.url(),
        backLinkText: "Cancel",
        text: "Do you want to "+(isPublic ? "de-activate the":  "create a")+" landing page in "+
            "the public repository for this record?",
        options: [{label: (isPublic ? "De-activate" : "Create")}]
    }, "std:ui:confirm");
});
