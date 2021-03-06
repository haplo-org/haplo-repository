/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanManageREF = P.CanManageREF = O.action("hres_ref_repository:manage_ref").
    title("Can managed REF").
    allow("group", Group.RepositoryEditors).
    allow("group", Group.REFManagers).
    allow("role", "Unit of Assessment Lead").
    allow("role", "Head");

P.db.table("exceptions", {
    output: {type: "ref"},
    exception: {type: "text"},
    evidence: {type: "text", nullable: true}
});

// DEPRECATED: new code should use the table in hres_repo_open_access. __This table has not been migrated__
// Not migrated for historical compatibility and as the table in hres_repo_open_access was added close to REF2021
P.db.table("firstFileDeposit", {
    output: {type: "ref"},
    date: {type: "date"},
    fileVersion: {type: "text"}
});

P.db.table("firstOpenAccess", {
    output: {type: "ref"},
    date: {type: "date"}
});

var getFirstFileDeposit = P.getFirstFileDeposit = function(output) {
    let q = P.db.firstFileDeposit.select().where("output", "=", output.ref);
    if(q.length) {
        return q[0];
    }
};

P.implementService("hres_ref_repository:get_first_file_deposit", getFirstFileDeposit);

P.implementService("hres_ref_repository:set_first_file_deposit", function(row) {
    if(row.output && row.date && row.fileVersion) {
        P.db.firstFileDeposit.create(row).save();
    }
});

var getFirstOpenAccess = P.getFirstOpenAccess = function(output) {
    let q = P.db.firstOpenAccess.select().where("output", "=", output.ref);
    if(q.length) {
        return q[0];
    }
};

P.implementService("hres_ref_repository:get_first_open_access", getFirstOpenAccess);

P.implementService("hres_ref_repository:set_first_open_access", function(row) {
    if(row.output && row.date) {
        P.db.firstOpenAccess.create(row).save();
    }
});

P.hook("hPostObjectChange", function(response, object, operation, previous) {
    if(!O.service("hres:repository:is_repository_item", object)) { return; }
    
    // Does it already have a compliant file deposit?
    if(!getFirstFileDeposit(object)) {
        // Note: Order significant. The publisher's version of an output is considered to be
        // "more authoritative", so use that if present, but fall back to the Author's Manuscript if available
        let desc;
        [A.PublishersVersion, A.AcceptedAuthorManuscript].forEach((d) => {
            if(!desc && object.getAttributeGroupIds(d).length) {
                desc = d;
            }
        });
        if(desc) {
            P.db.firstFileDeposit.create({
                output: object.ref,
                date: new Date(),
                fileVersion: SCHEMA.getAttributeInfo(desc).code
            }).save();
        }
    }
});

var getREFException = P.getREFException = function(output) {
    let q = P.db.exceptions.select().where("output", "=", output.ref);
    if(q.length) {
        return q[0];
    } 
};

P.implementService("hres_ref_repository:get_exception", function(object) {
    let exception = getREFException(object);
    if(exception) {
        return {
            kind: exception.exception,
            title:  P.EXCEPTIONS[exception.exception].title,
            evidence: exception.evidence
        };
    }
});

// -----------------------------------------------------------

var isConfItemOrJournalArticle = P.isConfItemOrJournalArticle = function(output) {
    var conferenceISSN;
    if(output.isKindOf(T.ConferenceItem)) {
        conferenceISSN = output.first(A.ISSN);
    }
    return !!(output.isKindOf(T.JournalArticle) || conferenceISSN);
};

var isGoldOA = P.isGoldOA = function(output) {
    return !!O.service("hres:repository:open_access:is_gold_oa", output);
};

var isPublishedInREFOAPeriod = P.isPublishedInREFOAPeriod = function(object) {
    let accepted = object.first(A.PublicationProcessDates, Q.Accepted);
    // From http://www.hefce.ac.uk/pubs/year/2016/201635/
    // HEFCE Open Access REF compliance rules 
    // "apply to journal articles and conference proceedings accepted for publication after 1 April 2016"
    let oaCutoffDate =  accepted ? accepted.start : O.service("hres:repository:earliest_publication_date", object);
    return !!(oaCutoffDate && oaCutoffDate > new XDate("2016-04-01").toDate());
};

var isPublishedInREFPeriod = P.isPublishedInREFPeriod = function(output) {
    let published = O.service("hres:repository:earliest_publication_date", output);
    let accepted = output.first(A.PublicationProcessDates, Q.Accepted) ? output.first(A.PublicationProcessDates, Q.Accepted).start : null;
    let printDate;
    if(output.isKindOf(T.JournalArticle) && output.first(A.PublicationDates, Q.Print)) {
        printDate = output.first(A.PublicationDates, Q.Print).start;
    }
    // refCutoffDate for articles is when they were printed (UoA lead responsibility for further checks)
    let refCutoffDate = printDate || published || accepted;
    // Items that are eligable for submission to the next REF are those publised after the 1 January 2014
    return !!(refCutoffDate && refCutoffDate >= new XDate("2014-01-01").toDate());
};

P.implementService("hres_ref_repository:is_published_in_ref_period", output => { return isPublishedInREFPeriod(output); });

var passesREFOAChecks = P.passesREFOAChecks = function(output) {
    return _.every(P.REFChecks, (c) => c.check(output));
};

// ----------------------------------------------------------

P.implementService("std:action_panel_priorities", function(priorities) {
    _.extend(priorities, {
        "hres:ref:repo": 550
    });
});

P.implementService("std:action_panel:output", function(display, builder) {
    if(O.currentUser.allowed(CanManageREF)) {
        let output = display.object;
        let panel = builder.panel("hres:ref:repo");
        let label = "Not applicable: Out of scope of REF OA policy";    // Default, may be changed below
        let nonCompliant = false;
        let REFOAPolicyApplies = (isPublishedInREFOAPeriod(output) && isConfItemOrJournalArticle(output));
        let exception = getREFException(output);
        if(exception) {
            label = "REF exception registered";
        } else if(REFOAPolicyApplies) {
            if(passesREFOAChecks(output) || isGoldOA(output)) {
                label = "Compliant";
            } else if(P.willPassOnPublication(output)) {
                label = "Will pass on publication";
            } else {
                label = "Not compliant, exception needed";
                nonCompliant = true;
            }
        }
        panel.element(0, {title:"REF OA", label:label});

        if(exception) {
            panel.element(5, {label: "Exception: "+P.EXCEPTIONS[exception.exception].title});
        }
        if(exception || nonCompliant) {
            panel.link(10, "/do/hres-ref-repo/choose-exception/"+output.ref, (exception ? "Edit" : "Add")+" REF exception");
        }
        if(isGoldOA(output)) {
            panel.element("default", {label:"Gold Open Access"});
        } else if(REFOAPolicyApplies) {
            _.each(P.REFChecks, (c, kind) => {
                panel.link("default", "/do/hres-ref-repo/check/detail/"+kind+"/"+output.ref,
                    (c.check(output) ? "Passed: " : "Failed: ")+c.label);
            });
        }
    }
});
