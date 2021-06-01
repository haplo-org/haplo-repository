/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var EXPAND_STATUS = {
        COLLAPSED: 0,
        EXPANDED: 1
    };
    var safety = 5;
    var getLinks = function(doneStr) {
        if(--safety < 0) { return; }

        var output = $('.sherpa-links').data('ref');
        var forVersion = $('.sherpa-links').data('for-version');

        var queryParams = [];
        var url = "/api/hres-repo-embargoes/sherpa-romeo/"+output;
        if(doneStr) { queryParams.push("done="+doneStr); }
        if(forVersion) { queryParams.push("forVersion="+forVersion); }
        url += queryParams.length > 0 ? "?" + queryParams.join("&") : "";

        $.get(url)
            .done(function(response) {
                $('.sherpa-links').append(response.render);

                // Add expand/collapse functionality
                $(".expand-collapse").click(function() {
                    var policyOption = $(this).data("policy-option");
                    var status = $(this).data("status");
                    var policyTable = $(".policy-table[data-policy-option=\""+policyOption+"\"]");
                    if(status === EXPAND_STATUS.COLLAPSED) {
                        // For those hidden by default
                        $(this).removeClass("collapsed");
                        policyTable.fadeIn();
                        $(this).text("collapse");
                        $(this).data("status", EXPAND_STATUS.EXPANDED);
                    } else {
                        policyTable.fadeOut();
                        $(this).text("expand");
                        $(this).data("status", EXPAND_STATUS.COLLAPSED);
                    }
                });
                if(response.more) {
                    getLinks((response.done||[]).join(','));
                }
            });
    };

    $(document).ready(function() {
        getLinks(null);
    });
    
})(jQuery);
