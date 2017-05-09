/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    $(document).ready(function() {
        
        if(!$('.oforms-date-input', '.start-picker').val()) {
            $('.start-picker').parents('.oforms-row.control-group').hide();
            $('.show-start-picker').on('click', function() {
                $('.start-picker').parents('.oforms-row.control-group').show();
            });
        } else {
            $('.show-start-picker').hide();
        }

    });

})(jQuery);
