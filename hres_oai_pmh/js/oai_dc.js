/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var DC_ATTRS = [
    {name:"dc:title", desc:A.Title},
    {name:"dc:creator", desc:A.AuthorsCitation},
    {name:"dc:subject", desc:A.Keywords},
    {name:"dc:description", desc:A.Abstract},
    {name:"dc:publisher", desc:A.Publisher},
    {name:"dc:date", desc:A.Date},
    {name:"dc:contributor", desc:A.Editor},
    // dc:format -- MIME type of file
    // dc:source -- "A related resource from which the described resource is derived." -- Project? DOI of that?
    {name:"dc:rights", desc:A.License}
];

P.getDublinCoreMetadata = function(item) {
    var metadataItems = [];
    item.everyType(function(v,d,q) {
        var name = P.typeToSet.get(v);
        if(name) { metadataItems.push({"dc:type":name}); }
    });
    metadataItems.push({"dc:identifier": item.url(true)});
    _.each(DC_ATTRS, function(dc) {
        item.every(dc.desc, function(v,d,q) {
            var str = (O.isRef(v) ? v.load().firstTitle() : v).toString();
            var i = {}; i[dc.name] = str;
            metadataItems.push(i);
        });
    });
    return {
        metadata: [
            {"oai_dc:dc": [
                {_attr: {
                    "xmlns:oai_dc": "http://www.openarchives.org/OAI/2.0/oai_dc/",
                    "xmlns:dc": "http://purl.org/dc/elements/1.1/",
                    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                    "xsi:schemaLocation": "http://www.openarchives.org/OAI/2.0/oai_dc/ http://www.openarchives.org/OAI/2.0/oai_dc.xsd"
                }}
            ].concat(metadataItems)}
        ]
    };
};
