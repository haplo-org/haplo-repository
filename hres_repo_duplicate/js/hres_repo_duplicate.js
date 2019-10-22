/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// --------------------------------------------------------------------------
// Permissions

var CanDuplicateItem = O.action("hres:repository:can-duplicate-item").
    allow("group", Group.RepositoryEditors);

var canDuplicateItem = function(object) {
    return object.isKindOfTypeAnnotated('hres:annotation:repository-item') &&
        (O.currentUser.allowed(CanDuplicateItem) || O.service("hres:repository:is_author", O.currentUser, object));
};

// --------------------------------------------------------------------------
// Start UI

P.hook("hObjectDisplay", function(response, object) {
    if(canDuplicateItem(object)) {
        response.buttons["*DUPLICATEITEM"] = [["/do/hres-repo-duplicate/choose-type/"+object.ref, "Copy as new item"]];
    }
});

// this UI may be useful for future types listing - could be made into a service which allows the action to be modified
P.respond("GET", "/do/hres-repo-duplicate/choose-type", [
    {pathElement:0, as:"object"}
], function(E, object) {
    if(!canDuplicateItem(object)) { O.stop("Not permitted"); }

    const types = O.serviceMaybe("hres:repository:ingest_ui:types");
    let options = (typeList) => {
        return {
            options: _.map(typeList, (type) => {
                return {
                    action: "/do/hres-repo-duplicate/duplicate-with-type/"+object.ref+"/"+type,
                    label: SCHEMA.getTypeInfo(type).name,
                    indicator: "default"
                };
            })
        };
    };

    let view = {
        backLink: object.url()
    };
    if(types) {
        view.primary = options(_.pluck(types.primaryTypes, 'ref'));
        view.secondary = options(_.pluck(types.secondaryTypes, 'ref'));
    } else {
        view.primary = options(_.sortBy(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"),
            type => SCHEMA.getTypeInfo(type).name));
    }
    E.render(view, "new-output");
});

// --------------------------------------------------------------------------
// Pre fill and edit item

// this function finds the common attributes between the original object type's attributes
// and the new type's attributes, then removes any attributes that shouldn't be copied
var getAttributeCodesToCopy = function(referenceObject, newType) {

    const referenceAttributes = SCHEMA.getTypeInfo(referenceObject.first(A.Type)).attributes;
    const newAttributes = SCHEMA.getTypeInfo(newType).attributes;

    const referenceAttrCodes = _.map(referenceAttributes, ra => SCHEMA.getAttributeInfo(ra).code);
    const newAttrCodes = _.map(newAttributes, na => SCHEMA.getAttributeInfo(na).code);

    let sharedAttributes = _.intersection(referenceAttrCodes, newAttrCodes);
    if(!cachedIgnoreAttributes.length) {
        cachedIgnoreAttributes = _.chain(defaultIgnoreAttributes).
            filter(a => a in ATTR).
            // map from code to attr to make it easier to write implementations of the service
            map(a => ATTR[a]).value();
        O.serviceMaybe("hres:repository:duplication_ignore_attributes", cachedIgnoreAttributes);
    }
    // return an array of codes so that they don't have to be declared in this schema
    const ignoreAttributeCodes = _.map(cachedIgnoreAttributes, ca => SCHEMA.getAttributeInfo(ca).code);
    return _.filter(sharedAttributes, sa => (sa && -1 === ignoreAttributeCodes.indexOf(sa)));
};

P.respond("GET", "/do/hres-repo-duplicate/duplicate-with-type", [
    {pathElement:0, as:"object"},
    {pathElement:1, as:"ref"}
], function(E, referenceObject, type) {
    if(!canDuplicateItem(referenceObject)) { O.stop("Not permitted"); }
    let repoTypes = O.serviceMaybe("hres:repository:ingest_ui:types");
    let invalidType = false;
    var refInArray = (refArray, refToFind) => _.some(refArray, (ref) => ref == refToFind);
    if(repoTypes) {
        invalidType = !_.some(repoTypes, (typeInfo) => refInArray(_.pluck(typeInfo, 'ref'), type));
    } else {
        repoTypes = SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item");
        invalidType = !refInArray(repoTypes, type);
    }
    if(invalidType) { O.stop("Invalid item type"); }

    let sharedAttributes = getAttributeCodesToCopy(referenceObject, type);

    let newItem = O.object();
    newItem.append(type, A.Type);
    _.each(sharedAttributes, (attrCode) => {
        let sharedAttr = ATTR[attrCode];
        referenceObject.every(sharedAttr, (v, d, q) => newItem.append(v, d, q));
    });

    let readOnlyAttributes = [];
    O.serviceMaybe("hres:repository:duplication_read_only_attributes", readOnlyAttributes);
    E.render({
        templateObject: newItem,
        pageTitle: 'Add new '+SCHEMA.getTypeInfo(type).name,
        backLink: referenceObject.url(), backLinkText:'Cancel',
        readOnlyAttributes: readOnlyAttributes
    }, "std:new_object_editor");
});

// --------------------------------------------------------------------------
// Helper data

var cachedIgnoreAttributes = [];
// TODO: attribute annotations would be useful here
var defaultIgnoreAttributes = [
    "dc:attribute:type",
    "hres:attribute:publication-dates",
    "hres:attribute:publication-process-dates",
    // files
    "std:attribute:file",
    "hres:attribute:accepted-author-manuscript",
    "hres:attribute:published-file",
    // identifiers
    "std:attribute:isbn",
    "hres:attribute:issn",
    "hres:attribute:digital-object-identifier-doi",
    "std:attribute:url",
    "hres:attribute:pubmed-id",
    // output-specific metadata
    "hres:attribute:page-range",
    "hres:attribute:edition",
    "hres:attribute:series",
    "hres:attribute:journal-citation",
    "hres:attribute:license"
];
