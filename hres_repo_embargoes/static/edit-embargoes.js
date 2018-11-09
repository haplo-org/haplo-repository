/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var usedAttributes;

    var setupEmbargo = function() {
        var parent = this;

        if(!$('.start-picker .oforms-date-input', parent).val()) {
            $('.start-picker', parent).closest('.oforms-row.control-group').hide();
            $('.show-start-picker', parent).on('click', function() {
                $('.start-picker').closest('.oforms-row.control-group').show();
            });
        } else {
            $('.show-start-picker', parent).hide();
        }
        
        var setAllChecked = function() {
            $('.embargo-attributes input:checkbox', parent).prop("checked", true);
        };

        // Check all other attributes if "All" is checked
        var embargoAll = $('.embargo-attributes input:checkbox[value="all"]', parent);
        if(embargoAll.prop("checked")) {
            setAllChecked();
        }
        embargoAll.on('change',function() {
            if(embargoAll.prop("checked")) {
                setAllChecked(parent);
            }
        });
        
        $('.embargo-attributes input:not([value="all"])', parent).each(function() {
            if($('form[data-used-attributes]')[0] && (-1 === usedAttributes.indexOf(this.value))) {
                $(this).parent().append(" (not used on this record)").addClass('embargo-attribute-not-used');
            }
        });
        
        // "All" unchecked when anything is unchecked
        $('.embargo-attributes input:checkbox', parent).on('change', function() {
            if(!$(this).prop("checked")) {
                embargoAll.prop("checked", false);
            }
        });

        parent.setAttribute('data-embargo-setup', '1');
    };

    var setupAllEmargoes = function() {
        $('.embargo-repetition > .oforms-repetition:not([data-embargo-setup])').each(setupEmbargo);
    };

    $(document).ready(function() {

        if($('form[data-used-attributes]')[0]) { usedAttributes = $('form[data-used-attributes]')[0].getAttribute('data-used-attributes').split(','); }

        setupAllEmargoes();

        $('.oforms-add-btn').on('click', function() {
            window.setTimeout(setupAllEmargoes, 1);
        });

    });

})(jQuery);
