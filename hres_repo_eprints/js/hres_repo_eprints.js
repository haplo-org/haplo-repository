/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// TODO: have general management page like user sync

P.respond("GET", "/do/hres-repo-eprints/mapping", [
], function(E) {
    O.action("std:action:administrator_override").enforce();

    const haploAttributeInfo = P.getHaploAttributeInfo();
    const mappings = _.map(haploAttributeInfo, item => {
        return {
            attributeTitle: item.name && SCHEMA.getAttributeInfo(A[item.name]).name,
            database: !!item.database,
            tag: item.tag,
            import: !!item.xmlToIntermediate,
            export: !!item.objectToIntermediate
        };
    });

    E.render({
        mappings: mappings
    });
});

P.respond("GET", "/do/hres-repo-eprints/tags-and-values", [
    {pathElement:0, as:"db", table:"eprintsLogging"}
], function(E, row) {
    O.action("std:action:administrator_override").enforce();

    const log = row.log;
    let tags = {};
    _.each(log.tags, (v, k) => tags[k] = _.uniq(v));
    _.each(tags, (v, k) => tags[k] = _.sortBy(v, l => l));
    E.response.body = JSON.stringify(tags, undefined, 2);
    E.response.kind = "json";
});

// TODO auditing: random selection of eprints to check
