/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {
    $(document).ready(function(){
        var shownForm;
        $("input[type=radio][name=type]").change(function() {
            var selectedType = this.value;
            var hint = "e.g. " + this.getAttribute("data-hint");
            if(selectedType === "Iteminthisrepository") {
                shownForm = "#outputForm";
                $(shownForm).show();
                $("#generalValue").hide();
            } else if(selectedType) {
                shownForm = "#generalValue";
                $(shownForm).show();
                $("#outputForm").hide();
                $("input[type=text][name=value]").attr("placeholder", hint);
            }
        });

        $("form[name=relatedOutput]").submit(function(event) {
            var warnings = [],
                relationship = $("input[type=radio][name=relationship]:checked").val(),
                type = $("input[type=radio][name=type]:checked").val(),
                value = $(shownForm + " input:text").val();

            if(!relationship) { warnings.push("Please specify a relationship"); }
            if(!type) { warnings.push("Please specify a type"); }
            if(!value) { warnings.push("Please specify a value"); }
            if(warnings.length > 0) {
                $("#warning").html(warnings.join("<br>")); 
                event.preventDefault();
            }

        });
    });
})(jQuery);