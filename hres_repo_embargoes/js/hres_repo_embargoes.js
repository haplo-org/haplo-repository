/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CanEditEmbargoes = P.CanEditEmbargoes = O.action("hres_repo_embargoes:can_edit").
    title("Can edit embargoes").
    allow('group', Group.RepositoryEditors);

// -------------------------------------------------------------------

/*HaploDoc
node: /hres_repo_embargoes
title: Embargoes
sort: 1
--

This plugin provides the functionality to apply publisher-mandated embargoes to files \
in the repository. These can be applied on a per-attribute basis (not yet per-file, sadly) \
which restricts them from public view.

The services which allow other plugins to query or set embargoes are:


h3(service). ("hres_repo_embargoes:get_embargo", output)

Performs a database query for any embargo entries for this output. Returns the databaseQuery result, \
or @undefined@ if no embargoes are found. 

Database rows contain:

|*Field*|*Type*||*Nullable*|
|@object@|@ref@|The ref of the output||
|@desc@|@int@|The attribute that this embargo applies to (applies to all if null)|Yes|
|@licenseURL@|@text@|The license that applies to this file when under embargo|Yes|
|@start@|@date@|The start date of this embargo||
|@end@|@date@|The end date of this embargo|Yes|
*/
P.implementService("hres_repo_embargoes:get_embargo", function(output) {
    return getEmbargoData(output);
});

/*HaploDoc
node: /hres_repo_embargoes
sort: 7
--

h3(service). ("hres_repo_embargoes:has_embargoed_files_for_user", user, output)

Returns @true@ if any files are embargoed on this output for this user.
*/
P.implementService("hres_repo_embargoes:has_embargoed_files_for_user", function(user, output) {
    return hasEmbargoedFilesForUser(user, output);
});

/*HaploDoc
node: /hres_repo_embargoes
sort: 4
--

h3(service). ("hres_repo_embargoes:set_embargo", specification)

Allows other plugins to set embargoes one at a time (ie. for one file/just the whole embargo) without affecting \
other embargoes saved for @specification.object@. Specification should contain:

| object | Ref of the object to save the embargo for | required |
| extensionGroup | The extension group number the embargo applies to, or empty to set a whole embargo | optional |
| desc | The attribute the embargo applies to (currently used for the sake of displaying on the record) | optional |
| customStart | Date string as YYYY-MM-DD for a custom embargo start* | optional |
| embargoLength | The length in integer months the embargo should last for, or "Indefinite" | required if end not set |
| end | Date string for a custom embargo end date | required if embargoLength not set |
| licenseURL | String URL for the license that applies during the embargo | optional |

*/
P.implementService("hres_repo_embargoes:set_embargo", function(spec) {
    setSingleEmbargo(spec);
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

P.implementService("haplo_alternative_versions:update_database_information", function(fromObject, toObject) {
    var needsRelabel = false;
    var oldEmbargoes = getEmbargoData(toObject);
    if(oldEmbargoes) {
        oldEmbargoes.deleteAll();
        needsRelabel = true;
    }
    var newEmbargoes = getEmbargoData(fromObject);
    if(newEmbargoes) {
        _.each(newEmbargoes, (em) => {
            P.db.embargoes.create({
                object: toObject.ref,
                desc: em.desc,
                licenseURL: em.licenseURL,
                start: em.start,
                end: em.end
            }).save();
        });
        needsRelabel = true;
    }
    if(needsRelabel) {
        relabelForEmbargoes(toObject);
    }
});

// -------------------------------------------------------------------

P.implementService("std:action_panel_priorities", function(priorities) {
    _.extend(priorities, {
        "hres:repository_item:embargo": 150,
    });
});

var fillPanel = function(display, builder, preventEdit) {
    var embargoes = getEmbargoData(display.object);
    if(embargoes) {
        var anyIsActive = _.some(embargoes, (e) => { return e.isActive(); });
        builder.panel("hres:repository_item:embargo").element(0, {title: anyIsActive ? "Under embargo" : "Embargo over"});
        _.each(embargoes, function(embargo) {
            var text = embargo.getDatesForDisplay();
            if(embargo.desc) {
                text = text+" ("+SCHEMA.getAttributeInfo(embargo.desc).name+")";
            } else {
                text = text+" (Whole record)";
            }
            builder.panel("hres:repository_item:embargo").link(1, embargo.licenseURL, text);
        });
    }
    if(O.currentUser.allowed(CanEditEmbargoes) && !preventEdit) {
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
P.implementService("std:action_panel:alternative_versions", function(display, builder) {
    fillPanel(display, builder, true);
});

P.implementService("std:action_panel:output", function(display, builder) {
    var output = display.object;
    if(O.application.config["hres_repo_embargoes:sherpa_romeo_enable_for_articles_only"] &&
        !output.isKindOf(T.JournalArticle)) { return; }
    var panel = builder.panel(155);
    panel.element(0, { title: "Archiving guidance" });
    var q = P.db.sherpaArchivingData.select().where('object', '=', output.ref);
    if(q.length) {
        _.each(q[0].data.publishers, (p) => {
            panel.element(10, { label: p.name });
            _.each(p.archiving, (a) => {
                panel.element(10, { label: _.capitalize(a) });
            });
        });
    }
    panel.link(20,
        "/do/hres-repo-embargoes/sherpa-information/"+output.ref,
        (q.length ? "More" : "Get")+" information",
        "default");
});

// -------------------------------------------------------------------

P.db.table('embargoes', {
    object: { type: 'ref' },
    // Null --> Applies to all files
    extensionGroup: { type: 'int', nullable: true },
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
    var q = P.db.embargoes.select().where("object", "=", output.ref).order("extensionGroup", true);
    if(q.count()) {
        return q;
    }
};

var hasEmbargoedFilesForUser = function(user, object) {
    var embargoes = getEmbargoData(object);
    var anyFilesEmbargoedForUser = false;
    var objectGroups = object.extractAllAttributeGroups();
    _.each(embargoes, function(embargo) {
        if(embargo.isActive()) {
            if(embargo.extensionGroup) {
                var group = _.find(objectGroups.groups, function(g) {
                    return (g.extension.groupId === embargo.extensionGroup);
                });
                // The group may not be on the object, if an attribute that is embargoed is later deleted
                if(group) {
                    group.object.every(function(v,d,q) {
                        if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                            if(!group.object.canReadAttribute(d, user)) { 
                                anyFilesEmbargoedForUser = true;
                            }
                        }
                    });
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

var setSingleEmbargo = function(spec) {
    if(!spec.object) {
        throw new Error("Must specify object to embargo");
    }
    var object = O.isRef(spec.object) ? spec.object.load() : spec.object;
    var document = {};
    // assume the id only ever goes up, so ordering by id descending will get the latest row first
    var existingDocumentQuery = P.db.embargoDocuments.select().where("object", "=", object.ref).order("id", true);
    if(existingDocumentQuery.length) {
        document = JSON.parse(existingDocumentQuery[0].document);
        existingDocumentQuery.deleteAll();
    }
    // if neither end nor length are specified, then set indefinite embargo,
    // else save the passed in embargoLength to document
    var embargoLength = spec.embargoLength;
    if(!spec.end && !spec.embargoLength) {
        embargoLength = "Indefinite";
    }
    var updated = {
        customStart: spec.customStart,
        embargoLength: embargoLength,
        end: spec.end,
        licenseURL: spec.licenseURL
    };
    if(spec.extensionGroup) {
        updated.groupId = spec.extensionGroup;
        updated.desc = spec.desc;
        var updatedExisting = false;
        _.each(document.embargoes, function(em) {
            if(updatedExisting) { return; }
            if(em.groupId === spec.extensionGroup) {
                em = updated;
                updatedExisting = true;
            }
        });
        if(!updatedExisting) {
            if(!document.embargoes) { document.embargoes = []; }
            document.embargoes.push(updated);
        }
    } else {
        document.all = updated;
    }
    if(!document.all) { document.all = {}; }
    P.db.embargoDocuments.create({
        object: object.ref,
        document: JSON.stringify(document)
    }).save();
    P.saveEmbargoData(object, document);
    relabelForEmbargoes(object);
};

// -------------------------------------------------------------------

P.hook("hLabelAttributeGroupObject", function(response, container, object, desc, groupId) {
    // This will be removed from the 'remove' list if it is later 'added'
    response.changes.remove(Label.EmbargoAllFiles);
    if(container.ref) {
        var q = getEmbargoData(container);
        if(q) {
            q.or(function(sq) {
                sq.where("extensionGroup", "=", groupId).
                    where("extensionGroup", "=", null);
            }).each(function(embargo) {
                if(embargo.isActive()) {
                    response.changes.add(Label.EmbargoAllFiles);
                }
            });
        }
    }
});

var relabelForEmbargoes = P.relabelForEmbargoes = function(object) {
    // This is removed from the 'remove' list if it is later 'added'
    var changes = O.labelChanges().remove([Label.EmbargoAllFiles]);
    var q = getEmbargoData(object);
    if(q) {
        // Per-file embargoes are dealt with by indexing and the hLabelAttributeGroupObject hook above
        q.where("extensionGroup", "=", null).each(function(embargo) {
            if(embargo.isActive()) {
                changes.add(Label.EmbargoAllFiles);
            }
        });
    }
    object.relabel(changes);
    object.reindex();   // to trigger hLabelAttributeGroupObject hook
    O.service("std:reporting:update_required", "repository_items", [object.ref]);
};

// --------------------------------------------------------------------------
// Testing

P.respond("GET", "/do/hres-repo-embargoes/embargo-count", [
], function(E) {
    O.action("std:action:administrator_override").enforce();
    E.response.body = P.db.embargoes.select().count().toString();
});
