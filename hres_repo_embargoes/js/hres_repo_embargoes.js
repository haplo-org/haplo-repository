/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var ADDITIONAL_ACTION_PANELS = O.application.config["hres_repo_embargoes:display_additional_action_panels"] || [];

var CanEditEmbargoes = P.CanEditEmbargoes = O.action("hres_repo_embargoes:can_edit").
    title("Can edit embargoes").
    allow('group', Group.RepositoryEditors);

// -------------------------------------------------------------------

/*HaploDoc
node: /repository/hres_repo_embargoes/implementation
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
|@groupExtension@|@int@|The extension of the attribute group this embargo applies to (if applicable)|Yes|
|@desc@|@int@|The attribute that this embargo applies to (applies to all if null)|Yes|
|@licenseURL@|@text@|The license that applies to this file when under embargo|Yes|
|@start@|@date@|The start date of this embargo||
|@end@|@date@|The end date of this embargo|Yes|
*/
P.implementService("hres_repo_embargoes:get_embargo", function(output) {
    return getEmbargoData(output);
});

/*HaploDoc
node: /repository/hres_repo_embargoes/implementation
sort: 7
--

h3(service). ("hres_repo_embargoes:has_embargoed_files_for_user", user, output)

Returns @true@ if any files are embargoed on this output for this user.
*/
P.implementService("hres_repo_embargoes:has_embargoed_files_for_user", function(user, output) {
    return hasEmbargoedFilesForUser(user, output);
});

/*HaploDoc
node: /repository/hres_repo_embargoes/implementation
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

P.hook("hObjectAttributeRestrictionLabelsForUser", function(response, user, object, container) {
    if(O.serviceMaybe("hres:repository:is_author", user, container)) {
        response.userLabelsForObject.add(Label.LiftAllEmbargoRestrictions);
    }
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
    // If using the feature then UI will be handled there.
    if(P.objectWorkflowIsUsingFeature(display.object)) { return; }
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

_.each(ADDITIONAL_ACTION_PANELS, (panelName) => {
    P.implementService("std:action_panel:"+panelName, function(display, builder) {
        fillPanel(display, builder);
    });
});

P.implementService("std:action_panel:output", function(display, builder) {
    var output = display.object;
    // If using the feature then UI will be handled there.
    if(P.objectWorkflowIsUsingFeature(output)) { return; }
    if(O.application.config["hres_repo_embargoes:sherpa_romeo_enable_for_articles_only"] &&
        !output.isKindOf(T.JournalArticle)) { return; }
    builder.panel("hres:repository_item:embargo").
        link("bottom", "/do/hres-repo-embargoes/sherpa-information/"+output.ref, "View archiving guidance");
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
    isActive: function(onDay) {
        if(!onDay) { onDay = new XDate().clearTime(); }
        return (!this.end || (new XDate(this.end).diffDays(onDay) <= 0));
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
    var document = {
        all: {},
        embargoes: []
    };
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
            document.embargoes.push(updated);
        }
    } else {
        document.all = updated;
    }
    P.db.embargoDocuments.create({
        object: object.ref,
        document: JSON.stringify(document)
    }).save();
    P.saveEmbargoData(object, document);
    relabelForEmbargoes(object);
};

// -------------------------------------------------------------------

var liftEmbargoesDaily = P.liftEmbargoesDaily = function(onDay) {
    var ending = P.db.embargoes.select().
        where('end', '<', onDay || new XDate().clearTime().toDate());
    if(P.data['lastLiftedEmbargoes']) {
        var lastLiftedEmbargoes = new XDate(P.data['lastLiftedEmbargoes']); 
        ending.where('end', '>', lastLiftedEmbargoes.clearTime().addDays(-1).toDate());
    }
    var updated = O.refdict();
    _.each(ending, (embargo) => {
        if(!updated.get(embargo.object)) {
            var embargoedObject = embargo.object.load();
            relabelForEmbargoes(embargoedObject, onDay);
            updated.set(embargo.object, true);
            O.serviceMaybe("haplo:integration-global-observation:send-update-for-object", embargoedObject, {
                action: "hres:repository:embargo-lifted"
            });
        }
    });
    P.data['lastLiftedEmbargoes'] = (new Date()).toString();
};
P.hook('hScheduleDailyEarly', function(response, year, month, dayOfMonth, hour, dayOfWeek) {
    liftEmbargoesDaily();
});

var shouldLabelAttributeGroupObject = P.shouldLabelAttributeGroupObject = function(container, groupId, onDay) {
    var shouldLabel = false;
    if(container.ref) {
        var q = getEmbargoData(container);
        if(q) {
            q.or(function(sq) {
                sq.where("extensionGroup", "=", groupId).
                    where("extensionGroup", "=", null);
            }).each(function(embargo) {
                if(embargo.isActive(onDay)) {
                    shouldLabel = true;
                }
            });
        }
    }
    return shouldLabel;
};
P.hook("hLabelAttributeGroupObject", function(response, container, object, desc, groupId) {
    // This will be removed from the 'remove' list if it is later 'added'
    response.changes.remove(Label.EmbargoAllFiles);
    if(shouldLabelAttributeGroupObject(container, groupId)) {
        response.changes.add(Label.EmbargoAllFiles);
    }
});

var relabelForEmbargoes = P.relabelForEmbargoes = function(object, onDay) {
    // This is removed from the 'remove' list if it is later 'added'
    var changes = O.labelChanges().remove([Label.EmbargoAllFiles]);
    var q = getEmbargoData(object);
    if(q) {
        // Per-file embargoes are dealt with by indexing and the hLabelAttributeGroupObject hook above
        q.where("extensionGroup", "=", null).each(function(embargo) {
            if(embargo.isActive(onDay)) {
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

// --------------------------------------------------------------------------
// Force relabelling of all obects with embargoes - used mostly for migration

P.respond("GET,POST", "/do/hres-repo-embargoes/admin/reapply-embargo-labels", [
], function(E) {
    if(!O.currentUser.isSuperUser) { O.stop("Not permitted."); }
    if(E.request.method === "POST") {
        P.data['lastLiftedEmbargoes'] = undefined;
        liftEmbargoesDaily(new XDate().toDate());
        E.response.redirect("/");
    }
    E.render({
        pageTitle: "Re-apply all embargo labels",
        text: "Do you want to force re-apply embargo labels for all items with embargoes? This will "+
            "ensure embargo labels are correct according to the data in the underlying database.",
        options: [{label: "Confirm"}]
    }, "std:ui:confirm");
});

// --------------------------------------------------------------------------
// Adding serialisation source

P.implementService("std:serialiser:discover-sources", function(source) {
    source({
        name: "hres:repository:embargoes",
        sort: 2040,
        setup: function() { },
        apply: function(serialiser, object, serialised) {
            if(object.isKindOfTypeAnnotated("hres:annotation:repository-item")) {
                var embargoes = serialised["repository_embargoes"] = _.chain(getEmbargoData(object)).
                    filter(function(embargo) { return embargo.isActive(); }).
                    map((function(embargo) {
                        return {
                            wholeRecord: !embargo.extensionGroup,
                            extension: {
                                groupId: embargo.extensionGroup,
                                desc: embargo.desc
                            },
                            licenseURL: embargo.licenseURL ?
                                P.template("url/safe-license-url").render(embargo.licenseURL) :
                                null,
                            start: embargo.start,
                            end: embargo.end
                        };
                    })).
                    value();
            }
        }
    });
});