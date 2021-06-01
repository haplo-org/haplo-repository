/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var VALID_SCOPUS_ID_REGEXP = /^\S+$/;

var createScopusEIDValue = P.implementTextType("hres_repository:output_identifier_scopus", "Repository output identifier Scopus ID", {
        string: function(value) {
            return value[0];
        },
        indexable: function(value) {
            return value[0];
        },
        identifier: function(value) {
            return value[0];
        },
        render: function(value) {
            return value[0];
        },
        $setupEditorPlugin: function(value) {
            P.template("include_editor_plugin").render();   // workaround to include client side support
        }
    });
// --------------------------------------------------------------------------------------------------------------------

P.ScopusEID = {
    create: function(scopusEID) {
        if((typeof(scopusEID) === 'string') && VALID_SCOPUS_ID_REGEXP.test(scopusEID)) {
             return createScopusEIDValue([scopusEID]);
        } else {
            throw new Error("Bad Scopus EID value");
        }
    },
    isScopusEID: function(maybeScopusEID) {
        return O.isPluginTextValue(maybeScopusEID, "hres_repository:output_identifier_scopus");
    }
};

// --------------------------------------------------------------------------------------------------------------------

P.provideFeature("hres:scopus", function(plugin) {
    plugin.ScopusEID = P.ScopusEID;
});
