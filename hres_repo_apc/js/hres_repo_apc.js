/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

var apcForm = P.form("apc_form", "form/apc_form.json");
var apcPaymentDetailsForm = P.form("apc_payment_details_form", "form/apc_payment_details_form.json");

var standaloneEntities = P.hresCombinedApplicationStandaloneEntities();

var EditAPCForm = O.action("hres_repo_apc:edit_form").
    title("Edit publication APC form").
    allow("group", Group.RepositoryEditors);

var canEditAPCForm = function(output) {
    return O.currentUser.allowed(EditAPCForm);
};
var canViewAPCForm = function(output) {
    var entities = standaloneEntities.constructEntitiesObject(output);
    var heads = entities.facultyHead_refList;

    return canEditAPCForm(output) || _.reduce(heads, function(memo, head) {
        return memo || O.currentUser.ref == head;
    }, false);
};

P.apcFormStore = P.defineDocumentStore({
    name: "apc",
    keyToKeyId: function(key) {
        return key.ref;
    },
    formsForKey: function(key) {
        return [apcForm, apcPaymentDetailsForm];
    },
    keyIdType: "ref",
    shouldDisplayForm: function(key, form, document) {
        if(form.formId === "apc_form") {
            return canViewAPCForm(key);
        }
        if(form.formId === "apc_payment_details_form") {
            return O.currentUser.isMemberOf(Group.RepositoryEditors);
        }
    },
    shouldEditForm: function(key, form, document) {
        if(form.formId === "apc_form") {
            return canEditAPCForm(key);
        }
        if(form.formId === "apc_payment_details_form") {
            return O.currentUser.isMemberOf(Group.RepositoryEditors);
        }
    },
    blankDocumentForKey: function(key) {
        var doc = {};
        doc.xeLink = P.template("xe").render({url: "http://www.xe.com/"});
        return doc;
    }
});

P.respond("GET,POST", "/do/hres-repo-apc/edit_apc_form", [
    {pathElement:0, as:"object" }
], function(E, output) {
    if(!canEditAPCForm(output)) {
        O.stop("Not permitted");
    }
    var instance = P.apcFormStore.instance(output);
    instance.handleEditDocument(E, {
        finishEditing: function(instance, E, complete) {
            if(complete) {
                instance.commit();
                O.service("std:reporting:update_required", "repository_items", [output.ref]);
            }
            var redirect = O.serviceMaybe("hres_repo_apc:redirect_after_edit", output);
            E.response.redirect(redirect || output.url());
        },
        gotoPage: function(instance, E, formId) {
            E.response.redirect("/do/hres-repo-apc/edit_apc_form/"+output.ref+"/"+formId);
        },
        render: function(instance, E, html) {
            E.render({
                output: output,
                outputUrl: output.url(),
                deferredForm: html
            });
        }
    }); 
});

P.respond("GET", "/do/hres-repo-apc/view_apc_form",[
    {pathElement:0, as:"object" }
], function(E, output) {
    if(!canViewAPCForm(output)) {
        O.stop("Not permitted");
    }
    var instance = P.apcFormStore.instance(output);
    var document = instance.currentDocument;
    
    var ui = instance.makeViewerUI(E, {
        showCurrent: true,
        uncommittedChangesWarningText: false
    });
    if(canEditAPCForm(output)) {
        var indicator = instance.currentDocumentIsComplete ?
                "standard" :
                "primary";
        E.appendSidebarHTML(P.template("std:ui:panel").render({
            elements: [{
                href: "/do/hres-repo-apc/edit_apc_form/"+output.ref,
                label: "Edit",
                indicator: indicator
            }]
        }));
    }
    E.appendSidebarHTML(ui.sidebarHTML);
    E.render({
        output: output,
        outputUrl: output.url(),
        ui: ui
    });
});

P.implementService("std:action_panel:category:hres:repository_item", function(display, builder) {
    if(canViewAPCForm(display.object)&&
        display.object.first(A.OpenAccess) &&
        display.object.first(A.OpenAccess).behaviour === "hres:list:open-access:gold") {
        var highlight;
        if(canEditAPCForm(display.object) &&
            !P.apcFormStore.instance(display.object).currentDocumentIsComplete) {
            highlight = "primary";
        }
        builder.panel(150).link("default", "/do/hres-repo-apc/view_apc_form/"+display.object.ref.toString(), "APC", highlight);
    }
});


P.hook('hPostObjectEdit', function(response, object, previous) {
    if(!previous && 
        O.serviceMaybe("hres:repository:is_repository_item", object) && 
        canEditAPCForm(object) &&
        object.first(A.OpenAccess) &&
        object.first(A.OpenAccess).behaviour === "hres:list:open-access:gold") {
        response.redirectPath = "/do/hres-repo-apc/edit_apc_form/"+object.ref;
    }
});