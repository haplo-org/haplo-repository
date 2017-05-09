/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("hres:development:generate-test-data-start", function(generator) {
    generator.addUsersInGroups(5, Group.RepositoryEditors, Group.AdminStaff);
});

P.implementService("hres:development:generate-test-data-end", function(action) {
    action(1200, function(generator) {
        console.log("Generating Repository...");
        
        var faculties = O.query().linkDirectly(T["hres:type:research-institute:faculty"],A.Type).execute();
        var publishers = [];
        _.each(TEST_PUBLISHERS, function(name) {
            var publisher = O.object();
            publisher.appendType(T.Publisher);
            publisher.appendTitle(name);
            publisher.save();
            publishers.push(publisher);
        });
      
        var appendDateWithProbablility = function(probability, object, desc, qual) {
            if(Math.random() < probability) {
                object.append(O.datetime(generator.randomDateInPeriod(-54,6,"day"),null,O.PRECISION_DAY), desc, qual);
            }
        };
        
        var repositoryItems = [];
        var createRepositoryItem = function() {
            var repositoryItem = O.object();
            // TODO: Bias this towards more used types with randomDistributedValue
            repositoryItem.appendType(generator.randomListMember(P.REPOSITORY_TYPES));
            repositoryItem.appendTitle(generator.randomProjectName());
            // researchers can be from multiple faculties
            generator.withSomeRandomListMembers(1, 2, faculties, function(faculty) {
                var people = generator.randomPeopleFromInstitute(1, 4, faculty.ref, T.Researcher);
                people.forEach(function(person) {
                    O.service("hres:author_citation:append_citation_to_object", repositoryItem, A.Author, null, {
                        object: person
                    });
                });
            });
            var name = generator.randomNewPersonName();
            O.service("hres:author_citation:append_citation_to_object", repositoryItem, A.Author, null, {
                first: name[1],
                last: name[2]
            });
                       
            repositoryItem.append(generator.randomParagraphText(), A.Abstract);
            repositoryItem.append(O.datetime(generator.randomDateInPeriod(-54,6,"year"),null,O.PRECISION_YEAR), A.Date);
            
            // Defined here so a new randomListMember and randomProjectName is drawn each time
            var publisherValues = [
                0.8, generator.randomListMember(publishers),
                0.9, generator.randomProjectName(),
                1, null
            ];
            var p = generator.randomDistributedValue(publisherValues);
            if(p) { repositoryItem.append(p, A.Publisher); }
            appendDateWithProbablility(0.6, repositoryItem, A.PublicationDates, Q.Print);
            appendDateWithProbablility(0.3, repositoryItem, A.PublicationDates, Q.Online);
            // TODO: License
            
            var labelChanges = O.labelChanges();
            if(Math.random() < 0.9) {
                labelChanges.add(Label.AcceptedIntoRepository);
            }
            
            // Other plugins might want to adjust the repository item
            O.serviceMaybe("hres_repository:test_data:pre_project_save", generator, repositoryItem);
            
            repositoryItem.save(labelChanges);
        };
        
        // 318 output records
        for(var i = 0; i < 318; i++) {
            createRepositoryItem();
        }
    });
});

// --------------------------------------------------------------------------
// Taken from http://www.accesstoresearch.org.uk/publishers
var TEST_PUBLISHERS = [
    "ALPSP",
    "Cambridge University Press",
    "De Gruyter Open (formerly Versita)",
    "Dove Press",
    "Edinburgh University Press",
    "Elsevier",
    "Emerald",
    "IOP Publishing",
    "Manchester University Press",
    "Nature Publishing Group",
    "Oxford University Press",
    "Portland Press",
    "Royal Society Journals",
    "SAGE",
    "Science Reviews 2000 Ltd",
    "Society for General Microbiology",
    "Springer",
    "Taylor and Francis",
    "Whiting & Birch",
    "Wiley",
    "Wolters Kluwer Health"
];

