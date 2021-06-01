/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

// Backwards compatibility: Prevents exceptions on release.
if(O.featureImplemented("std:document_store")) {
    P.use("std:document_store");
}

var USE_FEATURED_OUTPUTS = O.application.config["hres_repo_web_profiles:use_featured_outputs"] || false;
if(!USE_FEATURED_OUTPUTS) { return; }

P.implementService("hres_repo_navigation:repository_item_page", function(object, builder) {
    if(O.currentUser.ref == object.ref) {
        builder.sidebar.panel(500).link("default", "/do/hres-repo-web-profiles/edit-featured-outputs/"+object.ref,
            "Set featured outputs");
    }
});

var FeaturedOutputsForm = P.form("featured-outputs", "form/featured-outputs.json");

var featuredOutputs = P.defineDocumentStore({
    name: "featuredOutputs",
    keyIdType: "ref",
    formsForKey(key, instance, document) {
        return [FeaturedOutputsForm];
    },
    prepareFormInstance(key, form, instance, context) {
        let researcher = key.load();
        const orderedOutputs = P.orderedOutputsForResearcherOrReversePublicationOrder(researcher);
        instance.choices("outputs", _.map(orderedOutputs, (output) => {
            return [output.ref.toString(), O.service("hres_bibliographic_reference:plain_text_for_object", output)];
        }));
    }
});

P.implementService("hres_repo_web_profiles:get_featured_outputs_for_researcher", function(researcher) {
    let instance = featuredOutputs.instance(researcher.ref);
    if(instance.hasCommittedDocument) {
        return _.map(instance.lastCommittedDocument.featuredOutputs, (outputRef) => O.ref(outputRef).load());
    } else {
        return [];
    }
});

P.respond("GET,POST", "/do/hres-repo-web-profiles/edit-featured-outputs", [
    {pathElement:0, as:"object"},
    {parameter:"updated", as:"int", optional:true}
], function(E, researcher, updated) {
    if(researcher.ref != O.currentUser.ref) { O.stop("Not permitted"); }
    let instance = featuredOutputs.instance(researcher.ref);
    instance.handleEditDocument(E, {
        finishEditing(instance, E, complete) {
            if(complete) {
                instance.commit(O.currentUser);
                return E.response.redirect("?updated=1");
            }
            return E.response.redirect("/do/hres-repo-web-profiles/edit-featured-outputs/"+researcher.ref.toString());
        },
        render(instance, E, deferred) {
            E.render({
                backLink: "/do/repository/outputs/researcher/"+researcher.ref,
                updated: !!updated,
                edited: instance.currentDocumentIsEdited,
                form: deferred
            });
        }
    });
});