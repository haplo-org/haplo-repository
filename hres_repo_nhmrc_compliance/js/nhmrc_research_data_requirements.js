/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.ResearchDataChecks = {
    "metadata": {
        label: "Appropriate metadata",
        manualCheck: true,
        check(output) {
            return P.NHMRCManualChecks.instance(output).lastCommittedDocument.appropriateMetadata;
        }
    },
    "access-level": {
        label: "Appropriate access level",
        manualCheck: true,
        check(output) {
            return P.NHMRCManualChecks.instance(output).lastCommittedDocument.appropriateAccessLevel;
        }
    },
    "final-report": {
        label: "Metadata listed in final report",
        manualCheck: true,
        check(output) {
            return P.NHMRCManualChecks.instance(output).lastCommittedDocument.metadataListedInFinalReport;
        }
    },
    "secondary-data": {
        label: "Secondary data",
        manualCheck: true,
        check(output) {
            let lastCommittedDocument = P.NHMRCManualChecks.instance(output).lastCommittedDocument;
            return !lastCommittedDocument.secondaryDataUsed || lastCommittedDocument.acknowledgedTeamAndCited;
        }
    }
};