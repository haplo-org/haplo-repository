/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

(function($){
    $(function(){
        $("#get-authors").on("submit", function(evt) {
            if(!$("#authors").val()) { 
                evt.preventDefault(); 
                return;
            }
            var gif = window.parent.author_addition_editor.getSpinner();
            $("#loading").append(gif);
            $("input[type='submit']").hide();
        });

        var submission = $(".auto-submit");
        if(submission) {
            submission.submit();
        }
    });
})(jQuery);