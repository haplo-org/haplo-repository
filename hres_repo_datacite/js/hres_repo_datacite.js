/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var MANDATORY = [
    {
        name:"identifier",
        value: A.DOI,
        _attr: {
            "identifierType": "DOI"
        }
    },
    {
        name: "resourceType",
        value: A.Type,
        _attr: {
            "resourceTypeGeneral": "Text" // TODO: Support other general resource types, especially for RDM
        }
    },
    {
        name:"creators",
        value: [
            {
                name: "creator",
                relation: A.AuthorsCitation,
                value: [
                    {
                        name: "creatorName",
                        value: function(o) { 
                            var fields = o.firstTitle().toFields();
                            return fields.last+", "+fields.first;
                        }
                    },
                    {name: "givenName", value: function(o) { return o.firstTitle().toFields().first; }},
                    {name: "familyName", value: function(o) { return o.firstTitle().toFields().last; }},
                    {
                        name: "nameIdentifier",
                        value: A.ORCID,
                        _attr: {"nameIdentifierScheme": "ORCID"}
                    }
                ]
            }
        ]
    },
    {
        name:"titles",
        value: [{ name:"title", value: A.Title }]
    },
    {
        name:"publisher",
        value: A.Publisher
    },
    {
        name:"publicationYear",
        value: A.Date
    }
];

var build = function(spec, context) {
    var i  = {};

    // Allow for attributes that could have mixed ref and string values
    if(O.isRef(context.ref)) {
        var obj = context;
        switch(typeof(spec.value)) {
            case "string":
                i[spec.name] = spec.value;
                break;
            case "object":
                i[spec.name] = [];
                // Move context to linked objects
                _.each(spec.value, function(s) {
                    if("relation" in s) {
                        context = _.map(obj.every(s.relation), function(v) {
                            var ref = O.isRef(v) ?
                                O.ref(v) :
                                O.service("hres:author_citation:get_ref_maybe", v);
                            if(ref) {
                                return ref.load();
                            } else {
                                return v;
                            }
                        });
                    } else {
                        context = [obj];
                    }
                    _.each(context, function(o) {
                        var b = build(s, o);
                        if(b) { i[spec.name].push(b); }
                    });
                });
                break;
            case "function":
                i[spec.name] = spec.value(obj);
                break;
            default:
                var v = obj.first(spec.value);
                if(v) {
                    var str;
                    if(O.isRef(v)) {
                        str = v.load().title;
                    } else if(P.DOI.isDOI(v)) {
                        str = P.DOI.asString(v);
                    } else {
                        str = v.toString();
                    }
                    i[spec.name] = str;
                }
                break;
        }
    } else {
        // If context is not a linked object, use value directly
        // First child value should be the 'title of this context' value
        var x = {};
        x[spec.value[0].name] = context.toString();
        i[spec.name] = [x];
    }

    // Add XML attributes
    if(i[spec.name] && spec._attr) {
        i[spec.name] = [{_attr:spec._attr}, i[spec.name]];
    }

    if(!_.isEmpty(i)) { 
        return i;
    }
};

P.implementService("hres:repository:datacite:to-xml-metadata", function(item) {
    var metadataItems = [];
    
    _.each(MANDATORY, function(spec) {
        metadataItems.push(build(spec, item));
    });

    return {
        "resource": [
            {_attr: {
                "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                "xmlns": "http://datacite.org/schema/kernel-4",
                "xsi:schemaLocation": "http://datacite.org/schema/kernel-4 http://schema.datacite.org/meta/kernel-4/metadata.xsd"
            }}
        ].concat(metadataItems)
    };
});
