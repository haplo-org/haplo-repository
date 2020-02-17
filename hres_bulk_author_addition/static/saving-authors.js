/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

(function($) {
    $(document).ready(function() {
        var closeCover = $('#editor-cover-should-close');
        if(closeCover.length) {
            var attributes = closeCover[0].getAttribute('data-attributes'),
                objectTitles = closeCover[0].getAttribute('data-titles');

            window.parent.author_addition_editor.onEditClose(attributes, objectTitles);
            return;
        }
    });
})(jQuery);