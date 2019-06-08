/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var setupEmbargo = function(maybeParent) {
        var parent = maybeParent || this;

        if(!$('.start-picker .oforms-date-input', parent).val()) {
            $('.start-picker', parent).closest('.oforms-row.control-group').hide();
            $('.show-start-picker', parent).on('click', function() {
                $('.start-picker', parent).closest('.oforms-row.control-group').show();
            });
        } else {
            $('.show-start-picker', parent).hide();
        }
    };

    $(document).ready(function() {
        setupEmbargo($('.whole-object-embargo'));
        $('.embargo-repetition').each(setupEmbargo);
    });

})(jQuery);
