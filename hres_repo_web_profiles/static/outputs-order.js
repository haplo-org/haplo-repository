/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    $(document).ready(function() {
        $('#cv-outputs-list').sortable({
            containment: "parent"
        });
        $('form').on('submit', function() {
            var outputs = [];
            $('.cv-outputs-item').each(function() {
                outputs.push(this.getAttribute('data-ref'));
            });
            $('input[name=outputs]').val(outputs.join(','));
        });
    });

})(jQuery);
