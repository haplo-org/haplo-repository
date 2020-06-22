/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var _metadataServices;
var metadataServices = P.metadataServices = function() {
    if(!_metadataServices) {
        _metadataServices = O.service("haplo:service-registry:query", [
            "hres:repository:exportable-metadata-format"
        ]);
    }
    return _metadataServices;
};

var _metadataServiceForScheme;
var metadataServiceForScheme = P.metadataServiceForScheme = function(scheme) {
    if(!_metadataServiceForScheme) {
        _metadataServiceForScheme = {};
        metadataServices().eachService((metadataService) => {
            _metadataServiceForScheme[metadataService.metadata["hres:repository:export-format"]] = metadataService;
        });
    }
    return _metadataServiceForScheme[scheme];
};

P.hook("hObjectDisplay", function(response, object) {
    if(O.service("hres:repository:is_repository_item", object)) {
        response.buttons["*EXPORTFORMATS"] = [["/do/hres-repo-export-formats/formats/"+object.ref, "Export"]];
    }
});

P.respond("GET", "/do/hres-repo-export-formats/formats", [
    {pathElement:0, as:"object"}
], function(E, object) {
    let options = [];
    metadataServices().eachService((m) => {
        options.push({
            action: "/do/hres-repo-export-formats/export/"+m.metadata["hres:repository:export-format"]+"/"+object.ref,
            label: m.metadata["hres:repository:export-format"],
            indicator: "primary"
        });
    });
    E.render({
        pageTitle: "Export: "+object.title,
        backLink: object.url(),
        options: options
    }, "std:ui:choose");
});

P.respond("GET", "/do/hres-repo-export-formats/export", [
    {pathElement:0, as:"string"},
    {pathElement:1, as:"object"}
], function(E, format, object) {
    let service = metadataServiceForScheme(format);
    E.response.body = O.service(service.name, object);
});

P.respond("GET", "/do/hres-repo-export-formats/formats-multiple", [
], function(E) {
    let options = [];
    metadataServices().eachService((m) => {
        options.push({
            action: "/do/hres-repo-export-formats/export-multiple/"+m.metadata["hres:repository:export-format"],
            label: m.metadata["hres:repository:export-format"],
            indicator: "primary"
        });
    });
    E.render({
        pageTitle: "Export outputs in tray",
        backLink: "/do/tray",
        options: options
    }, "std:ui:choose");
});

P.respond("GET", "/do/hres-repo-export-formats/export-multiple", [
    {pathElement:0, as:"string"}
], function(E, format) {
    let service = metadataServiceForScheme(format),
        objects = [];
    _.each(O.tray, objectRef => {
        if(objectRef.load().isKindOfTypeAnnotated("hres:annotation:repository-item")) {
            objects.push(objectRef.load());
        }
    });
    E.response.body = O.service(service.name+"-multiple", objects);
});

P.hook("hTrayPage", function(response) {
    let buttons = response.buttons || {};
    buttons["*EXPORT-FORMATS"] = [["/do/hres-repo-export-formats/formats-multiple", "Export outputs metadata"]];
});