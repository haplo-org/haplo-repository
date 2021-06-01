/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var TEST_RECORD = {
    "download_format":"pdf",
    "discipline_key_0":[316],
    "author_display_lname":[
        "PERSON",
        "Smith",
        "Jones"
    ],
    "context_key":"8202439",
    "download_link":"https://"+P.LEGACY_APPLICATION+"/cgi/viewcontent.cgi?article=1278&context=example",
    "site_link":"http://"+P.LEGACY_APPLICATION+"",
    "discipline_terminal_key":[404],
    "configured_field_t_source_publication":["Health Psychology Review"],
    "discipline_1":["Psychology"],
    "dc_or_paid_sw":true,
    "parent_key":"8069262",
    "doi":"10.1080/17437199.2011.587961",
    "author_display":[
        "TEST A. PERSON",
        "John Smith",
        "Sheryl A. Jones"
    ],
    "discipline":[
        "Psychology",
        "Social and Behavioral Sciences"
    ],
    "configured_field_t_issn":["1743-7199"],
    "configured_field_t_isbn":["9781317652250"],
    "parent_link":"http://"+P.LEGACY_APPLICATION+"/example",
    "publication_date":"2014-01-01T08:00:00Z",
    "author_inst":["Example University"],
    "site_key":"7861362",
    "virtual_ancestor_key":[
        "81989",
        "82034",
        "8643965",
        "8069262",
        "8069249",
        "8643891",
        "9028746",
        "7861362"
    ],
    "document_type":[
        "article",
        "Journal Article",
        "Journal Articles"
    ],
    "url":"http://"+P.LEGACY_APPLICATION+"/example/1234",
    "virtual_ancestor_link":[
        "http://digitalcommons.bepress.com",
        "http://researchnow.bepress.com",
        "http://"+P.LEGACY_APPLICATION+"",
        "http://"+P.LEGACY_APPLICATION+"/fhs",
        "http://"+P.LEGACY_APPLICATION+"/example",
        "http://"+P.LEGACY_APPLICATION+"/document_types",
        "http://"+P.LEGACY_APPLICATION+"/journal_articles",
        "http://"+P.LEGACY_APPLICATION+"/faculty"
    ],
    "ancestor_link":[
        "http://"+P.LEGACY_APPLICATION+"/example/1234",
        "http://"+P.LEGACY_APPLICATION+"/example",
        "http://"+P.LEGACY_APPLICATION+"",
        "http:/"
    ],
    "configured_field_t_editor2":["R. Smith"],
    "configured_field_t_editor1":["R. Jacobs"],
    "include_in_network":false,
    "author_userid":[123456789],
    "institution_title":"Example University",
    "configured_field_t_volnum":["8"],
    "fields_digest":"bb10f178192ab4da5596e895ccdceabd913aef2d",
    "mtime":"2020-06-04T06:36:05Z",
    "discipline_0":["Social and Behavioral Sciences"],
    "configured_field_t_issnum":["4"],
    "title":"Title of the journal article",
    "discipline_key_1":[404],
    "configured_field_t_scopus_eid":["2-s2.0-123456789"],
    "publication_key":"8069262",
    "is_digital_commons":true,
    "publication_link":"http://"+P.LEGACY_APPLICATION+"/example",
    "abstract":"<p>Some text. </p><h3 id=\"title\">title</h3><br /><p>My text has text in it. Example text.<b>BOLD TEXT <i id=\"somthing\">italics</i></b> with an <a href=\"mailto:example@"+P.LEGACY_APPLICATION+"\">example@"+P.LEGACY_APPLICATION+"</a> email link in it. Original at <a href=\"https://dx.doi.org/12345.23456\">this location</a></p><p><ul><li>Thing one</li><li>Second item</li></ul></p>",
     "ancestor_key":[
        "8202439",
        "8069262",
        "7861362",
        "1"
    ],
    "configured_field_t_grant_num":["RandomPlace.10623"],
    "configured_field_t_grant_num2":["RandomPlace.11426"],
    "configured_field_t_distribution_license": ["Example license title, like CC-BY", "http://creativecommons.org/licenses/by/3.0/"],
    "author":[
        "TEST A. PERSON",
        "John Smith",
        "Sheryl A. Jones",
        "Sheryl A. Jones Prof."
    ],
    "peer_reviewed":false,
    "exclude_from_oai":false,
    "configured_field_t_grant_purl":["<p><a href=\"http://purl.org/grants/RandomPlace/1078\">http://purl.org/grants/RandomPlace/1078</a></p><p><a href=\"http://purl.org/grants/RandomPlace/FT14010\">http://purl.org/grants/RandomPlace/FT14010</a></p>"],
    "embargo_date":"2019-01-01T00:00:01Z",
    "institution":["Example University"],
    "fulltext_url":"https://"+P.LEGACY_APPLICATION+"/context/TEST_VALID_URL",
    "publication_title":"Faculty of Science Publications",
    "configured_field_t_publisher_location": ["test, United States of America"],
    "configured_field_t_extent":["38 pages"],
    "configured_field_t_book_series":["Spirituality in the Early Church"],
    "configured_field_t_chapter_title":["Emotional intelligence in social care"],
    "configured_field_t_degree_name":["Doctor of Philosophy (PhD)","Doctor of Philosophy (PhD)"],
    "configured_field_t_source_fulltext_url":["https://"+P.LEGACY_APPLICATION+"/article/view/1234/5678"],
    "comments":"<p>This is an open access article, free of all copyright, and may be freely reproduced, distributed, transmitted, modified, built upon, or otherwise used by anyone for any lawful purpose. The work is made available under the <a href=\"https://creativecommons.org/publicdomain/zero/1.0/\" target=\"_blank\">Creative Commons CC0</a> public domain dedication.</p>"
};
var CLEANED_ABSTRACT = "Some text. \r\n\r\ntitle\r\nMy text has text in it. Example text.BOLD TEXT italics with an [mailto:example@"+P.LEGACY_APPLICATION+"] example@"+P.LEGACY_APPLICATION+" email link in it. Original at [https://dx.doi.org/12345.23456] this location\r\n\r\n- Thing one\r\n- Second item";
var CLEANED_COMMENTS = "This is an open access article, free of all copyright, and may be freely reproduced, distributed, transmitted, modified, built upon, or otherwise used by anyone for any lawful purpose. The work is made available under the [https://creativecommons.org/publicdomain/zero/1.0/] Creative Commons CC0 public domain dedication.";
var CLEANED_GRANT_PURL = "[http://purl.org/grants/RandomPlace/1078] http://purl.org/grants/RandomPlace/1078\r\n\r\n[http://purl.org/grants/RandomPlace/FT14010] http://purl.org/grants/RandomPlace/FT14010";
var PUBLISHED_DATE  = new XDate("2014-01-01").toDate();
var TEST_FILE = O.file(O.binaryData("{'TESTING':true}", {filename:"test.json", mimeType:"application/json"}));
var q = P.db.downloadedFiles.select().where("digest", "=", TEST_FILE.digest);
if(!q.count()) {
    P.db.downloadedFiles.create({
        url: "http://"+P.FILE_WEB_SERVER+"/example/1234/test.json",    // relative path of TEST_RECORD.url + filename
        digest: TEST_FILE.digest
    }).save();
}
console.log(TEST_FILE.digest);

// For testing error logging
var INVALID_RECORD = _.clone(TEST_RECORD);
INVALID_RECORD["url"] = "INVALID_RECORD_URL";
INVALID_RECORD["fulltext_url"] = "INVALID_RECORD_URL";
INVALID_RECORD["document_type"] = [
    "INVALID",
    "Journal Article",
    "Journal Articles"
];
INVALID_RECORD.configured_field_t_volnum = null;
INVALID_RECORD.configured_field_t_degree_name = ["Doctor of Philosophy (PhD)","Doctor of Philosophy (PhD)", "different value"];
// DOIs in this field are stored as the full URL
INVALID_RECORD.configured_field_t_source_fulltext_url = ["https://doi.org/"+TEST_RECORD.doi];
INVALID_RECORD.configured_field_t_grant_purl = ["\r\n"];
INVALID_RECORD.abstract = "<p><a href=\"http://purl.org/au-research/grants/NHMRC/1059454\n\">http://purl.org/au-research/grants/NHMRC/1059454\n</a></p>";

t.test(function() {

    // Setup new random data for new object creation
    const newJournalTitle = (Math.random()).toString();
    const newPublisherTitle = (Math.random()).toString();
    const newEventTitle = (Math.random()).toString();
    const newCorporateAuthorTitle1 = (Math.random()).toString();
    const newCorporateAuthorTitle2 = (Math.random()+1).toString();
    TEST_RECORD["configured_field_t_source_publication"] = [newJournalTitle];
    TEST_RECORD["configured_field_t_publisher"] = [newPublisherTitle];
    TEST_RECORD["configured_field_t_conference_name"] = [newEventTitle];
    TEST_RECORD["corporate_author"] = [newCorporateAuthorTitle1, newCorporateAuthorTitle2];
    INVALID_RECORD["configured_field_t_source_publication"] = [newJournalTitle, "Unexpected second entry"];
    const TEST_RECORD_2 = _.clone(TEST_RECORD);
    TEST_RECORD_2["embargo_date"] = "1970-01-01T00:00:01Z";

    // Setup import context and run import
    const context = new P.ImportContext();
    context.__TEST__document = [TEST_RECORD, INVALID_RECORD, TEST_RECORD_2];
    let firstAuthorRef = context.getPerson({last: "PERSON", first:"TEST A."});
    if(!firstAuthorRef) {
        const firstAuthor = O.object().
            appendType(T.Person).
            appendTitle(O.text(O.T_TEXT_PERSON_NAME, { title: "Dr", first: "TEST ALEXANDER", last: "PERSON" })).
            save();
        context.addPersonToLookupList(firstAuthor);
        firstAuthorRef = context.getPerson({last: "PERSON", first:"TEST A."});
    }
    t.assert(firstAuthorRef, "Unable to find author object by names");
    context.importDigitalCommonsMetadata();
    console.log(JSON.stringify(context.log, undefined, 2));

    t.assert(context.intermediates.length === 3);
    t.assertEqual(context.intermediates[0].digitalCommonsURL, TEST_RECORD.url);

    // Test object creation
    const imported = context.intermediates[0].object;
    const imported2 = context.intermediates[2].object;
    // t.assert(!imported.isMutable, "Object hasn't saved correctly");s
    t.assertEqual(imported.title, TEST_RECORD.title);
    t.assert(imported.isKindOf(T.JournalArticle));
    t.assert(imported.has(P.DOI.create(TEST_RECORD.doi), A.DOI));
    t.assert(imported.has(P.ScopusEID.create(TEST_RECORD.configured_field_t_scopus_eid[0]), A.ScopusEID));
    t.assert(imported.has(O.text(O.T_IDENTIFIER_ISBN, TEST_RECORD.configured_field_t_issn), A.ISSN));
    t.assert(imported.has(O.text(O.T_IDENTIFIER_ISBN, TEST_RECORD.configured_field_t_isbn), A.ISBN));
    t.assert(imported.has(O.text(O.T_TEXT_PARAGRAPH, CLEANED_ABSTRACT), A.Abstract));
    t.assert(imported.has(O.datetime(PUBLISHED_DATE, undefined, O.PRECISION_YEAR), A.Date));
    t.assertEqual(imported.every(A.Journal).length, 1);
    t.assertEqual(imported.first(A.Journal).load().title, TEST_RECORD.configured_field_t_source_publication[0]);
    // DC autofills a "false" value here - check with client on a case by case basis whether it's in use or just autofilled
    // t.assert(imported.has(O.behaviourRef("hres:list:peer-review:not-reviewed"), A.PeerReview));
    t.assert(imported.attributeGroupHas(A.PublishedFile, TEST_FILE.identifier(), A.File));
    t.assert(imported.attributeGroupHas(A.PublishedFile, O.behaviourRef("hres:list:license:cc-by:3"), A.License));
    t.assert(context.log.warnings["inferred-embargo-start"], "Warns about inferred embargo start dates");
    const journalCitation = O.service("hres:journal_citation:create", {
        volume: TEST_RECORD.configured_field_t_volnum,
        number: TEST_RECORD.configured_field_t_issnum
    });
    t.assert(imported.has(journalCitation, A.JournalCitation));
    t.assertEqual(imported.every(A.Publisher).length, 1);
    t.assert(imported.has(O.text(O.T_TEXT, TEST_RECORD.configured_field_t_extent[0]), A.Pages));
    t.assertEqual(imported.every(A.Event).length, 1);
    t.assertEqual(imported.first(A.Event).load().title, TEST_RECORD.configured_field_t_conference_name[0]);
    t.assert(imported.has(O.text(O.T_TEXT, TEST_RECORD.configured_field_t_book_series[0]), A.Series));
    t.assert(imported.has(O.text(O.T_TEXT, TEST_RECORD.configured_field_t_chapter_title[0]), A.BookTitle));
    t.assert(imported.has(O.text(O.T_TEXT, TEST_RECORD.configured_field_t_degree_name[0]), A.QualificationName));
    t.assert(imported.has(O.text(O.T_IDENTIFIER_URL, TEST_RECORD.configured_field_t_source_fulltext_url[0]), A.URL));
    t.assert(imported.has(O.text(O.T_TEXT, TEST_RECORD.configured_field_t_publisher_location), A.PlaceOfPublication));
    let findCitation = function(text) {
        const foundCitationString = _.find(imported.every(ATTR["hres:attribute:authors-citation"]), (cite) => {
            return (cite.toString() === text);
        });
        t.assert(foundCitationString);
    };
    _.each(["PERSON, TEST A.", "Smith, John", "Jones, Sheryl A."], findCitation);   // Default citation format of the names in author_display
    _.each(TEST_RECORD.corporate_author, findCitation);
    t.assert(imported.has(firstAuthorRef, ATTR["dc:attribute:author"]));
    // use first() to ensure order is correct, as fields are out of order in source record
    t.assertEqual(imported.first(ATTR["hres:attribute:editors-citation"]).toString(), TEST_RECORD.configured_field_t_editor1[0]);
    t.assert(imported.has(O.text(O.T_TEXT_PARAGRAPH, CLEANED_COMMENTS), A.Notes));
    t.assert(imported.has(O.text(O.T_TEXT, TEST_RECORD.configured_field_t_grant_num[0]), A.GrantId));
    t.assert(imported.has(O.text(O.T_TEXT, TEST_RECORD.configured_field_t_grant_num2[0]), A.GrantId));
    t.assert(imported.has(O.text(O.T_TEXT_PARAGRAPH, CLEANED_GRANT_PURL), A.GrantNotes));

    // Check embargo applied correctly
    const embargoQ = O.service("hres_repo_embargoes:get_embargo", imported);
    t.assertEqual(embargoQ.length, 1);
    t.assert(embargoQ[0].end);
    t.assert(new XDate(embargoQ[0].end).diffDays(new XDate("2019-01-01")) < 1);
    // Check embargo is NOT applied, correctly
    const embargoQ2 = O.service("hres_repo_embargoes:get_embargo", imported2);
    t.assert(!embargoQ2);

    // Check newly created publisher
    const importedPublisher = imported.first(A.Publisher).load();
    t.assertEqual(importedPublisher.title, TEST_RECORD.configured_field_t_publisher[0]);
    t.assert(importedPublisher.has(O.behaviourRef("hres:list:location:country:us"), A.Location));
    t.assertEqual(importedPublisher.every(A.Location).length, 1);
    
    const invalid = context.intermediates[1].object;
    // Test a couple of things that _aren't_ imported
    t.assert(!invalid.first(A.URL), "DOI in URL field isn't imported to A.URL");
    t.assert(!invalid.first(A.GrantNotes), "Empty paragraph text should be ignored - check A.GrantNotes");

    // Test logging
    const log = context.log;
    // Check the invalid data above is logged for INVALID_RECORD
    var checkErrorsLogged = function(errorCode) {
        t.assertEqual(log.errors[errorCode], 1);
        const foundInInvalidRecordLog = _.find(log.digitalCommonsRecords["INVALID_RECORD_URL"], (errorMsg) => {
            return errorMsg.includes(errorCode);
        });
        t.assert(foundInInvalidRecordLog, errorCode+" not in error log for INVALID_RECORD_URL");
    };
    t.assertEqual(log.outputsByType[SCHEMA.getTypeInfo(T.JournalArticle).name], 2);
    t.assertEqual(log.newObjects[SCHEMA.getTypeInfo(T.Journal).name], 1);
    t.assertEqual(log.newObjects[SCHEMA.getTypeInfo(T.Publisher).name], 1);
    checkErrorsLogged("unexpected-multivalue:configured_field_t_source_publication");
    checkErrorsLogged("missing-controlled-field-value");
    checkErrorsLogged("cannot-save-object");
    t.assert(log.fields.missingControlledFieldValues["document_type"]);
    t.assertEqual(log.fields.missingControlledFieldValues["document_type"].length, 1);
    t.assertEqual(log.fields.missingControlledFieldValues["document_type"][0], "INVALID");
    checkErrorsLogged("no-volume-for-journal-citation");
    checkErrorsLogged("publisher-country-without-publisher");
    checkErrorsLogged("unexpected-multivalue:configured_field_t_degree_name");
    checkErrorsLogged("cannot-replace-href");
});
