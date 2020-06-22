/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var createPubmedValue = P.implementTextType("hres_repository:output_identifier_pmid", "Repository Output Identifier Pubmed Id", {
        string: function(value) {
            return value[0];
        },
        indexable: function(value) {
            return this.string(value);
        },
        render: function(value) {
            return value[0];
        },
        $setupEditorPlugin: function(value) {
            P.template("include_editor_plugin").render();   // workaround to include client side support
        }
    });
// --------------------------------------------------------------------------------------------------------------------

P.PMID = {
    create: function(pmid) {
        if((typeof(pmid) === 'string')) {
            return createPubmedValue([pmid]);
        } else {
            throw new Error("Bad Pubmed Id value");
        }
    },
    isPMID: function(maybePMID) {
        return O.isPluginTextValue(maybePMID, "hres_repository:output_identifier_pmid");
    }
};

// --------------------------------------------------------------------------------------------------------------------

P.provideFeature("hres:pmid", function(plugin) {
    plugin.PMID = P.PMID;
});

P.respond("GET,POST", "/do/hres-repo-pubmed/migrate-to-text-type", [
    
], function(E) {
    if(!O.currentUser.isSuperUser) { O.stop("Not permitted"); }
    let allOutputs = O.query().link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item", A.Type)).execute();
    let number = 0;
    _.each(allOutputs, output => {
        let pmids = [], 
            mutable = output.mutableCopy();

        mutable.remove(A.PubMedID, v => {
            pmids.push(P.PMID.create(v.toString()));
            return true;
        });
        _.each(pmids, pmid => {
            mutable.append(pmid, A.PubMedID);
        });

        pmids = [];
        mutable.remove(A.PubMedCentralID, v => {
            pmids.push(P.PMID.create(v.toString()));
            return true;
        });
        _.each(pmids, pmid => {
            mutable.append(pmid, A.PubMedCentralID);
        });

        if(!output.valuesEqual(mutable)){
            number++;
            if(E.request.method === "POST") {
                O.withoutPermissionEnforcement(() => {
                    mutable.save();
                });
            }
        }
    });
    E.render({
        pageTitle: "Migrate to PUBMED text type",
        backLink: "/",
        text: "Are you sure you would like to reassign "+number+" pubmed IDs to the specific text type?",
        options: [{label:"Confirm"}]
    }, "std:ui:confirm");
});