/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// TODO: Use URL for registered user of metadata store?
var METADATA_URL_PREFIX = "https://data.datacite.org/application/vnd.datacite.datacite+xml/";

// --------------------------------------------------------------------------

var CanIngestFromDOI = O.action("hres:action:repository:can-ingest-from-doi").
    title("View Repository overview dashboards");
if("RepositoryEditors" in Group) { CanIngestFromDOI.allow("group", Group.RepositoryEditors); }

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(CanIngestFromDOI)) {
        builder.panel(1000).link(99991, "/do/hres-repo-doi-retrieve-for-new-object/start", "Ingest from DOI...");
    }
});

// --------------------------------------------------------------------------

P.respondAfterHTTPRequest("GET,POST", "/do/hres-repo-doi-retrieve-for-new-object/start", [
    {parameter:"doi", as:"string", optional:true}
], {
    setup: function(data, E, doi) {
        CanIngestFromDOI.enforce();
        data.doi = _.trim(doi||'');
        if(data.doi) {
            return O.httpClient(METADATA_URL_PREFIX+data.doi);
        }
    },
    process: function(data, client, result) {
        return {
            doi: data.doi,
            successful: result.successful,
            body: result.successful ? result.body.readAsString("UTF-8") : null
        };
    },
    handle: function(data, result, E) {
        CanIngestFromDOI.enforce();
        if(!data) {
            // Ask for DOI
            E.render();
            return;
        }
        if(!data.successful) {
            O.stop("Couldn't retrieve metadata for "+data.doi);
        }

        var object = O.object();
        var xml = O.xml.parse(data.body).cursor();
        if(!O.service("hres:repository:datacite:apply-xml-to-object", xml, object)) {
            console.log("Bad DOI metadata:", data.body);
            O.stop("Couldn't parse response from service.");
        }
        // Default type?
        if(!object.firstType()) {
            if("JournalArticle" in T) {
                object.appendType(T.JournalArticle, A.Type);
            } else {
                O.stop("Can't determine type of output");
            }
        }
        // Display editor
        E.render({
            data: data,
            doiUrl: P.DOI.url(object.first(A.DOI)),
            templateObject: object
        }, "editor");
    }
});
