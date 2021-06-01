/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

t.test(function() {

    // --------------------------------------------------------------------------
    // Utility functions
    // --------------------------------------------------------------------------
    var createRepositoryItem = function(type) {
        let repositoryItem = O.object([Label.RepositoryItem]);
        repositoryItem.appendTitle("Test Output");
        repositoryItem.preallocateRef();
        repositoryItem.appendType(type);
        return repositoryItem;
    };

    var depositItem = function(output, date) {
        output.append(O.datetime(date), A.PublicationProcessDates, Q.Deposited);
    };


    // --------------------------------------------------------------------------
    // Research Literature Checks
    // --------------------------------------------------------------------------
        // --------------------------------------------------------------------------
        // Setup
        // --------------------------------------------------------------------------
        let publicationDate = XDate.today();
        let itemSaved = false;
        let researchLiterature = createRepositoryItem(T.JournalArticle);
        researchLiterature.append(O.datetime(publicationDate), A.PublicationDates);
        t.assert(!P.passesNHMRCChecks(researchLiterature));


        // --------------------------------------------------------------------------
        // Checking deposit checker works up to the 3 month limit and no further
        // --------------------------------------------------------------------------
        let depositDeadline = publicationDate.clone().addMonths(3, true);

        depositItem(researchLiterature, depositDeadline.clone().addDays(1));
        t.assert(!P.passesNHMRCChecks(researchLiterature));
        t.assert(!P.ResearchLiteratureChecks.deposit.check(researchLiterature));
        researchLiterature.remove(A.PublicationProcessDates);

        depositItem(researchLiterature, depositDeadline);
        t.assert(!P.passesNHMRCChecks(researchLiterature));
        t.assert(!!P.ResearchLiteratureChecks.deposit.check(researchLiterature));


        // --------------------------------------------------------------------------
        // Checking making something open access works up to the 12 month limit and no further
        // --------------------------------------------------------------------------
        let openAccessDeadline = publicationDate.clone().addMonths(12, true);
        O.service("hres_repo_open_access:set_first_file_deposit", {
            output: researchLiterature.ref,
            date: openAccessDeadline,
            fileVersion: "hres:attribute:published-file"
        });
        t.assert(P.passesNHMRCChecks(researchLiterature));
        t.assert(!!P.ResearchLiteratureChecks["open-access"].check(researchLiterature));


        // --------------------------------------------------------------------------
        // Checks that embargoes correctly fail the check for open accessibility
        // --------------------------------------------------------------------------
        if(O.serviceImplemented("hres_repo_embargoes:set_embargo")) {
            researchLiterature.save();
            itemSaved = true;
            researchLiterature = researchLiterature.ref.load(); // Refreshing reference so it can be relabelled for embargoes

            O.service("hres_repo_embargoes:set_embargo", {
                object: researchLiterature,
                end: openAccessDeadline.clone().addDays(1)
            });

            t.assert(!P.passesNHMRCChecks(researchLiterature));
            t.assert(!P.ResearchLiteratureChecks["open-access"].check(researchLiterature));

            O.service("hres_repo_embargoes:get_embargo", researchLiterature).deleteAll();
            researchLiterature = researchLiterature.mutableCopy();
        }


        // --------------------------------------------------------------------------
        // Check that this item which passes all of the checks would pass on deposit if undeposited
        // --------------------------------------------------------------------------
        researchLiterature.remove(A.PublicationProcessDates);
        t.assert(!!P.willPassOnDeposit(researchLiterature));
        depositItem(researchLiterature, depositDeadline);

        t.assert(P.passesNHMRCChecks(researchLiterature));

        if(itemSaved) {
            researchLiterature.deleteObject();
            itemSaved = false;
        }

    // --------------------------------------------------------------------------
    // Research Data Checks
    // --------------------------------------------------------------------------
        // --------------------------------------------------------------------------
        // Setup
        // --------------------------------------------------------------------------
        if("Dataset" in T) {
            let dataset = createRepositoryItem(T.Dataset);
            t.assert(!P.passesNHMRCChecks(dataset));
            let instance = P.NHMRCManualChecks.instance(dataset);


            // --------------------------------------------------------------------------
            // Testing form keys work as expected
            // --------------------------------------------------------------------------
            let document = {
                appropriateMetadata: true
            };
            instance.setCurrentDocument(document, false);
            instance.commit();
            t.assert(!P.passesNHMRCChecks(dataset));

            document.appropriateAccessLevel = true;
            instance.setCurrentDocument(document, false);
            instance.commit();
            t.assert(!P.passesNHMRCChecks(dataset));

            document.metadataListedInFinalReport = true;
            instance.setCurrentDocument(document, true);
            instance.commit();
            t.assert(P.passesNHMRCChecks(dataset));

            document.secondaryDataUsed = true;
            instance.setCurrentDocument(document, false);
            instance.commit();
            t.assert(!P.passesNHMRCChecks(dataset));

            document.acknowledgedTeamAndCited = true;
            instance.setCurrentDocument(document, true);
            instance.commit();
            t.assert(P.passesNHMRCChecks(dataset));
        }


    // --------------------------------------------------------------------------
    // Patent Checks
    // --------------------------------------------------------------------------
        // --------------------------------------------------------------------------
        // Setup
        // --------------------------------------------------------------------------
        if("Patent" in T) {
            let patent = createRepositoryItem(T.Patent);
            t.assert(!P.passesNHMRCChecks(patent));
            let instance = P.NHMRCManualChecks.instance(patent);


            // --------------------------------------------------------------------------
            // Testing form keys work as expected
            // --------------------------------------------------------------------------
            let document = {
                publishedInAOJPWithin18Months: true
            };
            instance.setCurrentDocument(document, false);
            instance.commit();
            t.assert(!P.passesNHMRCChecks(patent));

            document.administeringInstitutionOnSourceIP = true;
            instance.setCurrentDocument(document, false);
            instance.commit();
            t.assert(!P.passesNHMRCChecks(patent));

            document.grantIDOnSourceIP = true;
            instance.setCurrentDocument(document, false);
            instance.commit();
            t.assert(P.passesNHMRCChecks(patent));
        }


});