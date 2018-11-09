/* Haplo Research Manager                             http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var REPOSITORY_TYPES = P.REPOSITORY_TYPES = SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item');

var REPOSITORY_TYPE_LOOKUP = O.refdictHierarchical();
REPOSITORY_TYPES.forEach(function(type) { REPOSITORY_TYPE_LOOKUP.set(type, true); });

// Configure citation attribute shadows
P.hresAuthorCitation.standardShadowingConfigurationForTypes(P.REPOSITORY_TYPES);

// --------------------------------------------------------------------------

var CanEditRepositoryActivityOverview = O.action("hres:action:repository:can_edit_activity_overview").
    title("Can edit Repository activity overview text").
    allow("group", Group.RepositoryEditors);

// --------------------------------------------------------------------------

// Creates link on the homepage action panel to a reporting and guides area
P.implementService("haplo_activity_navigation:discover", function(activity) {
    activity(40, "repository", "Repository", "E226,0,f", CanEditRepositoryActivityOverview);
});

// --------------------------------------------------------------------------

P.implementService("hres:repository:store_query", function() {
    return O.query().link(REPOSITORY_TYPES, A.Type);
});

P.implementService("hres:repository:each_repository_item_type", function(iterator) {
    REPOSITORY_TYPES.forEach(iterator);
});

P.implementService("hres:repository:is_repository_item", function(object) {
    var isOutput = false;
    object.each(A.Type, function(t) {
        if(REPOSITORY_TYPE_LOOKUP.get(t)) { isOutput = true; }
    });
    return isOutput;
});

P.implementService("hres:repository:is_author", function(person, object) {
    return (object.has(person.ref, A.Author) || 
        (object.has(person.ref, A.Editor) && object.isKindOf(T.Book)));
});

P.implementService("hres:repository:earliest_publication_date", function(output) {
    var published;
    var publicationDates = output.every(A.PublicationDates);
    _.each(publicationDates, function(p) {
        if(p && (!published || (p.start < published))) {
            published = p.start;
        }
    });
    return published;
});

// --------------------------------------------------------------------------

P.hresWorkflowEntities.add({
    "author": ["object", A.Author]
});

// --------------------------------------------------------------------------
// Shadow internal authors into A.Researcher. This allows other hres functionality to work
// as expected, as much of it hangs off A.Researcher.

var shadowedAttributes = {};
var shadowInTypes = O.refdictHierarchical();

// Configuration of shadowed fields for author values
var shadowingConfigurationForTypes = function(types) {
    shadowedAttributes[A.Author] = A.Researcher;
    types.forEach(function(t) { shadowInTypes.set(t, true); });
};
shadowingConfigurationForTypes(P.REPOSITORY_TYPES);

// Shadowed fields need to be updated when the object is changed
P.hook('hComputeAttributes', function(response, object) {
    var type = object.firstType();
    if(type && shadowInTypes.get(type)) {
        var toAppend = [];
        _.each(shadowedAttributes, function(shadowed, author) {
            author = 1*author;  // JS keys are always strings
            object.every(author, function(v,d,q) {
                var person = v.load();
                if(person.isKindOf(T.Person) && !person.isKindOf(T.ExternalResearcher)) {
                    toAppend.push(v);
                }
            });
            // Note this will need changing if more attributes shadow into A.Researcher
            object.remove(shadowed);
            toAppend.forEach((v) => object.append(v, shadowed));
        });
    }
});

// Don't display the shadowed attributes
var objectRender = function(response, object) {
    var type = object.firstType();
    if(type && shadowInTypes.get(type)) {
        _.each(shadowedAttributes, function(shadowed, author) {
            response.hideAttributes.push(shadowed);
        });
    }
};
P.hook('hObjectRender', objectRender);
P.hook('hObjectRenderPublisher', objectRender);
