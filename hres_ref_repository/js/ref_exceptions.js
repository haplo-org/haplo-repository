/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var EXCEPTIONS = P.EXCEPTIONS = {
    "access-a": {
        title: "Third party content",
        details: "The output depends on the reproduction of third party content for which open access rights could not be granted (either within the specified timescales, or at all).",
        evidence: "Where it is not obvious that the output depends on third-party material, a descriptive explanation of the exact difficulties encountered will be required."
    },
    "access-b": {
        title: "Publication embargo length",
        details: "The publication concerned requires an embargo period that exceeds the stated maxima, and was the most appropriate publication for the output.",
        evidence: "Institutions to show that a process was in place to allow the author or the institution to examine and consider the range of venues that allowed deposit within the rules.",
        indicator: "primary"
    },
    "access-c": {
        title: "Publication disallows OA deposits",
        details: "The publication concerned actively disallows open-access deposit in a repository, and was the most appropriate publication for the output.",
        evidence: "Institutions to show that a process was in place to allow the author or the institution to examine and consider the range of venues that allowed deposit within the rules.",
        indicator: "primary"
    },
    "deposit-a": {
        title: "No repository available",
        details: "The individual whose output is being submitted to the REF was unable to secure the use of a repository at the point of acceptance.",
        evidence: "Descriptive explanation of the situation, including of any difficulties encountered. Can include equality and diversity issues or difficulties arising from complex staff circumstances. Minimal information will be sought; data retention must respect individual’s privacy foremost."
    },
    "deposit-b": {
        title: "Delay in securing peer-reviewed text",
        details: "The individual whose output is being submitted to the REF experienced a delay in securing the final peer-reviewed text (for instance, where a paper has multiple authors).",
        evidence: "Descriptive explanation of the situation, including of any difficulties encountered. Can include equality and diversity issues or difficulties arising from complex staff circumstances. Minimal information will be sought; data retention must respect individual’s privacy foremost."
    },
    "deposit-c": {
        title: "Not at an HEI at acceptance",
        details: "The individual whose output is being submitted to the REF was not employed by a UK HEI at the time of submission for publication.",
        evidence: "Evidence of date of submission of article if available (this might include ‘submitted date’ as sometimes given on published version), and evidence that individual was not employed by submitting HEI at that point (as would be satisfied in a similar manner to audit for ‘Staff’ element of REF 2014 submission)."
    },        
    "deposit-d": {
        title: "Unlawful",
        details: "It would be unlawful to deposit, or request the deposit of, the output.",
        evidence: "Reasonable and descriptive explanation of difficulties encountered (where lawful to collect and record)."
    },
    "deposit-e": {
        title: "Security",
        details: "Depositing the output would present a security risk.",
        evidence: "Reasonable and descriptive explanation of difficulties encountered (where safe to collect and record)."
    },
    "deposit-f": {
        title: "Gold OA",
        details: "The output was published as ‘gold’ open access (for example, RCUK-funded projects where an open access article processing charge has been paid).",
        evidence: "None.",
        indicator: "primary"
    },
    "technical-a": {
        title: "Ouput outside definition",
        details: "Output is a conference proceeding, but not within definition (i.e., it does not have an ISSN, or the proceedings are published as part of book series).",
        evidence: "None.",
        indicator: "primary"
    },
    "technical-b": {
        title: "Submitted through other HEI",
        details: "At the point of acceptance, the individual whose output is being submitted to the REF was at a different UK HEI which failed to comply with the criteria.",
        evidence: "Evidence researcher was not employed by submitting HEI at the point of acceptance, if available. This might include ‘acceptance date’ as sometimes given on published version. This would be handled in a similar manner to audit for ‘Staff’ element of REF 2014 submission."
    },
    "technical-c": {
        title: "Internal technical failure",
        details: "The repository experienced a short-term or transient technical failure that prevented compliance with the criteria (this should not apply to systemic issues).",
        evidence: "Reasonable and descriptive explanation of technical failure."
    },
    "technical-d": {
        title: "External technical failure",
        details: "An external service provider failure prevented compliance (for instance, a subject repository did not enable open access at the end of the embargo period, or a subject repository ceased to operate).",
        evidence: "Reasonable and descriptive explanation of technical failure."
    },
    "other": {
        title: "Other exception",
        details: "Free text field.",
        evidence: "Evidence of difficulties encountered."
    }
};

P.respond("GET", "/do/hres-ref-repo/choose-exception", [
    {pathElement:0, as:"object"}
], function(E, output) {
    P.CanManageREF.enforce();
    
    var existing = P.getREFException(output);
    
    var makeChoices = function(category) {
        var keys = _.filter(_.keys(EXCEPTIONS), function(key) {
            return (key.indexOf(category) !== -1);
        });
        return P.template("std:ui:choose").render({
            options: _.map(keys, function(exception) {
                var spec = EXCEPTIONS[exception];
                return {
                    action: "/do/hres-ref-repo/exception-evidence/"+exception+"/"+output.ref,
                    label: spec.title,
                    indicator: spec.indicator || "default",
                    notes: spec.details,
                    highlight: !!(existing && (existing.exception === exception))
                };
            })
        });
    };
    
    var sidebarElements = [];
    if(existing) {
        sidebarElements.push({
            href: "/do/hres-ref-repo/delete-exception/"+output.ref,
            label: "Delete registered exception"
        });
    }

    var publishTransitionUrl = O.serviceMaybe("hres_ref_repository:get_publish_url", output);
    if(publishTransitionUrl) {
        sidebarElements.push({
            href:publishTransitionUrl,
            label:"Bypass REF exception registration",
            indicator:"terminal"
        });
    }
    E.renderIntoSidebar({
        elements: sidebarElements
    }, "std:ui:panel");
    E.render({
        output: output,
        choices: {
            "unsafeAccess": makeChoices("access"),
            "unsafeDeposit": makeChoices("deposit"),
            "unsafeTechnical": makeChoices("technical"),
            "unsafeOther": makeChoices("other")
        }
    });
});

var evidenceForm = P.form('evidence', 'form/evidence.json');

P.respond("GET,POST", "/do/hres-ref-repo/exception-evidence", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"object"}
], function(E, exception, output) {
    P.CanManageREF.enforce();
    if(!(exception in EXCEPTIONS)) { O.stop("Unknown exception type."); }
    
    var row = P.getREFException(output);
    var document = {};
    if(row && row.evidence) {
        document.evidence = row.evidence;
    }
    var form = evidenceForm.handle(document, E.request);
    
    if(E.request.method === "POST") {
        // Plugin nullable columns don't convert from undefined
        var evidence = document.evidence || null;
        if(row) {
            row.exception = exception;
            row.evidence = evidence;
            row.save();
        } else {
            P.db.exceptions.create({
                output: output.ref,
                exception: exception,
                evidence: evidence
            }).save();
        }

        var rdr = O.serviceMaybe("hres_ref_repository:get_publish_url", output);
        if(!rdr) {
            rdr = output.url();
        }
        E.response.redirect(rdr);
    }

    E.render({
        backLink: "/do/hres-ref-repo/choose-exception/"+output.ref,
        form: form,
        exception: EXCEPTIONS[exception]
    });
});

P.respond("GET,POST", "/do/hres-ref-repo/delete-exception", [
    {pathElement: 0, as:"object"}
], function(E, output) {
    P.CanManageREF.enforce();
    
    if(E.request.method === "POST") {
        var row = P.getREFException(output);
        if(!row) { O.stop("No registered exception to delete."); }
        row.deleteObject();
        E.response.redirect(output.url());
    }
    E.render({
        pageTitle: "Delete registered REF exception",
        backLink: "/do/hres-ref-repo/choose-exception/"+output.ref,
        text: "Remove the REF exception information registered for this output.",
        options:[{label:"Delete"}]
    }, "std:ui:confirm");
});

P.implementService("hres:repository:set_exception", function(row) {
    if(row.output && row.exception) {
        P.db.exceptions.create(row).save();
    }
});