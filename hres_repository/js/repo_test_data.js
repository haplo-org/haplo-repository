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
        var journals = [];
        _.each(TEST_JOURNALS, function(name) {
            var journal = O.object();
            journal.appendType(T.Journal);
            journal.appendTitle(name);
            journal.save();
            journals.push(journal);
        });
        var licenses = O.query().link(T.License, A.Type).execute();
        var projects = O.query().link(T.Project, A.Type).execute();
        var events = [];    // Created in main createRepositoryItem loop

        var appendDateWithProbablility = function(probability, object, desc, qual, asRange) {
            if(Math.random() < probability) {
                if(asRange) {
                    var start = generator.randomDateInPeriod(-54,6,"day");
                    var end;
                    while(!end || start.diffDays(end) > 0) {
                        end = generator.randomDateInPeriod(-54,6,"day");
                    }
                    object.append(O.datetime(start), O.datetime(end), desc, qual);
                } else {
                    object.append(O.datetime(generator.randomDateInPeriod(-54,6,"day"),null,O.PRECISION_DAY), desc, qual);
                }
            }
        };        
        var typeUsesAttribute = function(type, attribute) {
            var typeInfo = SCHEMA.getTypeInfo(type);
            return (-1 === typeInfo.attributes.indexOf(attribute));
        };
        var createISSNLikeString = function() {
            var str = '';
            var appendNumbers = () => {
                for(var i=0; i<4; i++) {
                    str += Math.round(Math.random());
                }
            };
            appendNumbers();
            str += "-";
            appendNumbers();
            return str;
        };

        var createRepositoryItem = function() {
            var repositoryItem = O.object();
            var type = generator.randomListMember(P.REPOSITORY_TYPES);
            repositoryItem.appendType(type);
            repositoryItem.appendTitle(generator.randomProjectName());

            // Add the researchers on the project as authors
            var people = [];
            if(Math.random() < 0.65) {
                var project = generator.randomListMember(projects);
                repositoryItem.append(project.ref, A.Project);
                project.every(A.Researcher, (v,d,q) => people.push(v.load()));
            }
            var randomFaculty = generator.randomListMember(faculties);
            // ... and some other authors, who may be from a different faculty
            var otherPeople = generator.randomPeopleFromInstitute(0, 4, randomFaculty.ref, T.Researcher);
            people = people.concat(otherPeople);
            people.forEach((person) => {
                O.service("hres:author_citation:append_citation_to_object", repositoryItem, A.Author, null, {
                    object: person
                });
            });
            var name = generator.randomNewPersonName();
            O.service("hres:author_citation:append_citation_to_object", repositoryItem, A.Author, null, {
                first: name[1],
                last: name[2]
            });
                       
            repositoryItem.append(O.text(O.T_TEXT_PARAGRAPH, generator.randomParagraphText()), A.Abstract);
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
            if(Math.random() < 0.7) {
                repositoryItem.append(generator.randomListMember(licenses), A.License);
            }
            if(typeUsesAttribute(type, A.Journal)) {
                var journalValues = [
                    0.8, generator.randomListMember(journals),
                    0.9, generator.randomProjectName(),
                    1, null
                ];
                var j = generator.randomDistributedValue(journalValues);
                if(j) { repositoryItem.append(j, A.Journal); }
            }
            if(typeUsesAttribute(type, A["std:attribute:event"])) {
                if(Math.random() < 0.8) {
                    if((Math.random() < 0.1) && events.length) {
                        repositoryItem.append(generator.randomListMember(events).ref, A["std:attribute:event"]);
                    } else {
                        var event = O.object();
                        event.appendType(T.ExternalEvent);
                        event.appendTitle(generator.randomProjectName());
                        event.append(generator.randomListMember(generator.NOUNS), A["haplo:attribute:location"]);
                        appendDateWithProbablility(0.8, event, A.EventDate, null, true /* asRange */);
                        event.save();
                        repositoryItem.append(event.ref, A["std:attribute:event"]);
                        events.push(event);
                    }
                }
            }
            if(typeUsesAttribute(type, A.ISSN)) {
                if(Math.random() < 0.7) {
                    repositoryItem.append(createISSNLikeString(), A.ISSN);
                }
            }
            if(typeUsesAttribute(type, A["std:attribute:isbn"])) {
                if(Math.random() < 0.7) {
                    repositoryItem.append(createISSNLikeString(), A["std:attribute:isbn"]);
                }
            }

            var labelChanges = O.labelChanges();
            if(Math.random() < 0.9) {
                labelChanges.add(Label.AcceptedIntoRepository);
            }
            
            // Other plugins might want to adjust the repository item
            O.serviceMaybe("hres_repository:test_data:pre_item_save", generator, repositoryItem);
                       
            repositoryItem.save(labelChanges);
        };
        
        // Create 3108 output records
        for(var i = 0; i < 3108; i++) {
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

// --------------------------------------------------------------------------
// Taken from https://en.wikipedia.org/wiki/List_of_open-access_journals
var TEST_JOURNALS = [
    "Nature Communications",
    "PLOS ONE",
    "Royal Society Open Science",
    "Science Advances",
    "Scientific Reports",
    "African Journal of Food, Agriculture, Nutrition and Development",
    "Open Access Journal of Medicinal and Aromatic Plants",
    "Information Bulletin on Variable Stars",
    "Journal of the Korean Astronomical Society",
    "Open Astronomy",
    "AMA Journal of Ethics",
    "BMC Medical Ethics",
    "Canadian Journal of Bioethics",
    "African Invertebrates",
    "BMC Biology",
    "BMC Evolutionary Biology",
    "BMC Genomics",
    "BMC Systems Biology",
    "Cell Reports",
    "Check List",
    "Contributions to Zoology",
    "Ecology and Evolution",
    "eLife",
    "F1000Research",
    "Genome Biology",
    "International Journal of Biological Sciences",
    "Israel Journal of Entomology",
    "Molecular Systems Biology",
    "Oncotarget",
    "Open Biology",
    "Open Life Sciences",
    "PeerJ",
    "PLOS Biology",
    "PLOS Computational Biology",
    "PLOS Genetics",
    "Scientific Reports",
    "ZooKeys",
    "Arkivoc",
    "Beilstein Journal of Organic Chemistry",
    "Chemical Science",
    "Molecules",
    "Organic Syntheses",
    "Open Chemistry",
    "RSC Advances",
    "Computational Linguistics",
    "INFOCOMP Journal of Computer Science",
    "Journal of Artificial Intelligence Research",
    "Journal of Computational Geometry",
    "Journal of Formalized Reasoning",
    "Journal of Machine Learning Research",
    "Journal of Object Technology",
    "Journal of Statistical Software",
    "Logical Methods in Computer Science",
    "PeerJ Computer Science",
    "Theory of Computing",
    "Contact Quarterly",
    "Real-World Economics Review",
    "The Journal of Entrepreneurial Finance",
    "Theoretical Economics",
    "Australasian Journal of Educational Technology",
    "Educational Technology & Society",
    "Journal of Higher Education Outreach and Engagement",
    "Energies",
    "Advances in Production Engineering & Management",
    "Frontiers in Heat and Mass Transfer",
    "Open Engineering",
    "Conservation and Society",
    "Ecology and Society",
    "Environmental Health Perspectives",
    "Environmental Research Letters",
    "Fennia",
    "GSA Today",
    "Journal of Political Ecology",
    "Open Geosciences",
    "PeerJ",
    "Anamesa",
    "continent",
    "Culture Machine",
    "Digital Humanities Quarterly",
    "First Monday",
    "GHLL",
    "Sign Systems Studies",
    "Southern Spaces",
    "Medieval Worlds",
    "Zapruder World: An International Journal for the History of Social Conflict",
    "Duke Law Journal",
    "German Law Journal",
    "Health and Human Rights",
    "Melbourne University Law Review",
    "SCRIPT-ed",
    "Glossa",
    "Language Documentation & Conservation",
    "Per Linguam",
    "College & Research Libraries",
    "Information Technologies and International Development",
    "Scientific Data",
    "Beilstein Journal of Nanotechnology",
    "Materials Today",
    "Polymers",
    "Science and Technology of Advanced Materials",
    "Acta Mathematica",
    "Advances in Group Theory and Applications",
    "Algebraic Geometry",
    "Annales Academiae Scientiarum Fennicae. Mathematica",
    "Annales de l'Institut Fourier",
    "Arkiv för Matematik",
    "Ars Mathematica Contemporanea",
    "Australasian Journal of Combinatorics",
    "Axioms",
    "Discrete Analysis",
    "Discrete Mathematics & Theoretical Computer Science",
    "Electronic Communications in Probability",
    "Electronic Journal of Combinatorics",
    "Electronic Journal of Probability",
    "Electronic Journal of Statistics",
    "Electronic Transactions on Numerical Analysis",
    "Forum of Mathematics",
    "Hardy-Ramanujan Journal",
    "Journal de Théorie des Nombres de Bordeaux",
    "Journal of Formalized Reasoning",
    "Journal of Graph Algorithms and Applications",
    "Journal of Integer Sequences",
    "Journal of Modern Applied Statistical Methods",
    "Mathematics and Mechanics of Complex Systems",
    "Münster Journal of Mathematics",
    "Open Mathematics",
    "Séminaire Lotharingien de Combinatoire",
    "The New York Journal of Mathematics",
    "Annals of Saudi Medicine",
    "Bangladesh Journal of Pharmacology",
    "Biomedical Imaging and Intervention Journal",
    "BMC Health Services Research",
    "BMC Medicine",
    "BMJ Open",
    "British Medical Journal",
    "British Columbia Medical Journal",
    "Canadian Medical Association Journal",
    "Clinical and Translational Science",
    "Dermatology Online Journal",
    "Emerging Infectious Diseases",
    "International Journal of Medical Sciences",
    "Journal of Clinical Investigation",
    "Journal of Postgraduate Medicine",
    "The New England Journal of Medicine",
    "Open Heart",
    "Open Medicine",
    "PLOS Medicine",
    "PLOS Neglected Tropical Diseases",
    "PLOS Pathogens",
    "Scientia Pharmaceutica",
    "Gamut: The Journal of the Music Theory Society of the Mid-Atlantic",
    "Music Theory Online",
    "Journal of Nutrition",
    "Journal of Ethics & Social Philosophy",
    "Philosophers' Imprint",
    "New Journal of Physics",
    "Open Physics",
    "Physical Review X",
    "Caucasian Review of International Affairs",
    "Central European Journal of International and Security Studies",
    "European Political Economy Review",
    "Journal of Politics & Society",
    "Michigan Journal of Political Science",
    "Cultural Anthropology",
    "Frontiers in Psychology",
    "Jadaliyya",
    "Journal of Artificial Societies and Social Simulation",
    "Journal of Pan African Studies",
    "Journal of Political Ecology",
    "Journal of World-Systems Research"
];