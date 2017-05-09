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

// -------------------------------------------------------------------

// TODO: Extend schema annotations to be applicable to attributes?
var FILE_ATTRIBUTES = [
    A.File,
    A.AcceptedAuthorManuscript,
    A.PublishersVersion
];

var removeEmbargoedFiles = function(response, object, forDisplay) {
    if(O.serviceMaybe("hres:repository:is_repository_item", object) &&
        !(O.currentUser.allowed(CanEditEmbargoes) ||
          O.serviceMaybe("hres:repository:is_author", O.currentUser, object))) {
        var embargo = getEmbargoData(object);
        if(embargo && embargo.isUnderEmbargo()) {
            var r = response.replacementObject || object.mutableCopy();
            _.each(FILE_ATTRIBUTES, function(desc) {
                if(object.first(desc)) {
                    r.remove(desc);
                    if(forDisplay) {
                        r.append(O.text(O.T_TEXT, "File under embargo"), desc);
                    }
                }
            });
            response.replacementObject = r;
        }
    }
};

P.hook('hPreIndexObject', function(response, object) {
    removeEmbargoedFiles(response, object, false);
});
P.hook('hPreObjectDisplay', function(response, object) {
    removeEmbargoedFiles(response, object, true);
});

P.implementService("std:action_panel:repository_item", function(display, builder) {
    var embargo = getEmbargoData(display.object);
    if(embargo) {
        builder.panel(1).element(0, {title:"Embargo"});
        builder.panel(1).link("default", embargo.licenseURL, embargo.getDatesForDisplay());
    }
    if(O.currentUser.allowed(CanEditEmbargoes)) {
        builder.panel(1).link("default", "/do/hres-repo-embargoes/edit/"+display.object.ref,
            (!!embargo ? "Edit" : "Set")+" embargo");
    }
});

// -------------------------------------------------------------------

P.db.table('embargoes', {
    object: { type: 'ref' },
    // Default to REF all rights reserved url
    licenseURL: { type: 'text' },
    start: {type: 'date' },
    startIsEdited: {type: 'boolean'},
    // Null --> indefinite embargo period
    embargoLength: { type: 'int', nullable: true }
}, {
    getEndDate: function() {
        if(this.embargoLength) {
            return new XDate(this.start).addMonths(this.embargoLength);
        }
    },
    getDatesForDisplay: function() {
        var end = this.getEndDate();
        return (end ?
            new XDate(this.start).toString("dd MMM yyyy")+" - "+end.toString("dd MMM yyyy") :
            "Indefinite embargo period");
    },
    isUnderEmbargo: function() {
        var end = this.getEndDate();
        return (!end || (end.diffDays(new XDate().clearTime) < 0));
    }
});

var getEmbargoData = P.getEmbargoData = function(output) {
    var q = P.db.embargoes.select().where("object", "=", output.ref).order("id", true).limit(1);
    if(q.length) {
        return q[0];
    }
};
