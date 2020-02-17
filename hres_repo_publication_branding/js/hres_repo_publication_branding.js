/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var formImagePath = function(objectKind, imageIndex) {
    if(_.isUndefined(objectKind) || _.isUndefined(imageIndex)) { return; }
    return objectKind+"-"+imageIndex+".jpg";
};

P.implementService("hres:repository:update_branding", function(objectKind, images) {
    return _.map(images, (image, i) => {
        if(!!O.serviceMaybe("hres:repository:get_image_for_branding", formImagePath(objectKind, i))) {
            if(image.image) {
                image.image = "/branding/"+objectKind+"/"+i;
            } else {
                image = "/branding/"+objectKind+"/"+i;
            }
        }
        return image;
    });
});

P.webPublication.feature("hres:repository:branding:update", function(publication, spec) {
    publication.respondToDirectory('/branding',
        function(E, context) {
            let params = E.request.extraPathElements;
            if(params.length !== 2) { return; }
            let imageType = params[0];
            let imageIndex = params[1];
            E.response.setExpiry(28800);
            E.response.body = O.serviceMaybe('hres:repository:get_image_for_branding', formImagePath(imageType, imageIndex));
    });
});