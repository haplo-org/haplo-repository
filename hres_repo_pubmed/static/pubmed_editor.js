/* Haplo Research Manager                             http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var PubmedEditorValue = function(value) {
        this.pmid = value[0] || "";
    };
    _.extend(PubmedEditorValue.prototype, {
        generateHTML: function() {
            var pmid = this.pmid;
            var html = ["<input type=\"text\" size=\"20\" value='", _.escape(pmid), "' tabindex=\"1\" placeholder=\"eg: 12082125\">"];
            return html.join("");
        },
        attach: function(container) {
        },
        getValue: function(container) {
            var pmid = $.trim(($('input', container)[0].value || ''));
            return pmid.length ? [pmid] : null;
        }
    });

    Haplo.editor.registerTextType("hres_repository:output_identifier_pmid", function(value) {
        return new PubmedEditorValue(value);
    });

})(jQuery);
