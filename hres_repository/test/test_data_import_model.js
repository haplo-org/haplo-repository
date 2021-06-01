// /* Haplo Research Manager                            https://haplo.org
//  * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
//  * This Source Code Form is subject to the terms of the Mozilla Public
//  * License, v. 2.0. If a copy of the MPL was not distributed with this
//  * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    let testInstructionsAndInput = function(instructions, input, fn) {
        let control = {
            "dataImportControlFileVersion": 0,
            "model": "hres:repository-item",
            "files": {
                "DEFAULT": {"read": "json"}
            },
            "instructions": [
                // Create new object
                { "action":"new", "destination":"repository-item" },
                { "action":"set-value", "destination":"repository-item", "name":"dc:attribute:title", "value":"Test repository item" },
                { "action":"set-value", "destination":"repository-item", "name":"dc:attribute:type", "value":"std:type:book" }
            ].concat(instructions)
        };
        let inputFile = O.file(O.binaryData(JSON.stringify(input)));
        let errors = [];
        let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (e,r)=>errors.push(e));
        let objects = [];
        batch.eachRecord((record) => {
            let transformation = batch.transform(record);
            if(transformation.isComplete) {
                transformation.commit();
            }
            objects.push(transformation.getTarget('repository-item'));
        });
        fn(objects, errors);
    };

    let objectsToClean = [];

    let testAuthor = O.object().
        appendType(T.Person).
        appendTitle("Test author").
        save();

    objectsToClean.push(testAuthor);
    let testCite = "Smith, J.";

    // ----------------------------------------------------------------------

    // Test citations
    testInstructionsAndInput([
        { "source":"ref", "destination":"value:hres:author-citation", "name":"ref", "filters": ["haplo:string-to-ref"] },
        { "source":"cite", "destination":"value:hres:author-citation", "name":"cite" },
        { "action":"field-structured", "structured":"value:hres:author-citation", "destination":"repository-item", "name":"hres:attribute:authors-citation" }
    ], [
        { "ref": testAuthor.ref.toString() },
        { "cite": testCite }
    ], function(objects, errors) {
        t.assertEqual(2, objects.length);
        let author0 = objects[0].first(ATTR["dc:attribute:author"]);
        // If incorrectly applied the author will be removed by hComputeAttributes
        t.assert(!!author0);
        t.assert(O.isRef(author0));
        t.assertEqual(author0.toString(), testAuthor.ref.toString());
        // As it's just a citation there's no author ref to compute but the citation should still be appended
        t.assert(!objects[1].first(ATTR["dc:attribute:author"]));
        let object1Cites = objects[1].every(ATTR["hres:attribute:authors-citation"]);
        t.assert(object1Cites.length === 1);
        t.assert(object1Cites[0].toFields().value.cite === testCite);
        objectsToClean.push(objects[0], objects[1]);
    });

    // ----------------------------------------------------------------------

    // Test PubMed if they exist
    if("hres:attribute:pubmed-id" in ATTR) {
        let testPubmedID = "888888888";
        testInstructionsAndInput([
            { "source":"id", "destination":"value:hres:pubmed-id", "name":"id" },
            { "action":"field-structured", "structured":"value:hres:pubmed-id", "destination":"repository-item", "name":"hres:attribute:pubmed-id" }
        ], [
            { "id": testPubmedID }
        ], function(objects, errors) {
            t.assertEqual(1, objects.length);
            let pubmed0 = objects[0].first(ATTR["hres:attribute:pubmed-id"]);
            t.assert(!!pubmed0);
            t.assert(O.isPluginTextValue(pubmed0, "hres_repository:output_identifier_pmid"));
            t.assertEqual(pubmed0.toString(), testPubmedID);
            objectsToClean.push(objects[0]);
        });
    }

    // ----------------------------------------------------------------------

    // Test DOIs if they exist
    if("hres:attribute:digital-object-identifier-doi" in ATTR) {
        let testDOI = "10.000/12345";
        testInstructionsAndInput([
            { "source":"id", "destination":"value:hres:doi", "name":"id" },
            { "action":"field-structured", "structured":"value:hres:doi", "destination":"repository-item", "name":"hres:attribute:digital-object-identifier-doi" }
        ], [
            { "id": testDOI }
        ], function(objects, errors) {
            t.assertEqual(1, objects.length);
            let doi0 = objects[0].first(ATTR["hres:attribute:digital-object-identifier-doi"]);
            t.assert(!!doi0);
            t.assert(O.isPluginTextValue(doi0, "hres:doi"));
            t.assertEqual(doi0.toString(), "https://doi.org/"+testDOI);
            objectsToClean.push(objects[0]);
        });
    }

    // ----------------------------------------------------------------------

    testInstructionsAndInput([
        { "source":"volume", "destination":"value:hres:journal-citation", "name":"volume" },
        { "source":"number", "destination":"value:hres:journal-citation", "name":"number" },
        { "source":"pageRange", "destination":"value:hres:journal-citation", "name":"pageRange" },
        { "action":"field-structured", "structured":"value:hres:journal-citation", "destination":"repository-item", "name":"hres:attribute:journal-citation" }
    ], [
        { "volume":"189", "number":"6", "pageRange":"9-15" },
        { "volume":"189", "pageRange":"9-15" },
        { "volume":"189" }
    ], function(objects, errors) {
        t.assertEqual(3, objects.length);
        let citation = objects[0].first(ATTR["hres:attribute:journal-citation"]);
        t.assert(!!citation);
        t.assert(O.isPluginTextValue(citation, "hres:journal_citation"));
        let fields = citation.toFields().value;
        t.assertEqual(fields.volume, "189");
        t.assertEqual(fields.number, "6");
        t.assertEqual(fields.pageRange, "9-15");
        objectsToClean.push(objects[0], objects[1], objects[2]);
    });

    // Cleanup created objects
    _.each(objectsToClean, (obj) => { obj.deleteObject(); });

});
