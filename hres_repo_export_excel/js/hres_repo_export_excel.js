/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var getUniqueDescsForObjects = function(items) {
    let itemHasAttribute = function(item, desc) {
        let groups = item.getAttributeGroupIds(desc);
        return !!(item.first(desc) || groups.length);
    };
    return _.chain(items).
        map((item) => SCHEMA.getTypeInfo(item.firstType()).attributes).
        flatten().
        uniq().
        // Ensures hidden attributes still visible by the API aren't included e.g. shadowed authors
        filter((desc) => {
            return _.any(items, (item) => {
                return item.canReadAttribute(desc, O.currentUser) && itemHasAttribute(item, desc);
            });
        }).
        value();
};

var applyHeaders = function(items, uniqueDescs, xlsx) {
    _.each(uniqueDescs, (desc) => xlsx.push(SCHEMA.getAttributeInfo(desc).name));
    xlsx.nextRow();
};

var addItemsToXLSX = function(items, uniqueDescs, xlsx) {
    _.each(items, (item) => {
        let groups = item.extractAllAttributeGroups().groups;
        _.each(uniqueDescs, (desc) => {
            let values = [];
            if(_.isEqual(SCHEMA.getAttributeInfo(desc).typecode, O.T_ATTRIBUTE_GROUP)) {
                _.chain(groups).
                    filter((group) => group.extension.desc === desc).
                    each((group) => {
                        let groupValues = [];
                        group.object.every((v,d,q) => {
                            if(d == A.Type) { return; }
                            let groupDescInfo = SCHEMA.getAttributeInfo(d);
                            let value = O.isRef(v) ? v.loadObjectTitleMaybe() : v.toString();
                            groupValues.push(groupDescInfo.name+": "+value);
                        });
                        values.push(groupValues.join(", "));
                    });
            } else {
                item.every(desc, (v) => values.push(O.isRef(v) ? v.loadObjectTitleMaybe() : v.toString()));
            }
            xlsx.push(values.join(",\n"));
        });
        xlsx.nextRow();
    });
};

P.implementService("hres:repository:excel:export-object-as-xlsx", function(item) {
    let xlsx = O.generate.table.xlsx(item.title);
    xlsx.newSheet("Items", true);
    let uniqueDescs = getUniqueDescsForObjects([item]);
    applyHeaders([item], uniqueDescs, xlsx);
    addItemsToXLSX([item], uniqueDescs, xlsx);
    xlsx.finish();
    return xlsx;
});

P.implementService("hres:repository:excel:export-object-as-xlsx-multiple", function(items) {
    let filename = O.application.name.toLowerCase().replace(/\s/g, "-")+"-export-"+(new XDate()).toString("dd-MMM-yyyy-HH-mm-ss");
    let xlsx = O.generate.table.xlsx(filename);
    xlsx.newSheet("Items", true);
    let uniqueDescs = getUniqueDescsForObjects(items);
    applyHeaders(items, uniqueDescs, xlsx);
    addItemsToXLSX(items, uniqueDescs, xlsx);
    xlsx.finish();
    return xlsx;
});