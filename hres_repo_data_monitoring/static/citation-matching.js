/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {
    $(document).ready(function() {
        $('.hide').on('click', function(event) {
            var removeRow = $(this).closest('tr');
            var req = $.get($(this).attr('href'));
            removeRow.fadeOut(100);
            event.preventDefault();
        });
        $('.mergelink').on('click', function(event) {
            var removeRow = $(this).closest('tr');
            var token = $('input[name="__"]');
            $.ajax({
                type: "POST",
                url: $(this).attr('href'),
                contentType: 'application/json',
                headers: { 'Content-Type': 'application/json'},
                data: {
                    "__": token.val(),
                    citation: $(this).data('citation'),
                    ref: $(this).data('ref')
                }
            });
            removeRow.fadeOut(100);
            event.preventDefault();
        });
    });
}) (jQuery);
