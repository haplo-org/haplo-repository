/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var STATEMENT_NOTE = "The following tags are available to use in statements and will extract data "+
        "from the output record.";

    Haplo.editor.registerDelegate("hres_repo_cover_sheets", function(editor, data) {

        var statementAttrs = data.statementAttrs;
        var availableTags = data.availableTags;

        return {
            setupAttribute: function(attributeContainer) {
                var desc = attributeContainer.getDescriptor();
                if(-1 !== _.indexOf(statementAttrs, desc)) {
                    attributeContainer.addUI('<div style="text-align:left; margin-left:12px; color:#888; line-height: 1.4em;">'+STATEMENT_NOTE+'</div>');
                    var tagsHTML = '<div style="text-align:left; margin-left:90px; color:#888; line-height: 1.4em;">';
                    _.each(availableTags, function(tag) {
                        tagsHTML += '['+tag[0]+']'+': '+tag[1]+'<br>';
                    });
                    tagsHTML += '</div>';
                    attributeContainer.addUI(tagsHTML);
                }
            }
        };
    });

})(jQuery);
