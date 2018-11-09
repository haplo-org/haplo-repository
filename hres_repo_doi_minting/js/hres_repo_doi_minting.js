/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var CREDENTIAL_NAME = 'DOI Minting';

// --------------------------------------------------------------------------

var shouldHaveDOI = function(object) {
    if(!shouldHaveDOIimpl) {
        shouldHaveDOIimpl =
            O.serviceMaybe("hres:doi:minting:get-should-have-doi-function") ||
            defaultShouldHaveDOIimpl;
    }
    return shouldHaveDOIimpl(object);
};

var shouldHaveDOIimpl;

var defaultShouldHaveDOIimpl = function(object) {
    return object.labels.includes(Label.RepositoryItem);
};

// --------------------------------------------------------------------------

P.hook('hPostObjectChange', function(response, object, operation, previous) {
    if((operation === 'create') || (operation === 'update') || (operation === 'relabel')) {
        if(shouldHaveDOI(object)) {
            console.log("Running background job to mint or update DOI for", object);
            O.background.run("hres_repo_doi_minting:mint", {ref:object.ref.toString()});
        }
    }
});

// This rule can't currently be expressed with restrictions
P.hook('hPreObjectEdit', function(response, object, isTemplate) {
    if(O.service("hres:repository:is_repository_item", object) &&
        object.labels.includes(Label.AcceptedIntoRepository) &&
        !O.currentUser.isMemberOf(Group.RepositoryEditors)) {
        response.readOnlyAttributes = (response.readOnlyAttributes || []).concat(A.DOI);
    }
});

// --------------------------------------------------------------------------

P.backgroundCallback("mint", function(data) {
    O.impersonating(O.SYSTEM, function() {
        mintDOIForObject(O.ref(data.ref).load());
    });
});

var mintDOIForObject = function(object) {
    if(O.application.hostname !== O.application.config["hres:doi:minting:safety-application-hostname"]) {
        console.log("Not minting DOIs because hres:doi:minting:safety-application-hostname is not the current hostname. Is this a cloned live application?");
        return;
    }

    var doi;
    var existingDOI = object.first(A.DOI);
    var objectWithDOI = object.mutableCopy();
    if(existingDOI) {
        // Updated existing DOI?
        doi = P.DOI.asString(existingDOI);
        if(!_.find(O.application.config["hres:doi:minting:doi-prefix-for-update"]||[], function(prefix) { return doi.startsWith(prefix); } )) {
            // Not one of the prefixes owned by this repository, stop now
            console.log("Not updating DOI", doi, " (no prefix in hres:doi:minting:doi-prefix-for-update)");
            return;
        }
    } else {
        // Minting a new DOI, not just updating one.
        var doiPrefix = O.application.config["hres:doi:minting:doi-prefix"];
        if(!doiPrefix) {
            console.log("Not minting DOIs because hres:doi:minting:doi-prefix isn't set.");
            return;
        }
        doi = doiPrefix+object.ref;
        objectWithDOI.append(P.DOI.create(doi), A.DOI);
    }

    // Step 1: Send metadata to Metadata Store.
    var xml = O.xml.document();
    O.service("hres:repository:datacite:write-store-object-below-xml-cursor", objectWithDOI, xml.cursor());
    if(O.PLUGIN_DEBUGGING_ENABLED) { console.log(xml.toString()); }

    O.httpClient(O.application.config["hres:doi:minting:service-url"]+"/metadata").
        method("POST").
        body("application/xml;charset=UTF-8", xml.toString()).
        useCredentialsFromKeychain(CREDENTIAL_NAME).
        request(HaveSetMetadata, {
            doi: doi,
            ref: object.ref.toString()
        });
};

var HaveSetMetadata = P.callback("have-set-metadata", function(data, client, response) {
    if(response.successful) {
        // Step 2: Set the URL for the DOI.
        var doi = data.doi,
            object = O.ref(data.ref).load();
        var url = O.serviceMaybe("hres:doi:minting:public-url-for-object", object) || object.url(true);
        O.httpClient(O.application.config["hres:doi:minting:service-url"]+"/doi").
            method("POST").
            body("text/plain;charset=UTF-8", "doi="+doi+"\nurl="+url).
            useCredentialsFromKeychain(CREDENTIAL_NAME).
            request(Minted, {
                doi: doi,
                ref: object.ref.toString()
            });
    } else {
        console.log("Failed to set DOI metadata: ", response.errorMessage);
        console.log("Response body:", response.body ? response.body.readAsString("UTF-8") : "No body returned");
    }

});

var Minted = P.callback("minted", function(data, client, response) {
    if(response.successful) {
        // Step 3: Record the DOI on the record, if it's a newly minted one.
        var doi = P.DOI.create(data.doi),
            object = O.ref(data.ref).load();
        if(!object.first(A.DOI)) {
            object = object.mutableCopy();
            object.append(doi, A.DOI);
            object.save();
        }
    } else {
        console.log("Failed to mint DOI: ", response.errorMessage);
        console.log("Response body:", response.body ? response.body.readAsString("UTF-8") : "No body returned");
    }
});
