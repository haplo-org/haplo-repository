/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:data-import-framework:setup-model:repository-item", function(model) {

    model.addDestination({
        name: "repository-item",
        title: "Repository items",
        kind: "object",
        annotatedTypes: "hres:annotation:repository-item",
        objectAttributesOverride: {
            "hres:attribute:authors-citation": {
                "type": "hres:author-citation",
                "description": "Authors citation"
            },
            "hres:attribute:contributors": {
                "type": "hres:author-citation",
                "description": "Contributor citation"
            },
            "hres:attribute:book-author": {
                "type": "hres:author-citation",
                "description": "Book author"
            },
            "hres:attribute:book-editor": {
                "type": "hres:author-citation",
                "description": "Book editor"
            },
            "hres:attribute:editors-citation": {
                "type": "hres:author-citation",
                "description": "Editor's citation"
            },
            "hres:attribute:pubmedcentral-id": {
                "type": "hres:pubmed-id",
                "description": "PubMed Central ID"
            },
            "hres:attribute:pubmed-id": {
                "type": "hres:pubmed-id",
                "description": "PubMed ID"
            },
            "hres:attribute:digital-object-identifier-doi": {
                "type": "hres:doi",
                "description": "Digital object identifier (DOI)"
            },
            "hres:attribute:journal-citation": {
                "type": "hres:journal-citation",
                "description": "Journal citation"
            }
        }
    });

    model.addDestination({
        name: "contributor",
        title: "Contributors (Authors/Editors/Contributors)",
        kind: "object",
        objectType: T.Person,
        optional: true,
        objectAttributesOverride: {
            "dc:attribute:title": {
                "type": "person-name",
                "description": "Person's name"
            },
            "hres:attribute:orcid": {
                "type": "hres:orcid-id",
                "description": "ORCID iD"
            }
        }
    });

});