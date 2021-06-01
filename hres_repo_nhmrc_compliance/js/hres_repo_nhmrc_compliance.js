/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanManageNHMRCCompliance = P.CanManageNHMRCCompliance = O.action("hres_repo_nhmrc_compliance:action:can_manage_compliance").
    title("Can manage NHMRC Compliance").
    allow("group", Group.RepositoryEditors);

// --------------------------------------------------------------------------
// Utility functions
// --------------------------------------------------------------------------

var dateXMonthsAfterPublication = P.dateXMonthsAfterPublication = function(output, months) {
    let earliestPublicationDate = O.service("hres:repository:earliest_publication_date", output);
    if(earliestPublicationDate) {
        return new XDate(earliestPublicationDate).addMonths(months, true).clearTime();
    }
};

// In period inclusive of boundary dates, must have at least one of @from@ or @to@.
var dateInPeriod = P.dateInPeriod = function(from, date, to) {
    date = new XDate(date);
    from = from ? new XDate(from) : undefined;
    to = to ? new XDate(to) : undefined;
    if(!date.valid() || (from && !from.valid()) || (to && !to.valid())) { throw new Error("Invalid dates supplied"); }
    let inPeriod = true;
    let dateTime = date.clearTime().getTime();
    if(from) {
        inPeriod = dateTime >= from.clearTime().getTime();
    }
    // Short circuit if already out of period
    if(to && inPeriod) {
        inPeriod = dateTime <= to.clearTime().getTime();
    }
    return !!inPeriod;
};

var isInOAPolicyScope = P.isInOAPolicyScope = function(output) {
    let outputIsResearchLiterature = output.isKindOfTypeAnnotated("hres:annotation:repository:text-based-research");
    let outputIsResearchData = ("Dataset" in T && output.isKindOf(T.Dataset));
    let outputIsPatent = ("Patent" in T && output.isKindOf(T.Patent));
    return (outputIsResearchLiterature && isPublishedInNHMRCPeriod(output)) ||
        outputIsResearchData ||
        outputIsPatent;
};

// This policy applies to all publications from 1 July 2012
// except for peer‐reviewed conference papers/patents where it applies from 15 January 2018.
var isPublishedInNHMRCPeriod = P.isPublishedInNHMRCPeriod = function(output) {
    let publicationDate = O.service("hres:repository:earliest_publication_date", output);
    if(publicationDate) {
        if(output.isKindOf(T.ConferenceItem) || ("Patent" in T && output.isKindOf(T.Patent))) {
            return dateInPeriod(new Date("2018-01-15"), publicationDate);
        }
        if(output.isKindOfTypeAnnotated("hres:annotation:repository:text-based-research")) {
            return dateInPeriod(new Date("2012-07-01"), publicationDate);
        }
    }
    // There's no time period given for datasets so returning true if the output is a dataset
    return ("Dataset" in T && output.isKindOf(T.Dataset));
};

var typeToChecks = O.refdictHierarchical();
var _ensureTypeToChecks = function() {
    if(!typeToChecks.length) {
        _.each(SCHEMA.getTypesWithAnnotation("hres:annotation:repository:text-based-research"), (type) => {
            typeToChecks.set(type, P.ResearchLiteratureChecks);
        });
        if("Dataset" in T) {
            typeToChecks.set(T.Dataset, P.ResearchDataChecks);
        }
        if("Patent" in T) {
            typeToChecks.set(T.Patent, P.PatentChecks);
        }
    }
};

var passesNHMRCChecks = P.passesNHMRCChecks = function(output) {
    _ensureTypeToChecks();
    let checks = typeToChecks.get(output.firstType());
    return _.every(checks, (c) => c.check(output));
};

var willPassOnDeposit = P.willPassOnDeposit = function(output) {
    let testOutput = output.mutableCopy();
    testOutput.append(new Date(), A.PublicationProcessDates, Q.Deposited);
    return passesNHMRCChecks(testOutput);
};

// --------------------------------------------------------------------------
// Docstore
// --------------------------------------------------------------------------

var ResearchLiteratureForm = P.form("research-literature-checks", "form/research-literature-checks.json");
var ResearchDataForm = P.form("research-data-checks", "form/research-data-checks.json");
var PatentForm = P.form("patent-checks", "form/patent-checks.json");

var NHMRCManualChecks = P.NHMRCManualChecks = P.defineDocumentStore({
    name: "nhmrcManualChecks",
    keyIdType: "ref",
    keyToKeyId(key) {
        return O.isRef(key) ? key : key.ref;
    },
    formsForKey(key) {
        let output = O.isRef(key) ? key.load() : key;
        if(output.isKindOfTypeAnnotated("hres:annotation:repository:text-based-research")) {
            // Patents are annotated as outputs but NHMRC applies different restrictions
            if("Patent" in T && output.isKindOf(T.Patent)) {
                return [PatentForm];
            }
            return [ResearchLiteratureForm];
        }
        if("Dataset" in T && output.isKindOf(T.Dataset)) {
            return [ResearchDataForm];
        }
    }
});

P.respond("GET,POST", "/do/hres-repo-nhmrc-compliance/manual-checks", [
    {pathElement:0, as:"object"}
], function(E, output) {
    _ensureTypeToChecks();
    if(!typeToChecks.get(output.firstType())) { O.stop("Not permitted"); }
    CanManageNHMRCCompliance.enforce();

    let instance = NHMRCManualChecks.instance(output);
    instance.handleEditDocument(E, {
        finishEditing(instance, E, complete) {
            if(complete) {
                instance.commit();
            }
            O.service("std:reporting:update_required", "repository_items", [output.ref]);
            E.response.redirect(output.url());
        },
        render(instance, E, deferredRender) {
            E.render({
                output: output,
                deferred: deferredRender
            });
        }
    });
});

// --------------------------------------------------------------------------
// Action panels
// --------------------------------------------------------------------------

P.implementService("std:action_panel_priorities", function(priorities) {
    _.extend(priorities, {
        "hres:nhmrc-compliance:repo": 560
    });
});

var addChecksToPanel = function(output, panel) {
    _ensureTypeToChecks();
    let i = P.locale().text("template");
    let checks = typeToChecks.get(output.firstType());
    _.each(checks, (c, kind) => {
        let labelText = O.interpolateString(i["{adjective}: {label}"], {
          adjective: c.check(output) ? "Passed" : "Failed",
          label: c.label
        });
        if(c.manualCheck) {
            panel.element("default", {label: labelText});
        } else {
            panel.link("default", "/do/hres-repo-nhmrc-compliance/check/"+kind+"/"+output.ref, labelText);
        }
    });
    panel.link("bottom", "/do/hres-repo-nhmrc-compliance/manual-checks/"+output.ref, i["Update compliance form"]);
};

P.implementService("std:action_panel:output", function(display, builder) {
    if(!O.currentUser.allowed(CanManageNHMRCCompliance)) { return; }
    if(O.serviceMaybe("hres_repo_nhmrc_compliance:hide_compliance_checker_for_object", display.object)) { return; }

    let output = display.object;
    let i = P.locale().text("template");
    let label = i["Not compliant"];
    let NHMRCPolicyApplies = isInOAPolicyScope(output) && isPublishedInNHMRCPeriod(output);
    let shouldShowChecks = NHMRCPolicyApplies;
    if(NHMRCPolicyApplies) {
        if(passesNHMRCChecks(output)) {
            label = i["Compliant"];
        } else if(willPassOnDeposit(output)) {
            label = i["Output will pass when deposited"];
        } else if(!O.service("hres:repository:earliest_publication_date", output) &&
            // Patent checks have nothing to do with our stored publication dates
            // so displaying this would be misleading
            !("Patent" in T && output.isKindOf(T.Patent))) {
                label = i["Output missing publication date"];
                shouldShowChecks = false;
        }
    } else {
        label = i["Not applicable: Out of scope of NHMRC OA policy"];
    }

    let panel = builder.panel("hres:nhmrc-compliance:repo");
    panel.element(0, {title:"NHMRC OA", label:label});
    if(shouldShowChecks) {
        addChecksToPanel(output, panel);
    }
});

P.implementService("std:action_panel:research_data", function(display, builder) {
    if(!O.currentUser.allowed(CanManageNHMRCCompliance)) { return; }
    if(O.serviceMaybe("hres_repo_nhmrc_compliance:hide_compliance_checker_for_object", display.object)) { return; }

    let output = display.object;
    let i = P.locale().text("template");
    let label = i["Not compliant"];
    let NHMRCPolicyApplies = isInOAPolicyScope(output);
    let shouldShowChecks = NHMRCPolicyApplies;
    if(NHMRCPolicyApplies) {
        if(passesNHMRCChecks(output)) {
            label = i["Compliant"];
        }
    } else {
        label = i["Not applicable: Out of scope of NHMRC OA policy"];
    }

    let panel = builder.panel("hres:nhmrc-compliance:repo");
    panel.element(0, {title:"NHMRC OA", label:label});
    if(shouldShowChecks) {
        addChecksToPanel(output, panel);
    }
});

// --------------------------------------------------------------------------
// Handlers
// --------------------------------------------------------------------------

P.respond("GET", "/do/hres-repo-nhmrc-compliance/check", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"object"}
], function(E, kind, output) {
    CanManageNHMRCCompliance.enforce();
    _ensureTypeToChecks();
    let checks = typeToChecks.get(output.firstType());
    if(!checks) { O.stop("Not permitted."); }
    let check = checks[kind];
    E.render({
        output: output,
        check: check,
        checkPassed: check.check(output),
        detail: check.detailDeferredRender(output)
    }, "check-requirements");
});