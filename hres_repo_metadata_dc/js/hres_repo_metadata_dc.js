/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// TODO: Unify this with generation of <meta> tags in publisher, and also dc (or dcterms) implementations
// in both hres_repo_ethos and hres_repo_rioxx
var DC_ATTRS = [
    // relation - public landing page?
    {name:"title", desc:A.Title},
    {name:"creator", desc:A.AuthorsCitation},
    {name:"subject", desc:A.Keywords},
    {name:"description", desc:A.Abstract},
    {name:"publisher", desc:A.Publisher},
    {name:"date", desc:A.Date},
    {name:"contributor", desc:A.Editor},
    // format -- MIME type of file
    // source -- "A related resource from which the described resource is derived." -- Project? DOI of that?
    {name:"rights", desc:A.License}
];
var usingDOI = (O.featureImplemented("hres:doi") && ("DOI" in A));
if(usingDOI) {
    P.use("hres:doi");
}

P.implementService("hres:repository:dc:write-store-object-below-xml-cursor", function(item, cursor, options) {
    var dc = cursor.
        addNamespace("http://purl.org/dc/elements/1.1/", "dc").
        cursorWithNamespace("http://purl.org/dc/elements/1.1/");

    // relation is the URL of the published item page
    if(options && options.objectToURL) {
        var itemURL = options.objectToURL(item);
        if(itemURL) {
            dc.element("relation").text(itemURL).up();
        }
    }
    item.everyType(function(v,d,q) {
        var t = SCHEMA.getTypeInfo(v);
        if(t && t.code) {
            var s = t.code.split(':');
            var name = s[s.length - 1];
            if(name) { dc.element("type").text(name).up(); }
        }
    });
    _.each(DC_ATTRS, function(attr) {
        item.every(attr.desc, function(v,d,q) {
            var str = (O.isRef(v) ? v.load().firstTitle() : v).toString();
            dc.element(attr.name).text(str).up();
        });
    });
    // identifier is the public URL of the file (to match EPrints behaviour)
    if(options && options.fileToURL) {
        item.every((v,d,q) => {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                var fileURL = options.fileToURL(v);
                if(fileURL) {
                    dc.element("identifier").text(fileURL).up();
                }
            }
        });
    }
    if(usingDOI) {
        item.every(A.DOI, (v,d,q) => {
            dc.element("identifier").text(P.DOI.url(v)).up();
        });
    }
    item.every(A.ISSN, (v,d,q) => {
        dc.element("relation").text("ISSN:"+v.toString()).up();
    });
    // TODO: Should we also put the citation in the identifier?
});
