/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    // UoA Leads get read permissions at all outputs within their UoA
    setup.roleOversightPermission("Head",      "read",     SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'));
});

P.implementService("haplo:descriptive_object_labelling:setup", function(type) {
    O.service("hres:repository:each_repository_item_type", function(outputType) {
        type(outputType, {
            labelsFromLinked: [
                [A.Researcher, A.REFUnitOfAssessment]
            ]
        });
    });
});