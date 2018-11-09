/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var NODE_LOOKUP = [
    {
        "name": "copyrightlinktext",
        "shortname": "text"
    },
    {
        "name": "copyrightlinkurl",
        "shortname": "url"
    }
];

var ARCHIVING = [
    {
        "tag": "preprints",
        "type": "prearchiving",
        "text": " archive submitted version (i.e. pre-refereeing)"
    },
    {
        "tag": "postprints",
        "type": "postarchiving",
        "text": " archive accepted version (i.e. final draft post-refereeing)"
    },
    {
        "tag": "pdfversion",
        "type": "pdfarchiving",
        "text": " archive publisher's version"
    }
];

P.db.table('sherpaArchivingData', {
    object: { type: 'ref' },
    data: { type: 'json' }
});

var parseResponse = function(xml, results) {
    let cursor = O.xml.parse(xml).cursor();
    // SHERPA / RoMEO information
    if(cursor.firstChildElementMaybe("romeoapi") && cursor.firstChildElementMaybe("publishers")) {
        cursor.eachChildElement("publisher", function(c) {
            let result = {};
            let publisherName;
            let publisherAlias;
            // Publisher
            if(c.firstChildElementMaybe("name")) {
                if(c.getText()) { publisherName = c.getText().replace(/<(?:.|\n)*?>/gm, ''); }
                c.up();
            }
            if(c.firstChildElementMaybe("alias")) {
                if(c.getText()) { publisherAlias = c.getText().replace(/<(?:.|\n)*?>/gm, ''); }
                c.up();
            }
            if(publisherName) { 
                result.name = publisherName+(publisherAlias ? " ("+publisherAlias+")" : "");
            }

            // Paid access
            if(c.firstChildElementMaybe("paidaccess")) {
                let paidAccessName;
                let paidAccessNotes;
                let paidAccessURL;

                if(c.firstChildElementMaybe("paidaccessname")) {
                    paidAccessName = c.getText();
                    c.up();
                }
                if(c.firstChildElementMaybe("paidaccessnotes")) {
                    paidAccessNotes = c.getText();
                    c.up();
                }
                if(c.firstChildElementMaybe("paidaccessurl")) {
                    paidAccessURL = c.getText();
                    c.up();
                }
                if(paidAccessName) {
                    result.paidAccess = {
                        name: paidAccessName,
                        notes: paidAccessNotes,
                        url: paidAccessURL
                    };
                    c.up();
                }
            }

            // Conditions
            if(c.firstChildElementMaybe("conditions")) {
                while(c.firstChildElementMaybe("condition") || c.nextSiblingElementMaybe("condition")) {
                    if(!result.conditions) { result.conditions = []; }
                    if(c.getText()) {
                        result.conditions.push(c.getText().replace(/<(?:.|\n)*?>/gm, ''));
                    }
                }
                c.up().up();
            }

            // Copyright text and links
            if(c.firstChildElementMaybe("copyrightlinks")) {
                while(c.firstChildElementMaybe("copyrightlink") || c.nextSiblingElementMaybe("copyrightlink")) {
                    if(!result.copyright) { result.copyright = []; }
                    let copyright = {};
                    _.each(NODE_LOOKUP, (node) => {
                        if(c.firstChildElementMaybe(node["name"])) {
                            if(c.getText()) {
                                copyright[node['shortname']] = c.getText().replace(/<(?:.|\n)*?>/gm, '');
                            }
                            c.up();
                        }
                    });
                    result.copyright.push(copyright);
                }
                c.up();
                c.up();
            }

            // Archiving
            _.each(ARCHIVING, (archive) => {
                if(c.firstChildElementMaybe(archive["tag"]) && c.firstChildElementMaybe(archive["type"])) {
                    if(!result.archiving) { result.archiving = []; }
                    if(c.getText()) {
                        result.archiving.push(c.getText()+archive["text"]);
                    }
                    c.up().up();
                }
            });
            results.push(result);
        });
    }
};

var QUERY_STRING_TO_ATTRIBUTE = {
    "issn": A.Issn,
    "jtitle": A.Journal,
    "pub": A.Publisher
};

P.respondAfterHTTPRequest("GET", "/api/hres-repo-embargoes/sherpa-romeo", [
    {pathElement:0, as:"object"},
    {parameter:"done", as:"string", optional:true}
], {
    setup: function(data, E, output, keysDoneStr) {
        var keysDoneIn = (keysDoneStr||'').split(',');
        var keysDoneOut = [];   // rebuild to avoid trusting input

        var queries = [];
        _.each(QUERY_STRING_TO_ATTRIBUTE, function(desc, key) {
            var v = output.first(desc);
            if(v && (-1 === keysDoneIn.indexOf(key))) {
                var search;
                var params = {};                            
                if(key === "issn") {
                    search = v.toString();
                } else {
                    search = O.isRef(v) ? v.load().title : v.toString();
                }
                params[key] = search;
                queries.push({key:key, params:params});
            } else {
                keysDoneOut.push(key);
            }
        });

        if(queries.length > 0) {
            data.more = (queries.length > 1);
            var q = queries[0];
            data.done = keysDoneOut.concat(q.key);
            data.key = q.key;
            data.object = output.ref.toString();
            var http = O.httpClient("http://www.sherpa.ac.uk/romeo/api29.php");
            _.each(q.params, function(v,k) { http.queryParameter(k,v); });
            return http;
        }
    },
    process: function(data, client, result) {
        var results = [];
        if(result.successful) {
            parseResponse(result.body.readAsString("UTF-8"), results);
        }
        return {
            object: data.object,
            more: data.more,
            key: data.key,
            done: data.done,
            publishers: results
        };
    },
    handle: function(data, result, E, output) {
        var object = O.ref(data.object);
        P.db.sherpaArchivingData.select().where('object', '=', object).deleteAll();
        P.db.sherpaArchivingData.create({
            object: object,
            data: data
        }).save();
        E.response.body = JSON.stringify(data);
        E.response.kind = 'json';
    }
});
