/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Maximum number of put codes for a single request which will still return full metadata
var MAX_PUT_CODES_PER_REQUEST = 50;

P.implementService("hres:repository:harvest-source:orcid", function() {
    O.service("hres:orcid:integration:pull_data_all_users", Harvested, { kind: "record"});
});

var originalSourceIsThisApplication = function(cursor, requestData) {
    if(cursor.firstChildElementMaybe("source") &&
        cursor.firstChildElementMaybe("source-client-id")) {
            let path = cursor.getTextOfFirstChildElementMaybe("path");
            let credential = O.keychain.credential(requestData.keychainEntryName);
            return path === credential.account["client_id"];
    }
};

var getPutCodesFromXML = function(xml, requestData) {
    let cursor = xml.cursor();
    let putCodes = [];
    if(cursor.firstChildElementMaybe("record") &&
        cursor.firstChildElementMaybe("activities-summary") &&
        cursor.firstChildElementMaybe("works")) {
            cursor.eachChildElement("group", (groupCursor) => {
                let preferred;
                groupCursor.eachChildElement("work-summary", (workCursor) => {
                    if(!originalSourceIsThisApplication(workCursor.cursor(), requestData)) {
                        let displayIndex = parseInt(workCursor.getAttribute("display-index"), 10);
                        // ORCID highest displayIndex is preferred version
                        if(!preferred || displayIndex > preferred.displayIndex) {
                            preferred = {
                                putCode: workCursor.getAttribute("put-code"),
                                displayIndex: displayIndex
                            };
                        }
                    }
                });
                if(preferred) { putCodes.push(preferred.putCode); }
            });
    }
    return putCodes;
};

var chunkArray = function(array, chunkSize) {
    let chunks = [];
    do {
        chunks.push(_.first(array, chunkSize));
        array = _.rest(array, chunkSize);
    } while(array.length);
    return chunks;
};

var Harvested = P.callback("harvested", function(data, client, response) {
    if(response.successful) {
        if(!O.user(data.user).isActive) { return; } // TODO: Only harvest for existing members of staff?
        let putCodes = getPutCodesFromXML(O.xml.parse(response.body), data);
        // TODO: Replace with _.chunk when platform supports then remove chunkArray
        let putCodeLists = chunkArray(putCodes, MAX_PUT_CODES_PER_REQUEST);
        _.each(putCodeLists, (putCodeList) => {
            let mutable = client.mutableCopy();
            mutable.url(P.template("url/data-harvest").render({
                apiVersion: "3.0",
                prefix: data.prefix,
                orcid: data.orcid,
                putCodes: putCodeList.join(",")
            }));
            mutable.request(MetadataResponse, {
                user: data.user
            });
        });
    } else {
        console.log("Failed to retrieve data from ORCID: ", response.errorMessage);
        console.log("Response body:", response.body ? response.body.readAsString("UTF-8") : "No body returned");
        console.log(data);
    }
});


var MetadataResponse = P.callback("metadata_response", function(data, client, response) {
    if(response.successful) {
        let xml = O.xml.parse(response.body);
        let cursor = xml.cursor();
        if(cursor.firstChildElementMaybe("bulk")) {
            let harvest = [];
            cursor.eachChildElement("work", (workCursor) => {
                let object = P.createObjectFromXML(workCursor.cursor(), data.user);
                let putCode = workCursor.getAttribute("put-code");
                let subSource;
                if(workCursor.firstChildElementMaybe("source")) {
                    subSource = workCursor.getTextOfFirstChildElementMaybe("source-name");
                    workCursor.up();
                }
                harvest.push({
                    source: "orcid",
                    object: object,
                    identifier: putCode,
                    subSource: subSource
                });
            });
            O.service("hres_repo_harvest_sources:push_updates_from_source", harvest);
        }
    } else {
        console.log("Failed to retrieve data from ORCID: ", response.errorMessage);
        console.log("Response body:", response.body ? response.body.readAsString("UTF-8") : "No body returned");
        console.log(data);
    }
});
