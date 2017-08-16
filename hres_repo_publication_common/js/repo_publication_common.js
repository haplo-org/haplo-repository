/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.webPublication.feature("hres:repository:common:platform-integration", function(publication) {

    // Display link to items in the public repository
    P.implementService("std:action_panel:repository_item", function(display, builder) {
        var labels = display.object.labels;
        if(labels.includes(Label.AcceptedIntoRepository)) {
            var url = publication.urlForObject(display.object);
            if(url) {
                builder.panel(622).
                    element(0, {title:"Repository"}).
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
            return P.template("search-result/output").deferredRender({
                object: object,
                citation: O.service("hres_bibliographic_reference:for_object", object)
            });
        }
    );

    publication.searchResultRendererForTypes(
        [T.Person],
        function(object) {
            return P.template("search-result/person").deferredRender({
                object: P.webPublication.widget.object(object)
            });
        }
    );

});

// --------------------------------------------------------------------------

// TODO: This should use the publisher file permissions when the additional security layer is added
var _TEMP_collectApplicableRestrictions = function(object) {
    var applicableRestrictions = [];
    O.serviceMaybe("hres_repo_file_restrictions:collect_file_restrictions", O.currentUser, object, applicableRestrictions);
    return applicableRestrictions;
};

P.webPublication.pagePart({
    name: "hres:repository:common:files",
    category: "hres:repository:output:sidebar",
    sort: 400,
    deferredRender: function(E, context, options) {
        var r = _TEMP_collectApplicableRestrictions(context.object);
        if(!r.length) {
            var fileAttrs = [];
            context.object.every(function(v,d,q) {
                if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                    fileAttrs.push(d);
                }
            });
            if(fileAttrs.length) {
                return P.template("files").deferredRender({
                    object: P.webPublication.widget.object(context.object).
                        onlyAttributes(fileAttrs)
                });
            }
        }
    }
});
