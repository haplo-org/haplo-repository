/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var types = [
    "ARK", "arXiv", "bibcode", "EAN13", "EISSN", "IGSN", "ISSN",
    "ISTC", "LISSN", "LSID", "PURL", "UPC", "URN", "w3id"
];

_.each(types, function(type) {
    let displayType = type.toLowerCase();
    P["createOutputIdentifier"+displayType] = 
        P.implementTextType("hres_repository:output_identifier_"+displayType, 
            "Repository output identifier "+displayType, {
                string(value) {
                    return type + ": " + value.value;
                },
                indexable(value) {
                    return this.string(value);
                },
                render(value) {
                    return this.string(value);
                },
                $setupEditorPlugin(value) {
                }
        });
});

var outputForm = P.form("outputs", "outputs.json");
P.dataSource("outputs", "object-lookup", 
    SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item")
);

//type-placeholder mapping
var typesToPlaceholder = {
    "ARK": "ark:/12345/67abc123/example.xml",
    "arXiv": "arXiv:0001.1234",
    "bibcode": "2019GUMFA.A78T..06F",
    "DOI": "10.5555/12345678",
    "EAN13": "1234567890123",
    "EISSN": "1234-5678",
    "Handle": "20.1234/578",
    "IGSN": "IEABC0123",
    "ISBN": "0-123-45678-9",
    "ISSN": "1234-5678",
    "ISTC": "A02-2009-000004BE-A",
    "Item in this repository": "",
    "LISSN": "9876-5432",
    "LSID": "urn:lsid:example.org:example:11235",
    "PMID": "12345678",
    "PURL": "http://purl.oclc.org/foo/bar",
    "UPC": "987654321012",
    "URL": "http://www.example.org/example.html",
    "URN": "urn:example:ex:101:123456",
    "w3id": "https://w3id.org/example/foo/bar"
};

var relationshipsDisplay = SCHEMA.getAttributeInfo(A.RelatedOutput).allowedQualifiers;
relationshipsDisplay = relationshipsDisplay.sort();
var relationships = _.map(relationshipsDisplay, relationship => { 
    relationship = SCHEMA.getQualifierInfo(relationship);
    return {
        "unsafe-value": relationship.code,
        display: relationship.name
    };
});

var displayTypes = [];
_.each(typesToPlaceholder, (placeholder, type) => { 
    displayTypes.push({
        "unsafe-value": type.replace(/\s/g,""),
        display: type,
        hint: placeholder
    });
});

var createTextType = function(relatedOutput) {
    let type = relatedOutput.type,
        related;
    if(!type) { return; }
    if(_.contains(types, type)) {
        let createFunction = "createOutputIdentifier"+type.toLowerCase();
        related = P[createFunction](relatedOutput);
    } else if (type === "Iteminthisrepository") {
        related = O.ref(relatedOutput.value);
    } else if (type === "URL") {
        related = O.text(O.T_IDENTIFIER_URL, relatedOutput.value);
    } else if (type === "ISBN") {
        related = O.text(O.T_IDENTIFIER_ISBN, relatedOutput.value);
    } else { 
        related = P[type].create(relatedOutput.value);
    }
    return related;
};


var canAddRelatedOutput = function(user, output) {
    let object = output.load();
    if(!object || !object.isKindOfTypeAnnotated("hres:annotation:repository-item")) { return false; }
    return user.canUpdate(output) || user.canCreateObjectOfType(output);
};


P.respond("GET", "/do/hres-related-output-value/submit", [
    { pathElement: 0, as:"ref"}
], function(E, output) {
    if(!canAddRelatedOutput(O.currentUser, output)) { O.stop("Not permitted"); }
    let params = E.request.parameters;
    let relatedOutput = {
        type: params.type,
        placeholder: typesToPlaceholder[params.type],
        value: params.output ? params.output : params.value
    };
    let related = createTextType(relatedOutput);
    let blank = O.object();
    //Use any type, irrelevant but required for functionality
    blank.appendType(T.Book);
    if(related) { blank.append(related, A.RelatedOutput, QUAL[params.relationship]); }

    let encoding = O.editor.encode(blank);
    E.render({
        output: encoding
    }, "saving-attributes");
});

P.respond("GET", "/do/hres-related-output-value/get-values", [
    { pathElement: 0, as:"ref"}
], function(E, output) {
    if(!canAddRelatedOutput(O.currentUser, output)) { O.stop("Not permitted"); }
    E.render({
        relationships: relationships,
        types: displayTypes,
        outputForm: outputForm.instance().deferredRenderForm(),
        outputRef: output
    }, "get-values");
});

P.hook("hPreObjectEdit", function(response, object) {
    if(object.isKindOfTypeAnnotated("hres:annotation:repository-item")) {
        P.template("include_related_output_plugin").render();

        //Hack to include clientside for attributes not included in output normally
        hres_handle_identifier.template("include_editor_plugin").render();
        hres_repo_pubmed.template("include_editor_plugin").render();
    }
});

P.hook('hObjectEditor', function(response, object) {
    if(O.service("hres:repository:is_repository_item", object)) {
        // TODO: remove this workaround
        // Use type as fallback to get around new objects not having refs
        let ref = object.ref || object.firstType();
        response.plugins.hres_repo_related_output = {
            relatedOutput: A.RelatedOutput,
            objectRef: ref.toString()
        };
        this.template("include_related_output_plugin").render();
    }
});
