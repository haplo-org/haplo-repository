/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

(function($) {
    $(function() {
        $(".search-results").children().each(function() {
            var ref = $(this).data("ref");
            if(ref) {
                $(this).append("<input type='checkbox' name="+ref+" class='search-checkbox'>");
            }
        });
        $("#export-form").submit(function(e) {
            $(this).remove(".search-checkbox");
            $(".search-checkbox").clone().hide().appendTo($(this));

            if($(this).serialize().indexOf("on") < 0) {
                e.preventDefault();
            }
        });
        $(".search-results").prepend('<a id="select-all"> Select all outputs </a>');
        $("#select-all").on("click", function() {
            $(".search-checkbox").prop("checked", true);
        });
    });
}) (jQuery);