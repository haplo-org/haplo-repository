/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:descriptive_object_labelling:setup", function(type) {
    SCHEMA.getTypesWithAnnotation('hres:annotation:repository:output').forEach(function(outputType) {
        type(outputType, {
            labels: [Label.Output]
        });
    });
});
