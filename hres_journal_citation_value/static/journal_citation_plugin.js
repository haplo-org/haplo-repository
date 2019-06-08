/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var citationComponent = function(value, key, placeholder, prefix, suffix) {
        return [
            prefix,
            '<input type="text" data-key="', key, '" placeholder="', placeholder,
            '" value="', _.escape(value[key] || ''), '" size="10">',
            suffix].join('');
    };

    var RepositoryJournalCitationEditorValue = function(value) {
        this.value = value;
    };
    _.extend(RepositoryJournalCitationEditorValue.prototype, {
        generateHTML: function() {
            return [
                    citationComponent(this.value, "volume", "Volume", '', ''),
                    citationComponent(this.value, "number", "Number", '(', ')'),
                    citationComponent(this.value, "pageRange", "Page range", '', '')
                ].join(' ');
        },
        attach: function(container) {
        },
        getValue: function(container) {
            var value = {}, have;
            $('input', container).each(function() {
                var x = $.trim(this.value || '');
                if(x) { have = true; value[this.getAttribute('data-key')] = x; }
            });
            return have ? value : null;
        },
        undoableDeletedText: function(container) {
            var value = this.getValue(container);
            return _.compact([
                    value.volume,
                    value.number ? '('+value.number+')' : undefined,
                    value.pageRange
                ]).join(' ');
        }
    });

    Haplo.editor.registerTextType("hres:journal_citation", function(value) {
        return new RepositoryJournalCitationEditorValue(value);
    });

})(jQuery);
