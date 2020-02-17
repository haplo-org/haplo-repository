/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

(function($) {

    var displayButton = function() {
        return "<button class=\"btn bulk-add-authors\">Bulk add authors</button>";
    };

    Haplo.editor.registerDelegate("hres_bulk_author_addition", function(editor, data) {
        var authorDesc = data.authorCitation;
        var objectRef = data.objectRef;

        return {
            setupAttribute: function(attributeContainer) {
                var desc = attributeContainer.getDescriptor();
                if(desc === authorDesc) {
                    attributeContainer.addUI(displayButton(), {append:true});    
                }
            },
            startEditor: function() {
                $(document).on("click", ".bulk-add-authors", function(evt) {
                    Haplo.ui.openCovering("/do/hres-bulk-author-addition/get-authors/"+objectRef, "Cancel", 600, 800);
                });
                window.author_addition_editor = {
                    onEditClose: function(attributes, titles) {
                        window.authorCitationEditorValueAddMappings(titles);
                        editor.addAttributes(attributes);
                        Haplo.ui.closeCovering();
                    },
                    getSpinner: function() {
                        return Haplo.html.spinner;
                    }
                };
            }
        };
    });
})(jQuery);