/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var NOTES = {};
NOTES[A.AuthorsCitation] = "authcite";
NOTES[A.EditorsCitation] = "edcite";
// TODO: Make these notes composable
// NOTES[A ResearchOrScholarly] = "ressch";
// TODO: Unconmment when Open Access schema exists
// NOTES[A OpenAccess] = "opena";
NOTES[A.PublicationDates] = "pubdt";
NOTES[A.AcceptedAuthorManuscript] = "aam";
NOTES[A.WebAddressUrl] = 'url';
NOTES[A.Author] = 'author'; // TODO: New authors notes?
if("RefUnitOfAssessment" in A) {
    NOTES[A["RefUnitOfAssessment"]] = 'refunit';
}
// TODO: Unconmment when Embargoes schema exists
// NOTES[A LicenseUrl] = 'license';
NOTES[A.File] = 'file';
NOTES[A.Issn] = 'issn';
NOTES[A.Isbn] = 'isbn';

var AUTHOR_ATTR_FIELDS = [A.Author, A.BookEditor];
// Hook into object editor to add the notes
P.hook('hObjectEditor', function(response, object) {
    if(O.serviceMaybe("hres:repository:is_repository_item", object)) {
        response.plugins.hres_repo_object_editor = {
            objType: object.firstType().toString(),
            notes:NOTES,
            authorAttrs:AUTHOR_ATTR_FIELDS,
            publisherAttr:A.Publisher,
            metadataKeys:P.REPOSITORY_METADATA_KEYS
        };
        P.template("include_repo_editor_plugin").render();
    }
});
