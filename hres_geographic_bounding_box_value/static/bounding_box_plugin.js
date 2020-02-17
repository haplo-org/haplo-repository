/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var ATTR_INFO = "Enter the bottom left point first, then top right point.<br>"+
                    "Longitude is expressed in decimal degrees (positive east).<br>"+
                    "Latitude is expressed in decimal degrees (positive north). ";

    var coordinateComponent = function(value, key, placeholder, prefix, suffix) {
        return [
            prefix,
            '<input type="text" data-key="', key, '" placeholder="', placeholder,
            '" value="', _.escape(value[key] || ''), '" size="10">',
            suffix].join('');
    };

    var RepositoryGeographicBoundingBoxEditorValue = function(value) {
        this.value = value;
    };
    _.extend(RepositoryGeographicBoundingBoxEditorValue.prototype, {
        generateHTML: function() {
            return [
                "<div class=\"repository_guidance_show geo-box\"><a href=\"#\" title=\"what's this?\"><p><b>?</b></p></a></div>",
                "<div class=\"repository_guidance_note geo-box\">"+ATTR_INFO+"</div>",
                coordinateComponent(this.value, "botLeftLat", "Latitude", "", ""),
                coordinateComponent(this.value, "botLeftLong", "Longitude", "", ""),
                coordinateComponent(this.value, "topRightLat", "Latitude", "", ""),
                coordinateComponent(this.value, "topRightLong", "Longitude", "", "")
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
    Haplo.editor.registerTextType("hres:geographic_box", function(value) {
        return new RepositoryGeographicBoundingBoxEditorValue(value);
    });

    //Info button toggle functionality
    $(document).ready(function() {
        $(document).on("click", ".repository_guidance_show.geo-box", function(evt) {
            evt.preventDefault();
            $(this).siblings(".repository_guidance_note").toggle();
        });

        $(document).on("click", ".repository_guidance_note.geo-box", function(evt) {
            $(this).siblings(".repository_guidance_show").toggle();
        });
    });   
})(jQuery);