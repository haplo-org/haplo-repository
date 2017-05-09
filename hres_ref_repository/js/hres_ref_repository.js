/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("std:action_panel_priorities", function(priorities) {
    _.extend(priorities, {
        "hres:ref:repo": 750
    });
});

var CanManageREF = P.CanManageREF = O.action("hres_ref_repository:manage_ref").
    title("Can managed REF").
    allow("group", Group.RepositoryEditors);

P.implementService("std:action_panel:repository_item", function(display, builder) {
    if(O.currentUser.allowed(CanManageREF)) {
        var panel = builder.panel("hres:ref:repo");
        if(isREFOARelevent(display.object)) {
            panel.element(0, {title:"REF"});
            _.each(P.REFChecks, function(r) {
                var pass = r.check(display.object);
                panel.element("default", {label:(pass ? "Passed" : "Failed")+": "+r.label});
            });
        } else {
            panel.element(0, {title:"REF", label: "REF compliance not required."});
        }
    }
});

P.db.table("exceptions", {
    output: {type: "ref"},
    exception: {type: "text"},
    evidence: {type: "text", nullable: true}
});

P.db.table("firstFileDeposit", {
    output: {type: "ref"},
    date: {type: "date"},
    fileVersion: {type: "text"},
    objectVersion: {type: "int"}
});

var isREFOARelevent = P.isREFOARelevent = function(output) {
    return (output.isKindOf(T.JournalArticle) || output.isKindOf(T.ConferenceItem));
};

P.isREFSubmissible = function(output) {
    var passesChecks = _.every(P.REFChecks, function(spec, name) {
        return spec.check(output);
    });
    var hasException = !!getREFException(output);
    return (isREFOARelevent(output) && (
        passesChecks || hasException
    ));
};

P.getFirstFileDeposit = function(output) {
    var q = P.db.firstFileDeposit.select().where("output", "=", output.ref);
    if(q.length) {
        return q[0];
    }
};

var getREFException = P.getREFException = function(output) {
    var q = P.db.exceptions.select().where("output", "=", output.ref);
    if(q.length) {
        return q[0];
    } 
};
