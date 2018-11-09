/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.implementService("hres_repository:test_data:pre_item_save", function(generator, repositoryItem) {
    var funderDistribution = [
        0.8, generator.randomListMember(generator.funders),
        0.9, generator.randomProjectName(),
        1, null
    ];

    var appendDateWithProbablility = function(probability, object, desc, qual) {
        if(Math.random() < probability) {
            object.append(O.datetime(generator.randomDateInPeriod(-54,6,"day"),null,O.PRECISION_DAY), desc, qual);
        }
    };    
    
    var f = generator.randomDistributedValue(funderDistribution);
    if(f) { repositoryItem.append(f, A.Funder); }
    appendDateWithProbablility(0.1, repositoryItem, A.PublicationProcessDates, Q.Completed);
    appendDateWithProbablility(0.7, repositoryItem, A.PublicationProcessDates, Q.Accepted);
    appendDateWithProbablility(0.2, repositoryItem, A.PublicationProcessDates, Q.Deposited);
});

// -------- Reporting ---------------------------------

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.fact("publicationAcceptanceDate", "date", "Accepted");
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    var publicationAcceptance = object.first(A.PublicationProcessDates, Q.Accepted);
    if(publicationAcceptance) {
        row.publicationAcceptanceDate = publicationAcceptance.start;
    }
});

P.implementService("std:reporting:dashboard:ref_non_compliance:setup", function(dashboard) {
    dashboard.columns(15, ["publicationAcceptanceDate"]);
});

P.implementService("std:reporting:dashboard:repository_overview:setup_export", function(dashboard) {
    dashboard.columns(95, ["publicationAcceptanceDate"]);
});
P.implementService("std:reporting:dashboard:outputs_in_progress:setup_export", function(dashboard) {
    dashboard.columns(160, ["publicationAcceptanceDate"]);
});

// ---------- Permissions ------------------------------

P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    setup.groupRestrictionLabel(Group.RepositoryEditors, Label.ViewPreparedFiles);
});

P.hook('hObjectAttributeRestrictionLabelsForUser', function(response, user, object) {
    if(O.serviceMaybe("hres:repository:is_author", user, object)) {
        response.userLabelsForObject.add(Label.ViewPreparedFiles);
    }
});
