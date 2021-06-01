/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.PatentChecks = {
    "published-correctly": {
        label: "Published in Australian Official Journal of Patents within 18 months",
        manualCheck: true,
        check(output) {
            return P.NHMRCManualChecks.instance(output).lastCommittedDocument.publishedInAOJPWithin18Months;
        }
    },
    "administering-institution": {
        label: "Administering institution on Source IP",
        manualCheck: true,
        check(output) {
            return P.NHMRCManualChecks.instance(output).lastCommittedDocument.administeringInstitutionOnSourceIP;
        }
    },
    "grant-id-source-ip": {
        label: "Relevant grant id referenced on Source IP",
        manualCheck: true,
        check(output) {
            return P.NHMRCManualChecks.instance(output).lastCommittedDocument.grantIDOnSourceIP;
        }
    }
};