/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// TODO: Would other information returned be useful here? Eg. prearchiving and postarchiving details
// or the <conditions> info?
var NODE_LOOKUP = {
    "name": "name",
    "copyrightlinktext": "text",
    "copyrightlinkurl": "url"
};

var parseResponse = function(body, results) {
    var parser = O.service("hres_thirdparty_libs:sax_parser");
    var inPublisherDetails;
    var tagName;
    parser.onopentag = function(node) {
        if(node.name === "publisher") {
            inPublisherDetails = true;
        } else if(inPublisherDetails) {
            tagName = NODE_LOOKUP[node.name];
        }
    };
    parser.ontext = function(text) {
        if(text && tagName) {
            if(tagName === "name") {
                results.unshift({name: text, links:[{}]});
            } else if(results[0].links[0] && results[0].links[0][tagName]) {
                results[0].links.unshift({});
                results[0].links[0][tagName] = text;
            } else {
                results[0].links[0][tagName] = text;
            }
        }
    };
    parser.onclosetag = function(nodeName) {
        if(tagName) {
            tagName = undefined;
        }
        if(nodeName === "publisher") {
            inPublisherDetails = false;
        }
    };
    parser.write(body);
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
        P.CanEditEmbargoes.enforce();

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
            more: data.more,
            key: data.key,
            done: data.done,
            publishers: results
        };
    },
    handle: function(data, result, E, output) {
        E.response.body = JSON.stringify(data);
        E.response.kind = 'json';
    }
});
