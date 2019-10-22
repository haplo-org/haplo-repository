/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var NOTES = {},
    ADDITIONAL_NOTES = {};
NOTES[A.AuthorsCitation] = "authcite";
NOTES[A.EditorsCitation] = "edcite";
// TODO: Make these notes composable
NOTES[A.PublicationDates] = "pubdt";
NOTES[A.AcceptedAuthorManuscript] = "aam";
NOTES[A.WebAddressUrl] = 'url';
NOTES[A.Author] = 'author';
if("RefUnitOfAssessment" in A) {
    NOTES[A["RefUnitOfAssessment"]] = 'refunit';
}
NOTES[A.File] = 'file';
NOTES[A.Issn] = 'issn';
NOTES[A.Isbn] = 'isbn';
NOTES[A.Keywords] = 'keywords';
NOTES[A.PageRange] = 'pagerange';
if("PublicationProcessDates" in A) {
    NOTES[A.PublicationProcessDates] = 'processdates';
}

var AUTHOR_ATTR_FIELDS = [A.Author, A.BookEditor];
// Hook into object editor to add the notes
P.hook('hObjectEditor', function(response, object) {
    if(O.serviceMaybe("hres:repository:is_repository_item", object)) {
        response.plugins.hres_repo_object_editor = {
            objType: object.firstType().toString(),
            notes:NOTES,
            authorAttrs:AUTHOR_ATTR_FIELDS,
            publisherAttr:A.Publisher,
            metadataKeys:P.REPOSITORY_METADATA_KEYS,
            additionalNotes: ADDITIONAL_NOTES
        };
        P.template("include_repo_editor_plugin").render();
    }
});

/*HaploDoc
node: repository/hres_repo_object_editor
title: Repository Object Editor
sort: 1
--

h2(service). "hres:repository:add_info_bubble"

h3(arguments). Arguments

Service takes one javascript object as an argument, in the form

<pre>
Attribute: {
    lookup: "key",
    note: "Note to Display"
}
</pre>
Where:
- @Attribute@ is the attribute to attach the note to, i.e @A.Title@
- @key@ is an identifying key which can be used to override default info bubbles 
- @Note to Display@ is the note to show in the object editor
Both of type string

h3(usage). Usage: O.service("hres:repository:add_info_bubbles", NOTES);

Where notes is defined and the service is called like so:

<pre>language=javascript
NOTES[A.Title] = {
    lookup: "title",
    note: "Enter the title of the output here"
};

P.onLoad = function() {
    O.service("hres:repository:add_info_bubbles", NOTES);
};
</pre>
The service is called in @P.onLoad@ to ensure that the repository object editor plugin is loaded and there is no dependency on the load order.
*/
P.implementService("hres:repository:add_info_bubbles", function(notes) {
    _.each(notes, function(value, key) {
        NOTES[key] = value.lookup;
        ADDITIONAL_NOTES[value.lookup] = value.note;
    });
});