/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var ATTR_INFO = "Longitude is expressed in decimal degrees (positive east).<br>"+
                    "Latitude is expressed in decimal degrees (positive north). ";

    var coordinateComponent = function(value, key, placeholder, prefix, suffix) {
        return [
            prefix,
            '<input type="text" data-key="', key, '" placeholder="', placeholder,
            '" value="', _.escape(value[key] || ''), '" size="10">',
            suffix].join('');
    };

    var RepositoryGeographicPointLocationEditorValue = function(value) {
        this.value = value;
    };
    _.extend(RepositoryGeographicPointLocationEditorValue.prototype, {
        generateHTML: function() {
            return [
                "<div class=\"repository_guidance_show geo-point\"><a href=\"#\" title=\"what's this?\"><p><b>?</b></p></a></div>",
                "<div class=\"repository_guidance_note geo-point\">"+ATTR_INFO+"</div>",
                coordinateComponent(this.value, "latitude", "Latitude", "", ""),
                coordinateComponent(this.value, "longitude", "Longitude", "", "")
            ].join(" ");
        },
        attach: function(container) {
        },
        getValue: function(container) {
            var value = {}, have;
            $("input", container).each(function() {
                var x = $.trim(this.value || "");
                if(x) { have = true; value[this.getAttribute("data-key")] = x; }
            });
            return have ? value : null;
        }
    });
    Haplo.editor.registerTextType("hres:geographic_point", function(value) {
        return new RepositoryGeographicPointLocationEditorValue(value);
    });

    //Info button toggle functionality
    $(document).ready(function() {
        $(document).on("click", ".repository_guidance_show.geo-point", function(evt) {
            evt.preventDefault();
            $(this).siblings(".repository_guidance_note").toggle();
        });

        $(document).on("click", ".repository_guidance_note.geo-point", function(evt) {
            $(this).siblings(".repository_guidance_show").toggle();
        });
    });   
})(jQuery);