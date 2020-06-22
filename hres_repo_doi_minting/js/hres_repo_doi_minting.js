/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var CREDENTIAL_NAME = 'DOI Minting';

var MintDOIs = O.action("hres:doi:can_mint_doi").
    title("Mint DOI for objects").
    allow("group", Group.RepositoryEditors);

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

var doiRequested = function(ref) {
    return _.contains((P.data.doiRequestedRefs || []), O.isRef(ref) ? ref.toString() : ref);
};

// --------------------------------------------------------------------------

P.implementService("std:action_panel:category:hres:repository_item", function(display, builder) {
    if(doiRequested(display.object.ref)) {
        builder.panel(25).element(5, {label:"DOI requested"});
    } else if(shouldHaveDOI(display.object) &&
        !display.object.first(A.DOI) &&
        O.currentUser.allowed(MintDOIs) &&
        display.object.labels.includes(Label.AcceptedIntoRepository)) {
        if(O.serviceMaybe("hres_repo_datacite:missing_metadata_details", display.object)) {
            builder.panel(5).link(5, "/do/hres-doi-minting/cannot-mint/"+display.object.ref, "Unable to mint DOI");
        } else {
            builder.panel(5).link(5, "/do/hres-doi-minting/mint/"+display.object.ref, "Mint DOI");
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

// TODO: workflow feature to give repo editors option to mint automatically on deposit

P.hook('hPostObjectChange', function(response, object, operation, previous) {
    if((operation === 'update') || (operation === 'relabel')) {
        if(object.first(A.DOI)) {
            console.log("Running background job to maybe update DOI for", object);
            O.background.run("hres_repo_doi_minting:mint", {ref:object.ref.toString()});
        }
    }
});

P.implementService("hres:doi:mint_doi_for_object", function(object) {
    console.log("Running background job to mint or update DOI for", object);
    P.data.doiRequestedRefs = (P.data.doiRequestedRefs || []).concat([object.ref.toString()]);
    O.background.run("hres_repo_doi_minting:mint", {ref:object.ref.toString()});
});

P.respond("GET,POST", "/do/hres-doi-minting/mint", [
    {pathElement:0, as:"object"}
], function(E, object) {
    MintDOIs.enforce();
    if(object.first(A.DOI) || doiRequested(object.ref)) {
        O.stop("DOI already minted or requested. Please return to the output page and refresh if necessary.");
    }
    if(E.request.method === "POST") {
        console.log("Running background job to mint DOI for", object);
        P.data.doiRequestedRefs = (P.data.doiRequestedRefs || []).concat([object.ref.toString()]);
        O.background.run("hres_repo_doi_minting:mint", {ref:object.ref.toString()});
        return E.response.redirect(object.url());
    }
    E.render({
        pageTitle: "Mint new DOI",
        backLink: object.url(),
        backLinkText: "Cancel",
        text: "Would you like to mint a new DOI for \""+object.title+"\", sending the metadata to "+
            "Datacite for this purpose?\nThe new DOI will link to the public landing page for this item, "+
            "and the associated DOI metadata will be updated if this record is changed.",
        options: [{label: "Mint"}]
    }, "std:ui:confirm");
});

P.respond("GET", "/do/hres-doi-minting/cannot-mint", [
    {pathElement:0, as:"object"}
], function(E, object) {
    MintDOIs.enforce();
    E.render({
        pageTitle: "Unable to mint DOI",
        backLink: object.url(),
        details: O.serviceMaybe("hres_repo_datacite:missing_metadata_details", object)
    });
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

    // TODO: Should we check that there's a change to the xml generated before we send?
    O.httpClient(O.application.config["hres:doi:minting:service-url"]+"/metadata").
        method("POST").
        header("Content-Type", "application/xml").
        header("charset", "UTF-8").
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
        var url = O.serviceMaybe("hres:repository:common:public-url-for-object", object) || object.url(true);
        O.httpClient(O.application.config["hres:doi:minting:service-url"]+"/doi").
            method("POST").
            body("text/plain;charset=UTF-8", "doi="+doi+"\nurl="+url).
            useCredentialsFromKeychain(CREDENTIAL_NAME).
            request(Minted, {
                doi: doi,
                ref: object.ref.toString()
            });
    } else {
        P.data.doiRequestedRefs = _.reject((P.data.doiRequestedRefs || []), (ref) => ref === data.ref);
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
        console.log("Response url:", response.url);
        console.log("Response reason:", response.reason);
    }
    P.data.doiRequestedRefs = _.reject((P.data.doiRequestedRefs || []), (ref) => ref === data.ref);
});