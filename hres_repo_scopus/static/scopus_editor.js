/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

(function($) {

    var ScopusEditorValue = function(value) {
        this.scopusID = value[0] || "";
    };
    _.extend(ScopusEditorValue.prototype, {
        generateHTML: function() {
            var scopusID = this.scopusID;
            var html = ["<input type=\"text\" size=\"20\" value='", _.escape(scopusID), "' tabindex=\"1\" placeholder=\"eg: 2-s1.0-1234567890\">"];
            return html.join("");
        },
        attach: function(container) {
        },
        getValue: function(container) {
            var scopusID = $.trim(($('input', container)[0].value || ''));
            return scopusID.length ? [scopusID] : null;
        }
    });

    Haplo.editor.registerTextType("hres_repository:output_identifier_scopus", function(value) {
        return new ScopusEditorValue(value);
    });

})(jQuery);
