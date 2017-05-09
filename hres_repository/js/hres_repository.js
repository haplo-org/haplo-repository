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
    activity(40, "repository", "Repository", "E226,1,f", CanEditRepositoryActivityOverview);
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
    return object.has(person.ref, A.Author);
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

// Shadowed fields need to be made read only in the editor
P.hook('hPreObjectEdit', function(response, object, isTemplate, isNew) {
    var type = object.firstType();
    if(type && shadowInTypes.get(type)) {
        response.readOnlyAttributes = (response.readOnlyAttributes || []);
        _.each(shadowedAttributes, function(shadowed, author) {
            response.readOnlyAttributes.push(shadowed);
        });
    }
});

// Shadowed fields need to be updated after the object is saved
P.hook('hPostObjectEdit', function(response, object, previous) {
    var type = object.firstType();
    if(type && shadowInTypes.get(type)) {
        var r = response.replacementObject || object.mutableCopy();
        response.replacementObject = r;
        _.each(shadowedAttributes, function(shadowed, author) {
            author = 1*author;  // JS keys are always strings
            r.remove(shadowed);
            object.every(author, function(v,d,q) {
                var person = v.load();
                if(person.isKindOf(T.Person) && !person.isKindOf(T.ExternalResearcher)) {
                    r.append(v, shadowed);
                }
            });
        });
    }
});

// Don't display the shadowed fields
P.hook('hPreObjectDisplay', function(response, object) {
    var type = object.firstType();
    if(type && shadowInTypes.get(type)) {
        var r = response.replacementObject || object.mutableCopy();
        _.each(shadowedAttributes, function(shadowed, author) {
            r.remove(shadowed);
        });
        response.replacementObject = r;
    }
});
