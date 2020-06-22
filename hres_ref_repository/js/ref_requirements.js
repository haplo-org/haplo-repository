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
        },
        detailDeferredRender(output) {
            let ffd = P.getFirstFileDeposit(output);
            let displayObject = O.object();
            let displayAttrs = [A.Type, A.Title, A.PublicationDates, A.PublicationProcessDates, A.File];
            _.each(displayAttrs, (desc) => {
                output.every(desc, (v,d,q,x) => displayObject.append(v,d,q,x) );
            });
            return P.template("check-deposit-detail").deferredRender({
                fileDeposit: ffd ? ffd.date : null,
                version: ffd ?  SCHEMA.getAttributeInfo(ATTR[ffd.fileVersion]).name : null,
                displayObject: displayObject
            });
        }
    },
    "embargo": {
        label: "Embargo within allowed length",
        check(output) {
            let maxLength = getLongestEmbargoLength(output);
            if(!maxLength) { return true; }
            // TODO: How to handle if the outout has multiple possible UoAs, in a way that 
            // is clear in the UI?
            let unit = output.first(A.REFUnitOfAssessment);
            let panel = unit ? unit.load().first(A.REFPanel) : null;
            if(panel) {
                if(panel.behaviour === "hres:list:ref-panel-a" ||
                    panel.behaviour === "hres:list:ref-panel-b") {
                    return (maxLength <= 12);
                } else {
                    return (maxLength <= 24);
                }
            }
        },
        detailDeferredRender(output) {
            let maxLength = getLongestEmbargoLength(output);
            let displayObject = O.object();
            _.each([A.Type, A.Title, A.REFUnitOfAssessment], (desc) => {
                output.every(desc, (v,d,q) => displayObject.append(v,d,q));
            });
            let unit = output.first(A.REFUnitOfAssessment);
            return P.template("check-embargo-detail").deferredRender({
                maxLength: (maxLength === INDEFINITE_EMBARGO_LENGTH) ? "Indefinite" : maxLength,
                panel: unit ? unit.load().first(A.REFPanel) : null,
                displayObject: displayObject
            });
        },
    },
    "metadata": {
        label: "Record contains required metadata",
        check(output) {
            return (missingREFData(output, true).length === 0);
        },
        detailDeferredRender(output) {
            let view = {};
            _.each(REFAttributeLookup, (fn, name) => {
                let data = {
                    value: fn(output),
                };
                if(name === "deposited") {
                    data.expected = output.labels.includes(Label.AcceptedIntoRepository);
                } else if(name === "published") {
                    let status = output.first(A.OutputStatus);
                    data.expected = !(status && status.behaviour === "hres:list:output-status:in-press");
                } else if(name === "accepted") {
                    let published = O.service("hres:repository:earliest_publication_date", output);
                    data.expected = published >= new Date("2018-04-01");
                }
                view[name] = data;
            });
            return P.template("check-metadata-detail").deferredRender(view);
        }
    }
};

var INDEFINITE_EMBARGO_LENGTH = 999999999;
var getLongestEmbargoLength = function(output) {
    let embargoes = O.serviceMaybe("hres_repo_embargoes:get_embargo", output);
    if(!embargoes) { return 0; }
    let maxLength = 0;
    _.each(embargoes, (embargo) => {
        if(!embargo.end) {
            maxLength = INDEFINITE_EMBARGO_LENGTH;
        } else {
            if(embargo.getLengthInMonths() > maxLength) { maxLength = embargo.getLengthInMonths(); }
        }
    });
    return maxLength;
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

var REF_ATTR_REQUIREMENTS = {
    "published": "Publication date",
    "deposited": "Deposited date",
    "refunit": "UoA",
    "author": "Author",
    "accepted": "Accepted date",
    "aam": "Accepted manuscript"
};
var REFAttributeLookup = {
    accepted(object) { return object.first(A.PublicationProcessDates, Q.Accepted); },
    author(object) { return object.first(A.Author); },
    published(object) { return object.first(A.PublicationDates); },
    deposited(object) { return object.first(A.PublicationProcessDates, Q.Deposited); },
    refunit(object) { return object.first(A.REFUnitOfAssessment); },
    aam(object) {
        let groups = object.getAttributeGroupIds(A.AcceptedAuthorManuscript).
            concat(object.getAttributeGroupIds(A.PublishersVersion));
        let foundFile;
        _.each(groups, (group) => {
            if(!foundFile) {
                foundFile = object.extractSingleAttributeGroup(group).first(A.File);
            }
        });
        return foundFile;
    }
};

var missingREFData = function(output, checkFullRequirements) {
    let missData = [];
    let required = _.clone(_.keys(REF_ATTR_REQUIREMENTS));
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
    let published = O.service("hres:repository:earliest_publication_date", output);
    if(published < new Date("2018-04-01")) {
        required = _.without(required, "accepted");
    }
    _.each(required, function(r) {
        let fn = REFAttributeLookup[r];
        if(!fn(output)) {
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


// --------------------------------------------------------------------------
// Admin detail pages

P.respond("GET", "/do/hres-ref-repo/check/detail", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"object"}
], function(E, kind, output) {
    P.CanManageREF.enforce();
    let check = REFChecks[kind];
    E.render({
        pageTitle: (check.check(output) ? "Passed: " : "Failed: ")+check.label,
        backLink: output.url(),
        detail: check.detailDeferredRender(output)
    }, "check-requirements");
});

// --------------------------------------------------------------------------
// Metadata checks reporting
// --------------------------------------------------------------------------

P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    _.each(REF_ATTR_REQUIREMENTS, (title, requirement) => {
        collection.fact("refMetadataReq"+requirement,   "boolean",  title);
    });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    _.each(REFAttributeLookup, (fn, requirement) => {
        row["refMetadataReq"+requirement] = !!fn(object);
    });
});

P.implementService("std:action_panel:activity:menu:repository", function(display, builder) {
    if(O.currentUser.allowed(P.CanManageREF)) {
        builder.panel(550).
            link(350, "/do/hres-ref-repo/metadata-detail-checks", "Items failing REF OA metadata checks");
    }
});

P.implementService("std:reporting:dashboard:ref_metadata_detail:setup_export", function(dashboard) {
    dashboard.columns(50, [
        "department",
        "faculty",
        "refUnitOfAssessment"
    ]);
});

P.respond("GET,POST", "/do/hres-ref-repo/metadata-detail-checks", [
], function(E) {
    P.CanManageREF.enforce();
    let dashboard = P.reporting.dashboard(E, {
        name: "ref_metadata_detail",
        kind: "list",
        collection: "repository_items",
        title: "Items failing REF metadata checks"
    }).
        filter((select) => {
            select.where("refPublishedInOAPeriod", "=", true).
                where("oaIsConfItemOrArticle", "=", true).
                where("refMetadataCheck", "=", false).
                or((sq) => {
                    sq.where("oaIsGoldOA", "=", false).
                        where("oaIsGoldOA", "=", null);
                });
        }).
        use("std:row_text_filter", {facts:["title","author"], placeholder:"Search"}).
        summaryStatistic(0, "count").
        columns(10, [
            {type:"linked", style:"wide", column:{fact:"title"}},
            "author"
        ]);
    _.each(REF_ATTR_REQUIREMENTS, (title, requirement) => {
        dashboard.columns(100, ["refMetadataReq"+requirement]);
    });
    dashboard.
        columns(150, [
            "refWillPassOnPublication"
        ]).
        respond();
});
