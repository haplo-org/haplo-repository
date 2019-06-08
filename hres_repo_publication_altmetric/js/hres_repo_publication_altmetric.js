/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.webPublication.pagePart({
    name: "hres:repository:output:altmetric-display",
    category: "hres:repository:output:sidebar",
    sort: 2500,
    deferredRender: function(E, context, options) {
        if(context.object) {
            let doi = context.object.first(A.DOI);
            if(doi) {
                return P.template("altmetric-badge").deferredRender({doi:doi.toFields().value[0]});
            }
        }
    }
});
