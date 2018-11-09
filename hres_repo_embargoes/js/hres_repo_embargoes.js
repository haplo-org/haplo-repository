/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanEditEmbargoes = P.CanEditEmbargoes = O.action("hres_repo_embargoes:can_edit").
    title("Can edit embargoes").
    allow('group', Group.RepositoryEditors);

// -------------------------------------------------------------------

P.implementService("hres_repo_embargoes:get_embargo", function(output) {
    return getEmbargoData(output);
});

P.implementService("hres_repo_embargoes:has_embargoed_files_for_user", function(user, output) {
    return hasEmbargoedFilesForUser(user, output);
});

P.implementService("hres_repo_embargoes:set_embargo", function(spec) {
    if(!spec.object) {
        throw new Error("Spec passed to hres_repo_embargoes:set_embargo must contain an object");
    }
    setEmbargo(spec);
});

// -------------------------------------------------------------------

P.implementService("haplo:user_roles_permissions:setup", function(setup) {
    setup.groupRestrictionLabel(Group.RepositoryEditors, Label.LiftAllEmbargoRestrictions);
});

P.hook("hObjectAttributeRestrictionLabelsForUser", function(response, user, object) {
    if(O.serviceMaybe("hres:repository:is_author", user, object)) {
        response.userLabelsForObject.add(Label.LiftAllEmbargoRestrictions);
    }
});

P.hook('hScheduleDailyEarly', function(response, year, month, dayOfMonth, hour, dayOfWeek) {
    var today = new XDate(year, month, dayOfMonth);
    var ending = P.db.embargoes.select().
        where('end', '<', today.toDate());
    if(P.data['lastLiftedEmbargoes']) {
        var lastLiftedEmbargoes = new XDate(P.data['lastLiftedEmbargoes']); 
        ending.where('end', '>', lastLiftedEmbargoes.clearTime().toDate());
    }
    var updated = O.refdict();
    _.each(ending, (embargo) => {
        if(!updated.get(embargo.object)) {
            relabelForEmbargoes(embargo.object.load());
            updated.set(embargo.object, true);
        }
    });
    P.data['lastLiftedEmbargoes'] = (new Date()).toString();
});

// -------------------------------------------------------------------

P.implementService("std:action_panel_priorities", function(priorities) {
    _.extend(priorities, {
        "hres:repository_item:embargo": 101,
    });
});

var fillPanel = function(display, builder) {
    var embargoes = getEmbargoData(display.object);
    if(embargoes) {
        var anyIsActive = _.some(embargoes, (e) => { return e.isActive(); });
        builder.panel("hres:repository_item:embargo").element(0, {title: anyIsActive ? "Under embargo" : "Embargo over"});
        _.each(embargoes, function(embargo) {
            var text = embargo.getDatesForDisplay();
            if(embargo.desc) {
                text = text+" ("+SCHEMA.getAttributeInfo(embargo.desc).name+")";
            }
            builder.panel("hres:repository_item:embargo").link(1, embargo.licenseURL, text);
        });
    }
    if(O.currentUser.allowed(CanEditEmbargoes)) {
        builder.panel("hres:repository_item:embargo").link("default", "/do/hres-repo-embargoes/edit/"+display.object.ref,
            (!!embargoes ? "Edit" : "Set")+" embargo");
    }
};
P.implementService("std:action_panel:output", function(display, builder) {
    fillPanel(display, builder);
});
P.implementService("std:action_panel:research_data", function(display, builder) {
    fillPanel(display, builder);
});

P.implementService("std:action_panel:output", function(display, builder) {
    var output = display.object;
    var panel = builder.panel("hres:ref:repo");
    builder.panel(112).element(0, { title: "Archiving guidance" });
    var q = P.db.sherpaArchivingData.select().where('object', '=', output.ref);
    if(q.length) {
        _.each(q[0].data.publishers, (p) => {
            builder.panel(112).element(10, { label: p.name });
            _.each(p.archiving, (a) => {
                builder.panel(112).element(10, { label: _.capitalize(a) });
            });
        });
    }
    builder.panel(112).link(20,
        "/do/hres-repo-embargoes/sherpa-information/"+output.ref,
        (q.length ? "More" : "Get")+" information",
        "default");
});

// -------------------------------------------------------------------

P.db.table('embargoes', {
    object: { type: 'ref' },
    // Null --> Applies to all descs
    desc: { type: 'int', nullable: true },
    licenseURL: { type: 'text', nullable: true },
    start: {type: 'date' },
    // Null --> indefinite embargo period
    end: { type: 'date', nullable: true }
}, {
    getDatesForDisplay: function() {
        return (this.end ?
            new XDate(this.start).toString("dd MMM yyyy")+" - "+new XDate(this.end).toString("dd MMM yyyy") :
            "Indefinite embargo period");
    },
    isActive: function() {
        return (!this.end || (new XDate(this.end).diffDays(new XDate().clearTime) < 0));
    },
    getLengthInMonths: function() {
        if(this.end) {
            return new XDate(this.start).diffMonths(new XDate(this.end));
        }
    }
});

var getEmbargoData = P.getEmbargoData = function(output) {
    var q = P.db.embargoes.select().where("object", "=", output.ref).order("desc", true);
    if(q.count()) {
        return q;
    }
};

var hasEmbargoedFilesForUser = function(user, object) {
    var embargoes = getEmbargoData(object);
    var anyFilesEmbargoedForUser = false;
    _.each(embargoes, function(embargo) {
        if(embargo.isActive()) {
            if(embargo.desc) {
                if(!object.canReadAttribute(embargo.desc, user)) {
                    anyFilesEmbargoedForUser = true;
                }
            } else {
                object.every(function(v,d,q) {
                    if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                        if(!object.canReadAttribute(d, user)) { 
                            anyFilesEmbargoedForUser = true;
                        }
                    }
                });
            }
        }
    });
    return anyFilesEmbargoedForUser;
};

var setEmbargo = function(spec) {
    var object = spec.object.load();
    var existingEmbargo = getEmbargoData(object);
    if(existingEmbargo) { return; } // do something more interesting?
    var start;
    if(!!spec.start) {
        start = new Date(spec.start);
    } else if(object.first(A.PublicationDate)) {
        start = O.service("hres:repository:earliest_publication_date", object);
    } else {
        // Fallback to today
        start = new Date();
    }
    var end;
    if(spec.end) {
        end = new Date(spec.end);
    }
    var row = P.db.embargoes.create({
        object: object.ref,
        desc: spec.desc,
        licenseURL: spec.licenseURL || null,
        start: start,
        end: end || null
    });
    row.save();
    // need to also save a document so can see this info in UI
    var embargoLength = Math.floor(row.getLengthInMonths());
    var document = {
        embargoes: [{
            customStart: (new XDate(start)).toString("yyyy-MM-dd"),
            appliesTo: row.desc || "all",
            embargoLength: embargoLength ? embargoLength.toString() : "Indefinite",
            licenseURL: spec.licenseURL || ''
        }]
    };
    P.db.embargoDocuments.create({
        object: object.ref,
        document: JSON.stringify(document)
    }).save();
    relabelForEmbargoes(object);
};

// -------------------------------------------------------------------

var ATTR_TO_LABEL = {
    "hres:attribute:accepted-author-manuscript": Label.EmbargoAcceptedAuthorManuscript,
    "hres:attribute:published-file": Label.EmbargoPublishersVersion,
    "std:attribute:file": Label.EmbargoFile
};

var relabelForEmbargoes = P.relabelForEmbargoes = function(object) {
    // These are removed from the 'remove' list when they are later 'added'
    var changes = O.labelChanges().remove([
        Label.EmbargoAcceptedAuthorManuscript,
        Label.EmbargoPublishersVersion,
        Label.EmbargoFile,
        Label.EmbargoAllFiles
    ]);
    var embargoes = getEmbargoData(object);
    if(embargoes) {
        _.each(embargoes, function(embargo) {
            if(embargo.isActive()) {
                if(embargo.desc) {
                    var code = SCHEMA.getAttributeInfo(embargo.desc).code;
                    changes.add(ATTR_TO_LABEL[code]);
                } else {
                    changes.add(Label.EmbargoAllFiles);
                }
            }
        });
    }
    object.relabel(changes);
    O.service("std:reporting:update_required", "repository_items", [object.ref]);
};
