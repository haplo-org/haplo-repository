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

P.respond("GET", "/api/hres-repo-embargoes/sherpa-romeo", [
    {pathElement:0, as:"object"}
], function(E, output) {
    P.CanEditEmbargoes.enforce();

    var results = [];
    
    _.each(QUERY_STRING_TO_ATTRIBUTE, function(desc, key) {
        var v = output.first(desc);
        if(!v) { return; }
        
        var search;
        var params = {};
        if(key === "issn") {
            search = v.toString();
        } else {
            search = O.isRef(v) ? v.load().title : v.toString();
        }
        params[key] = search;
        
        var response = O._TEMP_API.blockingHttpRequest(
            "http://www.sherpa.ac.uk/romeo/api29.php",
            "GET",
            params,
            {},
            undefined
        );
        
        parseResponse(response.body, results);
    });

    E.response.body = JSON.stringify(results);
});
