/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var CanViewRIOXX = O.action("hres_repo_rioxx:view_compliance_panel").
    title("View RIOXX compliance").
    allow("group", Group.RepositoryEditors);

var RIOXX_MANDATORY_FIELDS = {
    "license": {
        check: function(object) {
            var l = object.first(A.License);
            if(l && O.isRef(l)) {
                return !!l.load().first(A.WebAddressUrl);
            }
        },
        title: "License",
        passIfAnyExists: [[A.License]]
    },
    "identifier": {
        // Identifier for the repository item itself - ie. FileIdentifier
        check: function(object) {
            return (!!object.first(A.File) ||
                !!object.first(A.AcceptedAuthorManuscript) ||
                !!object.first(A.PublishersVersion));
        },
        title: "Resource identifier",
        passIfAnyExists: [[A.File], [A.AcceptedAuthorManuscript], [A.PublishersVersion]]
    },
    "language": {
        // TODO: default to en-GB. options must conform to ISO 639–3.
        check: function(output) {
            return true;
        },
        title: "Language",
        passIfAnyExists: []
    },
    "source": {
        // ISSN or ISBN. Mandatory only for Journal articles, Book chapters, and conference papers
        check: function(object) {
            if(object.isKindOf(T.ConferencePaper) ||
                    object.isKindOf(T.JournalArticle) ||
                    object.isKindOf(T.BookChapter)) {
                return (!!object.first(A.ISSN) || !!object.first(A.ISBN));
            }
        },
        title: "Source",
        passIfAnyExists: [[A.ISSN], [A.ISBN]]
    }, 
    "title": {
        check: function(object) {
            return true;
        },
        title: "Title",
        passIfAnyExists: [[A.Title]]
    },
    "dateAccepted": {
        check: function(object) {
            return !!object.first(A.PublicationProcessDates, Q.Accepted);
        },
        title: "Accepted date",
        passIfAnyExists: [[A.PublicationProcessDates, Q.Accepted]]
    },
    "author": {
        check: function(object) {
            return !!object.first(A.Author);
        },
        title: "Author",
        passIfAnyExists: [[A.Author]]
    },
    "project": {
        // Required - funder ID or funder name
        check: function(object) {
            return !!object.first(A.Funder);
        },
        title: "Project funder",
        passIfAnyExists: [[A.Funder]]
    },
    "type": {
        check: function(object) {
            return true;
        },
        title: "Type",
        passIfAnyExists: [[A.Type]]
    }, 
    "version": {
        // Actual version code should be deducable from AAM and PublishedVersionOfRecord attributes
        check: function(object) {
            return (!!object.first(A.File) ||
                !!object.first(A.AcceptedAuthorManuscript) ||
                !!object.first(A.PublishersVersion));
        },
        title: "Resource version",
        passIfAnyExists: [[A.File], [A.AcceptedAuthorManuscript], [A.PublishersVersion]]
    }
};

var getMissingRequirements = function(item) {
    var missing = {};
    _.each(RIOXX_MANDATORY_FIELDS, function(requirement, name) {
        if(!requirement.check(item)) {
            missing[name] = requirement;
        }
    });
    return missing;
};

P.implementService("std:action_panel:outpu", function(display, builder) {
    if(O.currentUser.allowed(CanViewRIOXX)) {
        var missing = getMissingRequirements(display.object);
        builder.panel(120).element(0, {title: "RIOXX", label: (_.isEmpty(missing)) ? "Compliant" : "Missing mandatory metadata"});
        _.each(missing, function(requirement, key) {
            builder.panel(120).element(10, {
                label: requirement.title, href: "/do/hres-repo-rioxx/missing-metadata/"+display.object.ref+"/"+key
            });
        });
    }
});

P.respond("GET", "/do/hres-repo-rioxx/missing-metadata", [
    {pathElement:0, as:"object"},
    {pathElement:1, as:"string"}
], function(E, item, selected) {
    CanViewRIOXX.enforce();
    var missing = getMissingRequirements(item);
    var rows = [];
    _.each(missing, function(requirement, key) {
        var descriptions = _.map(requirement.passIfAnyExists, function(d) {
            var description = SCHEMA.getAttributeInfo(d[0]).name;
            if(d[1]) {
                description = description+" ("+SCHEMA.getQualifierInfo(d[1]).name+")";
            }
            return description;
        });
        rows.push({
            title: requirement.title,
            first: descriptions[0],
            subsequent: descriptions.slice(1),
            selected: (selected === key) ? "selected" : null
        });
    });
    E.renderIntoSidebar({
        elements: [{href:"/do/edit/"+item.ref, label:"Edit item", indicator:"primary"}]
    }, "std:ui:panel");
    E.render({
        item: item,
        rows: rows
    });
});
