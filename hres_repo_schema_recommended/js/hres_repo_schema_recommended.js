/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.implementService("hres:development:generate-test-data-start", function(generator) {
    var funders = [];
    _.each(TEST_FUNDERS, function(name) {
        var funder = O.object();
        funder.appendType(T.Funder);
        funder.appendTitle(name);
        funder.save();
        funders.push(funder);
    });
    // So they are available for the pre_project_save service, below
    generator.funders = funders;
});

P.implementService("hres_repository:test_data:pre_project_save", function(generator, repositoryItem) {
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

// --------------------------------------------------------------------------
// Taken from http://www.rin.ac.uk/system/files/attachments/List-of-major-UK-research-funders.pdf

var TEST_FUNDERS = [
    "Arts and Humanities Research Council",
    "Biotechnology and Biological Sciences Research Council",
    "Council for the Central Laboratory of the Research Councils",
    "Engineering and Physical Sciences Research Council",
    "Economic and Social Research Council",
    "Medical Research Council",
    "Natural Environment Research Council",
    "Particle Physics and Astronomy Research Council",
    "Science and Technology Facilities Council",
    "Academies",
    "British Academy",
    "Royal Academy of Engineering",
    "Royal Society",
    "Major Medical Research Charities",
    "Arthritis Research Campaign",
    "British Heart Foundation",
    "Cancer Research UK",
    "Wellcome Trust",
    "Leverhulme Trust",
    "Nuffield Foundation",
    "Joint Information Systems Committee"
];