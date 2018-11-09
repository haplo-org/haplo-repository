/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Is the ORCID attribute defined? If so, enable ORCID display.
const USING_ORCID = ("ORCID" in A) && O.featureImplemented("hres:orcid");
if(USING_ORCID) { P.use("hres:orcid"); }


P.webPublication.feature("hres:repository:common:platform-integration", function(publication) {

    // Display link to items in the public repository
    P.implementService("std:action_panel:repository_item", function(display, builder) {
        var labels = display.object.labels;
        if(labels.includes(Label.AcceptedIntoRepository)) {
            var url = publication.urlForObject(display.object);
            if(url) {
                builder.panel('top').
                    element('top', {title:"Repository"}).
                    link("default", url, "View in public repository");
            }
        }
    });

    // Use public URLs when registering DOIs
    P.implementService("hres:doi:minting:public-url-for-object", function(object) {
        return publication.urlForObject(object);
    });

});

// --------------------------------------------------------------------------

P.webPublication.feature("hres:repository:common:search-results", function(publication) {

    publication.searchResultRendererForTypes(
        publication.DEFAULT,
        function(object) {
            return P.template("search-result/default").deferredRender({object:object});
        }
    );

    publication.searchResultRendererForTypes(
        SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'),
        function(object) {
            var view = {
                object: object,
                typeInfo: SCHEMA.getTypeInfo(object.firstType()),
                citation: O.service("hres_bibliographic_reference:for_object", object)
            };
            // Find a file for display
            var file;
            var restricted = object.restrictedCopy(O.currentUser);
            restricted.every((v,d,q) => {
                if(!file && O.typecode(v) === O.T_IDENTIFIER_FILE) {
                    file = v;
                }
            });
            if(file) {
                view.file = file;
            }
            return P.template("search-result/output").deferredRender(view);
        }
    );

    publication.searchResultRendererForTypes(
        [T.Person],
        function(object) {
            var view = {
                object: P.webPublication.widget.object(object),
                researchInstitute: object.first(A.ResearchInstitute),
                jobTitle: object.first(A.JobTitle)
            };
            if(USING_ORCID) {
                var orcid = object.first(A.ORCID);
                if(orcid) {
                    view.orcid = P.ORCID.asString(orcid);
                }
            }
            return P.template("search-result/person").deferredRender(view);
        }
    );

});

// --------------------------------------------------------------------------

P.webPublication.feature("hres:repository:common:list-by-year", function(publication) {


    publication.respondToExactPath("/year",
        function(E, context) {
            E.setResponsiblePlugin(P);
            var lastYear = (new Date()).getFullYear() + 1;
            var firstYear = lastYear - 20;
            if("hres:repository:browse-by-year:first" in O.application.config) {
                firstYear = O.application.config["hres:repository:browse-by-year:first"];
            } else {
                var q = O.query().
                    link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), A.Type).
                    sortByDateAscending().
                    limit(1).
                    execute();
                if(q.length) {
                    var firstObject = q[0];
                    var firstDate = firstObject.first(A.Date);
                    var d = firstDate ? firstDate.start : firstObject.creationDate;
                    firstYear = d.getFullYear() + 1;
                }
                if(firstYear < 1800) {
                    firstYear = 1800;
                }
                if(firstYear > lastYear) {
                    firstYear = lastYear - 10;
                }
            }
            var years = [];
            for(var y = lastYear; y >= firstYear; --y) {
                years.push(y);
            }
            E.render({
                years: years
            }, "pages/year-links");
        }
    );

    publication.respondToDirectory("/year",
        function(E, context) {
            E.setResponsiblePlugin(P);
            var year = parseInt(E.request.extraPathElements[0],10);
            var items = O.query().
                link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), A.Type).
                dateRange(new Date(year, 0, 1), new Date(year+1, 0, 1), A.Date).
                sortByDateAscending().
                execute();
            E.render({
                year: year,
                items: items
            }, "pages/year-list");
        }
    );

});

// --------------------------------------------------------------------------

// Read the schema to work out which attributes should be displayed for this type
var fileAttributesForType = O.refdict(function(type) {
    var typeInfo = SCHEMA.getTypeInfo(type);
    if(!typeInfo) { return []; }
    var fileAttrs = [];
    var finalElement;
    _.each(typeInfo.attributes, function(desc) {
        var attrInfo = SCHEMA.getAttributeInfo(desc);
        if(attrInfo && (attrInfo.typecode === O.T_IDENTIFIER_FILE)) {
            var info = {
                desc: desc,
                printableName: (attrInfo.code === "std:attribute:file") ? "All other files" : attrInfo.name
            };
            // Generic files go at the bottom of the list (added outside loop)
            if(attrInfo.code === "std:attribute:file") {
                info.printableNameOnlyFileAttribute = "Attached files";
                finalElement = info;
            } else {
                fileAttrs.push(info);
            }
        }
    });
    if(finalElement) { fileAttrs.push(finalElement); }
    return {
        descs: _.map(fileAttrs, function(i) { return i.desc; }),
        info: fileAttrs
    };
});

P.webPublication.pagePart({
    name: "hres:repository:common:file-restrictions",
    category: "hres:repository:output:sidebar",
    sort: 400,
    deferredRender: function(E, context, options) {
        var fileAttrs = fileAttributesForType.get(context.object.firstType());
        var restrictedFiles = [];
        var numberAttrsUsed = 0;
        // TODO: Combine if there is a "whole object" restriction
        _.each(fileAttrs.info, function(i) {
            // Return if no file in the unrestricted object to omit confusing rendering
            if(O.withoutPermissionEnforcement(() => !context.object.first(i.desc))) { return; }
            numberAttrsUsed++;
            var applicableDeferredRenders = [];
            O.serviceMaybe("hres_repo_publication_common:collect_renders_for_restricted_desc",
                context.object, i.desc, applicableDeferredRenders);
            if(applicableDeferredRenders.length) {
                restrictedFiles.push({
                    info: i,
                    display: _.sortBy(applicableDeferredRenders, 'sort')[0].deferredRender
                });
            }
        });
        if(restrictedFiles.length) {
            restrictedFiles[0].first = true;
            restrictedFiles[0].only = (numberAttrsUsed === 1);
            return P.template("restricted-files").deferredRender({ files: restrictedFiles });
        }
    }
});

