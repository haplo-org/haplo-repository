/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var REFChecks = P.REFChecks = {
    "deposit": {
        label: "Manuscript deposited in time",
        check(output) {
            let ffd = P.getFirstFileDeposit(output);
            // Outputs from other HEIs should be registered as an exception. If it is necessary to do
            // an import the data should be loaded into the ffd database
            if(ffd) {
                return depositCheck(output, ffd.date);
            }
        }
    },
    "embargo": {
        label: "Embargo within allowed length",
        check(output) {
            let embargoes = O.serviceMaybe("hres_repo_embargoes:get_embargo", output);
            if(!embargoes) { return true; }
            // TODO: How to handle if the outout has multiple possible UoAs, in a way that 
            // is clear in the UI?
            let unit = output.first(A.REFUnitOfAssessment);
            let panel = unit ? unit.load().first(A.REFPanel) : null;
            if(panel) {
                let maxLength = 0;
                _.each(embargoes, (embargo) => {
                    if(!embargo.end) {
                        maxLength = 999999999; // Indefinite embargo period
                    } else {
                        if(embargo.getLengthInMonths() > maxLength) { maxLength = embargo.getLengthInMonths(); }
                    }
                });
                if(panel.behaviour === "hres:list:ref-panel-a" ||
                    panel.behaviour === "hres:list:ref-panel-b") {
                    return (maxLength <= 12);
                } else {
                    return (maxLength <= 24);
                }
            }
        }
    },
    "metadata": {
        label: "Record contains required metadata",
        check(output) {
            return (missingREFData(output, true).length === 0);
        }
    }
};

P.willPassOnPublication = function(output) {
    let embargoLengthOk = REFChecks.embargo.check(output);
    let hasExpectedMetadata = (missingREFData(output, false).length === 0);
    let hasBeenDepositedInTime = REFChecks.deposit.check(output);
    let isBeforeDepositDeadline = !!depositCheck(output, new Date());
    return !!(
        embargoLengthOk &&
        hasExpectedMetadata && 
        (hasBeenDepositedInTime || isBeforeDepositDeadline)
    );
};

const REF_ATTR_REQUIREMENTS = ["published", "deposited", "refunit", "author", "accepted", "aam"];
const REFAttributeLookup = {
    "accepted": [A.PublicationProcessDates, Q.Accepted],
    "author": [A.Author, undefined],
    "published": [A.PublicationDates, undefined],
    "deposited": [A.PublicationProcessDates, Q.Deposited],
    "refunit": [A.REFUnitOfAssessment, undefined],
    "aam": [A.AcceptedAuthorManuscript, undefined]
};

var missingREFData = P.missingREFData = function(output, checkFullRequirements) {
    let missData = [];
    let required = _.clone(REF_ATTR_REQUIREMENTS);
    // Check if it will pass in future, when it has been deposited and published
    if(!checkFullRequirements) {
        if(!output.labels.includes(Label.AcceptedIntoRepository)) {
            required = _.without(required, "deposited");
        }
        let status = output.first(A.OutputStatus);
        if(status && status.behaviour === "hres:list:output-status:in-press") {
            required = _.without(required, "published");
        }
    }
    _.each(required, function(r) {
        let attrQual = REFAttributeLookup[r];
        if(!output.first(attrQual[0], attrQual[1])) {
            missData.push(r);
        }
    });
    return missData;
};

var depositCheck = function(output, depositDate) {
    let accepted = output.first(A.PublicationProcessDates, Q.Accepted) ? output.first(A.PublicationProcessDates, Q.Accepted).start : null;
    let published = O.service("hres:repository:earliest_publication_date", output);
    let relevantDate;
    // From April 2018, require the use of the acceptance date for OA deposit compliance
    if(depositDate < new Date("2018-04-01")) {
        relevantDate = published || accepted;
    } else {
        relevantDate = accepted;
    }
    if(relevantDate) {
        // Deposited within 3 months of the relevant date for REF compliance
        return (new XDate(relevantDate).diffMonths(depositDate) < 3);
    }
};

