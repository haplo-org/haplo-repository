/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:descriptive_object_labelling:setup", function(type) {
    SCHEMA.getTypesWithAnnotation('hres:annotation:repository:output').forEach(function(outputType) {
        type(outputType, {
            labels: [Label.Output]
        });
    });
});

// --------------------------------------------------------------------------

var CanEditType = O.action("hres_repo_schema_outputs:change_type").
    title("Edit output object type").
    allow("group", Group.RepositoryEditors);

P.hook("hObjectDisplay", function(response, object) {
    if(O.currentUser.allowed(CanEditType) && O.service("hres:repository:is_repository_item", object)) {
        response.buttons["*OUTPUTTYPE"] = [["/do/hres-repo-schema-outputs/change-type/"+object.ref, "Change output type"]];
    }
});

var changeTypeForm = P.form("changeType", "form/changeType.json");

P.respond("GET,POST", "/do/hres-repo-schema-outputs/change-type", [
    {pathElement:0, as:"object"}
], function(E, item) {
    CanEditType.enforce();
    if(!O.service("hres:repository:is_repository_item", item)) { O.stop("Not permitted"); }
    
    let choices = [];
    let appendChoice = function(ref) {
        choices.push({id:ref.toString(), name:ref.load().title});
    };
    if(O.serviceImplemented("hres:repository:ingest_ui:types")) {
        let types = O.service("hres:repository:ingest_ui:types");
        _.each(types.primaryTypes, (t) => { appendChoice(t.ref); });
        _.each(types.secondaryTypes, (t) => { appendChoice(t.ref); });
    } else {
        O.service("hres:repository:each_repository_item_type", (type) => { appendChoice(type); });
    }

    let document = {
        type: item.firstType().toString()
    };
    let form = changeTypeForm.instance(document);
    form.choices("types", choices);
    form.update(E.request);
    if(form.complete) {
        let mItem = item.mutableCopy();
        mItem.remove(A.Type);
        mItem.appendType(O.ref(document.type));
        if(!item.valuesEqual(mItem)) {
            mItem.save();
        }
        return E.response.redirect(item.url());
    }
    E.render({
        item: item,
        form: form
    });
});

// --------------------------------------------------------------------------
// Computed current RI

var addAttrFromPeople = function(object, attrToFind, attrToChange) {
    let attrs = [];
    attrToChange = attrToChange || attrToFind;
    _.each([A.Researcher, A.Author, A.Editor], (personAttr) => {
        object.every(personAttr, (person) => {
            if(O.isRef(person) && person.load()) {
                attrs = attrs.concat(person.load().every(attrToFind));
            }
        });
    });
    attrs = O.deduplicateArrayOfRefs(attrs);
    object.remove(attrToChange);
    _.each(attrs, (attr) => object.append(attr, attrToChange));
};

P.implementService("hres:repository:add-attributes-from-creators", function(object, attrToFind, attrToChange) {
    addAttrFromPeople(object, attrToFind, attrToChange);
});

P.hook('hComputeAttributes', function(response, object) {
    if(object.isKindOfTypeAnnotated("hres:annotation:repository-item")) {
        addAttrFromPeople(object, A.ResearchInstitute);
        if(!object.first(A.OriginalResearchInstitute)) {
            addAttrFromPeople(object, A.ResearchInstitute, A.OriginalResearchInstitute);
        }
    }
});

P.hook('hPostObjectChange', function(response, object, operation) {
    if(object.isKindOf(T.Person)) {
        O.background.run("hres_repo_schema_outputs:update_outputs", { ref:object.ref.toString() });
    }
});

P.implementService("hres_repo_schema_outputs:update_outputs", function(object) {
    if(object && object.ref) {
        O.background.run("hres_repo_schema_outputs:update_outputs", { ref:object.ref.toString() });
    }
});

var updateOutputsForPerson = function(ref) {
    O.query().link(ref, A.Researcher).
    link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), A.Type).
    execute().each((obj) => {
        let mObj = obj.mutableCopy();
        mObj.computeAttributesForced();
        if(!mObj.valuesEqual(obj)) {
            mObj.save();
        }
    });
};

P.backgroundCallback("update_outputs", function(data) {
    const ref = data.ref ? O.ref(data.ref) : undefined;
    if(ref) {
        O.withoutPermissionEnforcement(() => {
            updateOutputsForPerson(ref);
        });
    }
});

P.hook("hObjectRender", function(response, object) {
    var isRepoItem = object.isKindOfTypeAnnotated("hres:annotation:repository-item");
    if(isRepoItem && !O.currentUser.allowed(CanSeeRepoRIs)) {
        response.hideAttributes.push(A.ResearchInstitute);
        response.hideAttributes.push(A.OriginalResearchInstitute);
    }
});

P.implementService("hres:repository:duplication_ignore_attributes", function(ignoreAttributes) {
    ignoreAttributes.push(A.OriginalResearchInstitute, A.ResearchInstitute);
});

P.implementService("hres:repository:duplication_read_only_attributes", function(readOnlyAttributes) {
    readOnlyAttributes.push(A.OriginalResearchInstitute, A.ResearchInstitute);
});

// --------------------------------------------------------------------------
// Permissions

// TODO: extend the permissions system to avoid the need to have both an action and restriction label
// to handle the read-only and viewing permissions of the ri attributes (things got difficult when hObjectRender
// was needed)
var CanSeeRepoRIs = O.action("hres_repo_schema_outputs:can_see_repository_item_research_institutes").
    title("Can view research institute attributes on repository items").
    allow("group", Group.RepositoryEditors);

P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    setup.groupRestrictionLabel(Group.RepositoryEditors, Label.LiftRepositoryResearchInstituteRestrictions);
});