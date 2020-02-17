/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var createBoundingBox = P.implementTextType("hres:geographic_box", "Geographic bounding box", {
    string(value) {
        return _.compact([
                value.botLeftLat,
                value.botLeftLong,
                value.topRightLat,
                value.topRightLong,
            ]).join(" ");
    },
    indexable(value) {
        return this.string(value);
    },
    render(value) {
        let display = _.compact([
            "(",
            value.botLeftLat,
            ", ",
            value.botLeftLong,
            ") to (",
            value.topRightLat,
            ", ",
            value.topRightLong,
            ")"
        ]).join("");
        
        return _.escape(display);
        
    },
    $setupEditorPlugin(value) {
        P.template("include_geographic_box_plugin").render();
    }
});

//Hack to get around the attribute-group not calling the $setupEditorPlugin function on plugin data-types
P.hook("hPreObjectEdit", function(response, object) {
    if(object.isKindOf(T.Dataset)) {
        P.template("include_geographic_box_plugin").render();
    }
});