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
if(!O.application.config["hres:repository:remove_default_activity_navigation"]) {
    P.implementService("haplo_activity_navigation:discover", function(activity) {
        activity(40, "repository", NAME("hres:repository-homepage-text", "Repository"), "E226,0,f", CanEditRepositoryActivityOverview);
    });
}

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

var personIsAuthorOfObject = P.personIsAuthorOfObject = function(person, object) {
    return (object.has(person.ref, A.Author) || 
        (object.has(person.ref, A.Editor) && object.isKindOf(T.Book)));
};
P.implementService("hres:repository:is_author", personIsAuthorOfObject);

P.implementService("hres:email:match-to-existing-record-in-list", function(object, list) {
    var emails = object.every(A.Email);
    if(emails.length) {
        return _.find(list, function(listObject) {
            return _.any(emails, function(email) {
                return listObject.has(email, A.Email);
            });
        });
    }
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

var getFiles = function(output) {
    var fileAttributes = [];
    output.every(function(v,d,x) {
        if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
            fileAttributes.push(O.file(v));
        }
    });
    return fileAttributes;
};

P.implementService("hres:repository:zip_output_files", function(output) {
    if(!output) { return; }
    var files = getFiles(output.restrictedCopy(O.currentUser));
    let zip = O.zip.create("Output-Files").rootDirectory("Output-Files");
    _.each(files, function(file) {
        zip.add(file);
    });
    return zip;
});

// --------------------------------------------------------------------------

P.hresWorkflowEntities.add({
    "author": ["object", A.Author],
    "editor": ["object", A.Editor]
});

// --------------------------------------------------------------------------
// Shadow internal authors and editors into A.Researcher. This allows other hres
// functionality to work as expected, as much of it hangs off A.Researcher.

var attributesToShadow = [];
var shadowInTypes = O.refdictHierarchical();

// Configuration of shadowed fields for author values
var shadowingConfigurationForTypes = function(types) {
    attributesToShadow = [A.Author, A.Editor];
    types.forEach(function(t) { shadowInTypes.set(t, true); });
};
shadowingConfigurationForTypes(P.REPOSITORY_TYPES);

// Shadowed fields need to be updated when the object is changed
P.hook('hComputeAttributes', function(response, object) {
    var type = object.firstType();
    if(type && shadowInTypes.get(type)) {
        var toAppend = [];
        _.each(attributesToShadow, function(attr) {
            object.every(attr, function(v,d,q) {
                var person = v.load();
                if(person.isKindOf(T.Person) && !person.isKindOf(T.ExternalResearcher)) {
                    toAppend.push(v);
                }
            });
        });
        object.remove(A.Researcher);
        toAppend.forEach((v) => {
            // Don't append the same person more than once
            if(!object.has(v, A.Researcher)) {
                object.append(v, A.Researcher);
            }
        });
    }
});

// Don't display the shadowed attributes
var objectRender = function(response, object) {
    var type = object.firstType();
    if(type && shadowInTypes.get(type)) {
        response.hideAttributes.push(A.Researcher);
    }
};
P.hook('hObjectRender', objectRender);
P.hook('hObjectRenderPublisher', objectRender);

// --------------------------------------------------------------------------
// Setup for License hierarchy

var LICENSE_URLS = {
    "hres:list:license:cc-by": "https://creativecommons.org/licenses/by",
    "hres:list:license:cc-by:3": "https://creativecommons.org/licenses/by/3.0",
    "hres:list:license:cc-by:4": "https://creativecommons.org/licenses/by/4.0",
    "hres:list:license:cc-by-sa": "https://creativecommons.org/licenses/by-sa",
    "hres:list:license:cc-by-sa:3": "https://creativecommons.org/licenses/by-sa/3.0",
    "hres:list:license:cc-by-sa:4": "https://creativecommons.org/licenses/by-sa/4.0",
    "hres:list:license:cc-by-nc": "https://creativecommons.org/licenses/by-nc",
    "hres:list:license:cc-by-nc:3": "https://creativecommons.org/licenses/by-nc/3.0",
    "hres:list:license:cc-by-nc:4": "https://creativecommons.org/licenses/by-nc/4.0",
    "hres:list:license:cc-by-nd": "https://creativecommons.org/licenses/by-nd",
    "hres:list:license:cc-by-nd:3": "https://creativecommons.org/licenses/by-nd/3.0",
    "hres:list:license:cc-by-nd:4": "https://creativecommons.org/licenses/by-nd/4.0",
    "hres:list:license:cc-by-nc-sa": "https://creativecommons.org/licenses/by-nc-sa",
    "hres:list:license:cc-by-nc-sa:3": "https://creativecommons.org/licenses/by-nc-sa/3.0",
    "hres:list:license:cc-by-nc-sa:4": "https://creativecommons.org/licenses/by-nc-sa/4.0",
    "hres:list:license:cc-by-nc-nd": "https://creativecommons.org/licenses/by-nc-nd",
    "hres:list:license:cc-by-nc-nd:3": "https://creativecommons.org/licenses/by-nc-nd/3.0",
    "hres:list:license:cc-by-nc-nd:4": "https://creativecommons.org/licenses/by-nc-nd/4.0",
    "hres:list:license:cc-0": "https://creativecommons.org/publicdomain/zero/1.0"
};
P.onInstall = function() {
    _.each(LICENSE_URLS, (url, behaviour) => {
        var license = O.behaviourRef(behaviour).load().mutableCopy();
        if(!license.has(O.text(O.T_IDENTIFIER_URL, url), A.Url)) {
            license.append(O.text(O.T_IDENTIFIER_URL, url), A.Url);
            license.save();
        }
    });
    if(!O.behaviourRefMaybe("hres:object:publisher-reporting-sentinel")) {
        var sentinel = O.object([Label.ARCHIVED]);
        sentinel.appendType(T.IntranetPage);
        sentinel.appendTitle("Unregistered publisher entered");
        sentinel.append(O.text(O.T_IDENTIFIER_CONFIGURATION_NAME, "hres:object:publisher-reporting-sentinel"), A.ConfiguredBehaviour);
        sentinel.save();
    }
    if(!O.behaviourRefMaybe("hres:object:journal-reporting-sentinel")) {
        var journalSentinel = O.object([Label.ARCHIVED]);
        journalSentinel.appendType(T.IntranetPage);
        journalSentinel.appendTitle("Unregistered journal entered");
        journalSentinel.append(O.text(O.T_IDENTIFIER_CONFIGURATION_NAME, "hres:object:journal-reporting-sentinel"), A.ConfiguredBehaviour);
        journalSentinel.save();
    }
    if(!O.behaviourRefMaybe("hres:object:license-reporting-sentinel")) {
        var licenseSentinel = O.object([Label.ARCHIVED]);
        licenseSentinel.appendType(T.IntranetPage);
        licenseSentinel.appendTitle("Unregistered license entered");
        licenseSentinel.append(O.text(O.T_IDENTIFIER_CONFIGURATION_NAME, "hres:object:license-reporting-sentinel"), A.ConfiguredBehaviour);
        licenseSentinel.save();
    }
};

//Migration task to clean up clients where P.onInstall hasn't run
P.respond("GET,POST", "/do/hres-repository/license", [
], function(E) {
    if(!O.currentUser.isSuperUser) { O.stop("Not permitted"); }
    let number = _.size(LICENSE_URLS);
    _.each(LICENSE_URLS, (url, behaviour) => {
        var license = O.behaviourRef(behaviour).load().mutableCopy();
        if(license.first(A.Url)) { 
            number--;
            return; 
        }
        if(E.request.method === "POST") {
            license.append(O.text(O.T_IDENTIFIER_URL, url), A.Url);
            license.save();
        }
    });
    
    if(E.request.method === "POST") {
        if(!O.behaviourRefMaybe("hres:object:license-reporting-sentinel")) {
            var licenseSentinel = O.object([Label.ARCHIVED]);
            licenseSentinel.appendType(T.IntranetPage);
            licenseSentinel.appendTitle("Unregistered license entered");
            licenseSentinel.append(O.text(O.T_IDENTIFIER_CONFIGURATION_NAME, "hres:object:license-reporting-sentinel"), A.ConfiguredBehaviour);
            licenseSentinel.save();
        }
        E.response.redirect("/");
    }

    E.render({
        pageTitle: "Add License URLS",
        backLink: "/",
        text: "Are you sure you would like to add URLs to "+number+" licenses?\n"+
            "Unknown sentinel ref: "+O.behaviourRefMaybe("hres:object:license-reporting-sentinel"),
        options: [{label:"Confirm"}]
    }, "std:ui:confirm");
});

// --------------------------------------------------------------------------
// Testing - impersonation
// --------------------------------------------------------------------------

P.onLoad = function() {
    if(O.featureImplemented("hres:development_activity_impersonation")) {
        P.use("hres:development_activity_impersonation");
        P.activityImpersonation({
            activityName: "repository",
            activityPanel: 11111,
            activityGroups: [
                Group.RepositoryEditors
            ],
            activityRoles: []
        });
    }
};