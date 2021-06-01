/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.ResearchLiteratureChecks = {
    "open-access": {
        label: "Openly accessible within 12 months of publication",
        check(output) {
            let deadline = P.dateXMonthsAfterPublication(output, 12);
            let ffd = O.service("hres_repo_open_access:get_first_file_deposit", output);
            let passesCheck = !!deadline && !!ffd && !!output.first(A.PublicationProcessDates, Q.Deposited);
            if(!passesCheck) { return false; }

            let embargoes = O.serviceMaybe("hres_repo_embargoes:get_embargo", output);
            if(embargoes) {
                // Deadline increments so that we are checking the embargo isn't active after it
                let embargoDeadline = deadline.clone().addDays(1);
                let ffdEmbargo = _.find(embargoes, (embargo) => {
                    return !!(embargo.extensionGroup && SCHEMA.getAttributeInfo(embargo.desc).code === ffd.fileVersion);
                });
                // No extensionGroup is whole record embargo
                let wholeRecord = _.find(embargoes, (embargo) => !embargo.extensionGroup);
                // If the specific file is under embargo after the deadline has expired
                passesCheck = (!ffdEmbargo || !ffdEmbargo.isActive(embargoDeadline)) &&
                    (!wholeRecord || !wholeRecord.isActive(embargoDeadline));
            }

            return passesCheck && P.dateInPeriod(undefined, ffd.date, deadline);
        },
        detailDeferredRender(output) {
            let ffd = O.service("hres_repo_open_access:get_first_file_deposit", output);
            let displayObject = O.object();
            let displayAttrs = [A.Type, A.Title, A.PublicationDates, A.PublicationProcessDates, A.File];
            _.each(displayAttrs, (desc) => {
                output.every(desc, (v,d,q,x) => displayObject.append(v,d,q,x));
            });
            let embargoes = O.serviceMaybe("hres_repo_embargoes:get_embargo", output) || [];
            embargoes = _.filter(embargoes, (embargo) => {
                return !embargo.extensionGroup || (ffd && SCHEMA.getAttributeInfo(embargo.desc).code === ffd.fileVersion);
            });
            return P.template("check-deposit-detail").deferredRender({
                fileDeposit: ffd ? ffd.date : null,
                version: ffd ?  SCHEMA.getAttributeInfo(ATTR[ffd.fileVersion]).name : null,
                displayObject: displayObject,
                deadline: P.dateXMonthsAfterPublication(output, 12),
                embargoes: _.map(embargoes, (embargo) => {
                    return {
                        attribute: embargo.extensionGroup ? SCHEMA.getAttributeInfo(embargo.desc).name : "Whole record",
                        displayDates: embargo.getDatesForDisplay()
                    };
                })
            });
        }
    },
    "deposit": {
        label: "Metadata made public within 3 months of publication",
        check(output) {
            let deadline = P.dateXMonthsAfterPublication(output, 3);
            if(!deadline) { return false; }

            let depositDate = output.first(A.PublicationProcessDates, Q.Deposited);
            return !!(depositDate && P.dateInPeriod(undefined, depositDate.start, deadline));
        },
        detailDeferredRender(output) {
            let displayObject = O.object();
            _.each([A.Type, A.Title, A.PublicationProcessDates, A.PublicationDates], (desc) => {
                output.every(desc, (v,d,q) => displayObject.append(v,d,q));
            });
            return P.template("check-public-metadata-detail").deferredRender({
                displayObject: displayObject,
                deadline: P.dateXMonthsAfterPublication(output, 3)
            });
        }
    },
    "grant-system-marked": {
        label: "NHMRC grants management system updated",
        manualCheck: true,
        check(output) {
            if(P.ResearchLiteratureChecks["open-access"].check(output)) { return true; }
            let instance = P.NHMRCManualChecks.instance(output);
            return instance.lastCommittedDocument.grantManagementSystemUpdated;
        }
    }
};