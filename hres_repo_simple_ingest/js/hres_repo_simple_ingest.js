/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var AAMGuidanceNote = P.guidanceNote("repository", "ingest-aam",
    "Accepted Author Manuscript", "guidance/accepted-author-manuscript.xml");

// --------------------------------------------------------------------------

var CanAddOutput = O.action("hres:repository:simple_ingest:add_respository_item").
    title("Add repository item through simple ingest process").
    allow("group", Group.RepositoryEditors);

P.implementService("hres_repo_navigation:repository_item_page", function(object, builder) {
    // TODO: Better permissions for adding repository items via the UI
    if((O.currentUser.ref == object.ref) || O.currentUser.allowed(CanAddOutput)) {
        builder.sidebar.link("default", "/do/repository-simple-ingest/new-for/"+object.ref, "Add output", "primary");
    }
});

// --------------------------------------------------------------------------

var notes = O.refdict();
if("ConferenceItem" in T) {
    notes.set(T.Book, 'A published book or conference volume. For grey literature such as technical reports or discussion papers use "Report" instead.');
    notes.set(T.BookChapter, "A chapter or section in a book, normally distributed through commercial channels. Use for conference papers published in the proceedings.");
    notes.set(T.ConferenceItem, 'A paper, poster, speech, lecture or presentation given at a conference, workshop or other event, or an artistic exhibition or performance. If the conference item has been published in a journal or published proceedings then please use "Article" or "Book Section" instead.');
    notes.set(T.Report, 'A monograph that would not be classified as a book. Examples include technical reports, project reports, documentation, manuals, working papers or discussion papers.');
    notes.set(T.Patent, 'A published patent. Do not include as yet unpublished patent applications.');
}

var primaryTypes, secondaryTypes;
var ensureTypes = function() {
    if(primaryTypes) { return; }
    var infos = [];
    SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item").forEach(function(type) {
        var info = SCHEMA.getTypeInfo(type);
        infos.push({
            ref: type,
            primary: (-1 !== info.annotations.indexOf("hres:annotation:repository:primary-repository-item")),
            name: info.name
        });
    });
    primaryTypes = [];
    secondaryTypes = [];
    _.sortBy(infos, "name").forEach(function(info) {
        var types =  info.primary ? primaryTypes : secondaryTypes;
        types.push(info);
    });
};

// --------------------------------------------------------------------------

P.respond("GET", "/do/repository-simple-ingest/new-for", [
    {pathElement:0, as:"object"}
], function(E, researcher) {
    ensureTypes();
    var options = function(list) {
        return {options:_.map(list, function(i) {
            var guidanceRequired;
            if(O.serviceImplemented("hres_repo_simple_ingest:custom_guidance_for_output")) {
                guidanceRequired = !!O.service("hres_repo_simple_ingest:custom_guidance_for_output", i.ref);
            } else {
                guidanceRequired = (-1 !== SCHEMA.getTypeInfo(i.ref).attributes.indexOf(A.AcceptedAuthorManuscript));
            }
            return {
                action: (guidanceRequired ? 
                    "/do/repository-simple-ingest/guidance-for/" :
                    "/do/repository-simple-ingest/new-for-edit/")+researcher.ref+'/'+ i.ref,
                label: i.name,
                indicator: "standard",
                notes: notes.get(i.ref)
            };
        })};
    };
    E.render({
        researcher: researcher,
        primary: options(primaryTypes.reverse()),   // Journal article and Conference Items at the top
        secondary: options(secondaryTypes)
    });
});

// --------------------------------------------------------------------------

P.respond("GET", "/do/repository-simple-ingest/guidance-for", [
    {pathElement:0, as:"object"},
    {pathElement:1, as:"ref"}
], function(E, researcher, type) {
    E.renderIntoSidebar({
        elements: [{
            href: '/do/repository-simple-ingest/new-for-edit/'+researcher.ref+'/'+type,
            label: "Continue",
            indicator: "primary"
        }]
    }, "std:ui:panel");
    E.render({
        researcher: researcher,
        typeInfo: SCHEMA.getTypeInfo(type),
        guidance: (O.serviceImplemented("hres_repo_simple_ingest:custom_guidance_for_output") ?
            O.service("hres_repo_simple_ingest:custom_guidance_for_output", type) :
            AAMGuidanceNote).deferredRender()
    });
});

// --------------------------------------------------------------------------

P.respond("GET,POST", "/do/repository-simple-ingest/new-for-edit", [
    {pathElement:0, as:"object"},
    {pathElement:1, as:"ref"}
], function(E, researcher, type) {
    // Display template object
    var templateObject = O.object();
    templateObject.appendType(type);
    var attr = A.Author;
    var typeInfo = SCHEMA.getTypeInfo(type);
    if(-1 !== typeInfo.attributes.indexOf(A.EditorsCitation)) {
        // Type uses editors, ask user about their role, set desc
        if("role" in E.request.parameters) {
            if(E.request.parameters.role === 'editor') {
                attr = A.Editor;
            }
        } else {
            return E.render({
                researcher: researcher,
                options: [
                    {action:"?role=author", label:"Author", notes:"I'm an author of this "+typeInfo.name+'.', indicator:"standard"},
                    {action:"?role=editor", label:"Editor", notes:"I edited this "+typeInfo.name+'.', indicator:"standard"}
                ]
            }, "new-output-role");
        }
    }
    O.service("hres:author_citation:append_citation_to_object", templateObject, attr, null, {object:researcher});
    E.render({
        researcher: researcher,
        type: type,
        typeInfo: typeInfo,
        templateObject: templateObject
    }, "new-output");
});
