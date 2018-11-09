/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var HomePageInstructions = P.guidanceNote("repository", "home-page-instructions", "Home page instructions", "home.xml");

P.element("home", "Home page introduction",
    function(L) {
        // Choose some authors to suggest the user impersonates
        var authors = P.data.impersonateAuthors || [];
        if(authors.length === 0) {
            var items = O.service("hres:repository:store_query").execute();
            if(items.length) {
                var safety = 256;
                while(--safety > 0 && (authors.length < 3)) {
                    var item = items[Math.floor(items.length * Math.random())];
                    if(item) {
                        var authorRef = item.first(A.Author);
                        if(authorRef && -1 === authors.indexOf(authorRef.toString())) {
                            authors.push(authorRef.toString());
                        }
                    }
                }
                P.data.impersonateAuthors = authors;
            }
        }

        L.render({
            instructions: HomePageInstructions.deferredRender(),
            tryImpersonating: {
                authors: _.map(authors, function(a) { return O.ref(a); }),
                repositoryEditors: _.compact(_.map(O.group(Group.RepositoryEditors).loadAllMembers(), function(user) {
                    return user.ref;
                })),
                dataPreparers: _.compact(_.map(O.group(Group.DataPreparers).loadAllMembers(), function(user) {
                    return user.ref;
                }))
            }
        });
    }
);

P.implementService("haplo_activity_navigation:overview:repository", function(activity, add) {
    add(100, P.template("repository_activity_guidance").deferredRender());
});
