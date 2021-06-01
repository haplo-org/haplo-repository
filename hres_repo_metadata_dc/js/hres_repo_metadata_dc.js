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
    // source -- "A related resource from which the described resource is derived." -- Project? DOI of that?
    {name:"rights", desc:A.License}
];
var usingDOI = (O.featureImplemented("hres:doi") && ("DOI" in A));
if(usingDOI) {
    P.use("hres:doi");
}

P.implementService("hres:repository:dc:write-store-object-below-xml-cursor", function(item, cursor, options) {
    writeObjectAsDCXML(item, cursor, options);
});

P.implementService("hres:repository:dc:export-object-as-binary-data", function(item) {
    var xmlDocument = O.xml.document();
    var cursor = xmlDocument.cursor().
        element("dc");
    writeObjectAsDCXML(item, cursor);
    return O.binaryData(xmlDocument.toString(), {
        filename: item.title+"_dc.xml",
        mimeType: "application/xml"
    });
});

P.implementService("hres:repository:dc:export-object-as-binary-data-multiple", function(items) {
    let xmlDocument = O.xml.document();
    let cursor = xmlDocument.cursor().
        element("dc");
    _.each(items, item => {
        writeObjectAsDCXML(item, cursor);
    });
    return O.binaryData(xmlDocument.toString(), {
        filename: "search_export_dc.xml",
        mimeType: "application/xml"
    });
});

var writeObjectAsDCXML = function(item, cursor, options) {
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

    var peerReviewed = item.first(A.PeerReview);
    if(peerReviewed) {
        if(peerReviewed == O.behaviourRef("hres:list:peer-review:not-reviewed")) {
            dc.element("type").text("NotPeerReviewed").up();
        }
        if(peerReviewed == O.behaviourRef("hres:list:peer-review:reviewed")) {
            dc.element("type").text("PeerReviewed").up();
        }
    }


    _.each(DC_ATTRS, function(attr) {
        item.every(attr.desc, function(v,d,q) {
            var str = (O.isRef(v) ? v.load().firstTitle() : v).toString();
            dc.element(attr.name).text(str).up();
        });
    });

    if("Contributors" in A) {
        item.every(A.Contributors, function(v,d,q) {
            var str = (O.isRef(v) ? v.load().firstTitle() : v).toString();
            dc.element("contributor").text(str).up();
        });
    }

    item.every(A.File, (v,d,q) => {
        // identifier is the public URL of the file (to match EPrints behaviour)
        if(options && options.fileToURL) {
            var fileURL = options.fileToURL(v);
            if(fileURL) {
                dc.element("identifier").text(fileURL).up();
            }
        }
        dc.element("format").text(O.file(v).mimeType).up();
    });

    if(usingDOI) {
        item.every(A.DOI, (v,d,q) => {
            dc.element("identifier").text(P.DOI.url(v)).up();
        });
    }
    if(O.serviceImplemented("hres_bibliographic_reference:plain_text_for_object")) {
        var citation = O.service("hres_bibliographic_reference:plain_text_for_object", item);
        dc.element("identifier").text(citation).up();
    }

    item.every(A.ISSN, (v,d,q) => {
        dc.element("relation").text("ISSN:"+v.toString()).up();
    });
    item.every(A.ISBN, (v,d,q) => {
        dc.element("relation").text("ISBN:"+v.toString()).up();
    });
};
