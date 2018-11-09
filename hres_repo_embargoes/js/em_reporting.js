/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("std:reporting:collection:repository_items:setup", function(collection) {
    collection.
        fact("emStart",         "date",         "Start").
        fact("emEnd",           "date",         "End").
        fact("emLength",        "text",         "Length").
        fact("emUnderEmbargo",  "boolean",      "Under embargo").
        fact("emHasEmbargo",    "boolean",      "Has embargo data").
        
        statistic({
            name:"emHasEmbargoCount",
            description:"Items with embargos",
            filter(select) {
                select.where("emHasEmbargo", "=", true);
            },
            aggregate:"COUNT"
        }).
        
        filter("emHasEmbargo", (select) => {
            select.where("emHasEmbargo", "=", true);
        });
});

P.implementService("std:reporting:collection:repository_items:get_facts_for_object", function(object, row) {
    let embargoes = P.getEmbargoData(object);
    row.emHasEmbargo = !!embargoes;
    if(embargoes) {
        row.emStart = _.chain(embargoes).
            map((embargo) => embargo.start).
            min().
            value();
        if(_.every(embargoes, (e) => !!e.end)) {
            row.emEnd = _.chain(embargoes).
                map((embargo) => embargo.end).
                max().
                value();
        }
        if(_.every(embargoes, (e) => !!e.getLengthInMonths())) {
            let l = _.chain(embargoes).
                map(embargo => embargo.getLengthInMonths()).
                max().
                value();
            row.emLength = l+" months";
        } else {
            row.emLength = "Indefinite";
        }
        row.emUnderEmbargo = _.chain(embargoes).
            map((embargo) => embargo.isActive()).
            any().
            value();
    }
});

P.implementService("std:reporting:dashboard:ref_embargoes:setup", function(dashboard) {
    dashboard.
        filter((select) => select.where("emHasEmbargo", "=", true)).
        order(["emEnd", "descending"]).
        columns(250, [
            "emLength"
        ]);
});
