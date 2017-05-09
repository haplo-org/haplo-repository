/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var REFChecks = P.REFChecks = {
    "embargo": {
        label: "Embargo within allowed length",
        check: function(output) {
            var embargo = O.serviceMaybe("hres_repo_embargoes:get_embargo", output);
            var unit = output.first(A.REFUnitOfAssessment);
            var panel = unit ? unit.load().first(A.REFPanel) : null;
            if(embargo) {
                if(panel) {
                    if(panel.behaviour === "hres:list:ref-panel-a" ||
                        panel.behaviour === "hres:list:ref-panel-b") {
                        return (embargo.embargoLength <= 12);
                    } else {
                        return (embargo.embargoLength <= 24);
                    }
                }
            } else {
                return true;
            }
        }
    },
    "deposit": {
        label: "Manuscript deposited in time",
        check: function(output) {
            var ffd = P.getFirstFileDeposit(output);
            // Outputs from other HEIs should be registered as an exception. If it is necessary to do
            // an import the data should be loaded into the ffd database
            if(ffd) {
                return depositCheck(output, ffd.date);
            }
        }
    },
    "metadata": {
        label: "Record contains required metadata",
        check: function(output) {
            // Passes if, for all of the outer arrays, any of the d,q pairs in the inner arrays are found
            // ie. a "PublishedOnline" date OR a PublishedPrint date is fine, but you have to have an author
            var pass = true;
            _.each([
                [[A.PublicationProcessDates, Q.Accepted]],
                [
                    [A.PublicationDates, Q.Online],
                    [A.PublicationDates, Q.Print]
                ],
                [[A.REFUnitOfAssessment, undefined]],
                [[A.Author, undefined]],
                [
                    [A.AcceptedAuthorManuscript, undefined],
                    [A.PublishersVersion, undefined ]
                ]
            ], function(requirement) {
                var innerPass = false;
                _.each(requirement, function(dq) {
                    if(!!output.first(dq[0], dq[1])) {
                        innerPass = true;
                    }
                });
                if(!innerPass) { pass = false; }
            });
            return pass;
        }
    }
};

var getEarliestPublicationDate = P.getEarliestPublicationDate = function(output) {
    var published;
    _.each([Q.Online, Q.Print], function(qual) {
        var p = output.first(A.PublicationDates, qual);
        if(p && (!published || (p.start < published.start))) {
            published = p;
        }
    });
    return published;
};

var depositCheck = function(output, depositDate) {
    var relevantDate;
    var published = getEarliestPublicationDate(output);
    // TODO: This date has been pushed bak twice - check near the time
    // From April 2018, use the accepted date
    if((depositDate < new Date("2018-04-01")) && published) {
        relevantDate = published.start;
    } else {
        var accepted = output.first(A.PublicationProcessDates, Q.Accepted);
        relevantDate = accepted ? accepted.start : undefined;
    }
    if(!relevantDate) { return; }
    var r = new XDate(relevantDate);
    // Deposited within 3 months of the relevant date for REF compliance
    return (r.diffMonths(depositDate) < 3);
};

P.willPassOnDeposit = function(output) {
    var passing = false;
    if(P.isREFSubmissible(output)) {
        passing = true;
    } else if(REFChecks.embargo.check(output) &&
        REFChecks.metadata.check(output) &&
        !REFChecks.deposit.check(output)) {
        passing = depositCheck(output, new Date());
    }
    return passing;
};
