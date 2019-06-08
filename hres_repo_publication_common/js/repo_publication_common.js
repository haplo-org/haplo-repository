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
    P.implementService("std:action_panel:category:hres:repository_item", function(display, builder) {
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
    P.implementService("hres:repository:common:public-url-for-object", function(object) {
        return publication.urlForObject(object);
    });

    P.implementService("hres:repository:common:public-url-hostname", function(object) {
        return publication.urlHostname;
    });

});

// --------------------------------------------------------------------------

if(!O.application.config["hres:repository:publication:prevent_keywords_inline_display"]) {
    P.hook('hPreObjectDisplayPublisher', function(response, object) {
        if(O.service("hres:repository:is_repository_item", object) && object.first(A.Keywords)) {
            var r = response.replacementObject || object.mutableCopy();
            var keywords = [];
            object.every(A.Keywords, (v,d,q) => {
                keywords.push(v.toString());
            });
            r.remove(A.Keywords);
            r.append(O.text(O.T_TEXT, keywords.join("; ")), A.Keywords);
            response.replacementObject = r;
        }
    });
}

// --------------------------------------------------------------------------

P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:search-result:default",
    "search-result/default"
);
P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:search-result:output",
    "search-result/output"
);
P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-common:search-result:person",
    "search-result/person"
);

P.webPublication.feature("hres:repository:common:search-results", function(publication) {

    publication.searchResultRendererForTypes(
        publication.DEFAULT,
        function(object, context) {
            var template = context.publication.getReplaceableTemplate("hres:repo-publication-common:search-result:default");
            return template.deferredRender({object:object});
        }
    );

    publication.searchResultRendererForTypes(
        SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'),
        function(object, context) {
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
            var template = context.publication.getReplaceableTemplate("hres:repo-publication-common:search-result:output");
            return template.deferredRender(view);
        }
    );

    publication.searchResultRendererForTypes(
        [T.Person],
        function(object, context) {
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
            var template = context.publication.getReplaceableTemplate("hres:repo-publication-common:search-result:person");
            return template.deferredRender(view);
        }
    );

});
