/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var displayInput = function(value) {
        var showVal = value.value;
        if(value.type === "Iteminthisrepository") { 
            value.type = ""; 
        }
        return [
            value.type,
            ":<input type=\"text\" size=\"20\" value='",
            _.escape(showVal),
            "' tabindex=\"1\" placeholder='",
            value.placeholder,
            "'>"
        ].join(" ");
    };

    var displayButton = function() {
        return "<button class=\"btn related_output_button\">Add related output</button>";
    };

    var RepositoryRelatedOutputEditorValue = function(value) {
        this.value = value;
    };
    _.extend(RepositoryRelatedOutputEditorValue.prototype, {
        generateHTML: function() {
            return this.value.value ? displayInput(this.value) : "<p></p>";
        },
        attach: function(container) {
        },
        getValue: function(container) {
            var value = this.value, have;
            $('input', container).each(function() {
                var x = $.trim(this.value || '');
                if(x) { have = true; value.value = x; }
            });
            return have ? value : null;
        }
    });


    //Implementing the text types for use in the editor
    var types = [
        "ARK", "arXiv", "bibcode", "EAN13", "EISSN", "IGSN", "ISSN",
        "ISTC", "LISSN", "LSID", "PURL", "UPC", "URN", "w3id"
    ];
    _.each(types, function(type) {
        var displayType = type.toLowerCase();
        Haplo.editor.registerTextType("hres_repository:output_identifier_"+displayType, function(value) {
            return new RepositoryRelatedOutputEditorValue(value);
        });
    });   

    Haplo.editor.registerTextType("hres:related_output", function(value) {
        return new RepositoryRelatedOutputEditorValue(value);
    });

    Haplo.editor.registerDelegate("hres_repo_related_output", function(editor, data) {
        var relatedDesc = data.relatedOutput;
        var objectRef = data.objectRef;
        return {
            setupAttribute: function(attributeContainer) {
                var desc = attributeContainer.getDescriptor();
                if(desc === relatedDesc) {
                    attributeContainer.addUI(displayButton(), {append:true});                   
                    attributeContainer.setOptions({defaultEmptyValue: false});
                }
            },
            startEditor: function() {
                $(document).on("click", ".related_output_button", function(evt) {
                    Haplo.ui.openCovering("/do/hres-related-output-value/get-values/"+objectRef, "Cancel", 600, 800);
                });
                //Remove plus button in lieu of custom one above 
                $(".related_output_button").parent().siblings(".fr").remove();

                window.related_output_editor = {
                    onEditClose: function(output) {
                        editor.addAttributes(output);
                        Haplo.ui.closeCovering();
                    }
                };
            }
        };
    });
})(jQuery);