/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


if(O.featureImplemented("std:web-publisher")) {
    P.use("std:web-publisher");

    P.webPublication.pagePart({
        name: "hres:repository:output:impact",
        category: "hres:repository:output:below",
        sort: 250,
        deferredRender(E, context, options) {
            if(context.object) {
                let impacts = O.query().
                    link(T.Impact, A.Type).
                    link(context.object.ref, A.UnderpinningResearch).
                    sortByDate().
                    execute();
                if(impacts.length) {
                    return P.template("web-publisher/impact-panel").deferredRender({
                        impacts: _.map(impacts, (i) => {
                            return {
                                impact: i,
                                href: context.publishedObjectUrl(i),
                                summary: i.first(A.Abstract)
                            };
                        })
                    });
                }
            }
        }
    });

    P.webPublication.pagePart({
        name: "hres:repository:person:impact",
        category: "hres:repository:person:sidebar",
        sort: 250,
        deferredRender(E, context, options) {
            if(context.object) {
                let impacts = O.query().
                    link(T.Impact, A.Type).
                    link(context.object.ref, A.Researcher).
                    sortByDate().
                    execute();
                if(impacts.length) {
                    return P.template("web-publisher/impact-panel").deferredRender({
                        impacts: _.map(impacts, (i) => {
                            return {
                                impact: i,
                                href: context.publishedObjectUrl(i),
                                summary: i.first(A.Abstract)
                            };
                        })
                    });
                }
            }
        }
    });

}
