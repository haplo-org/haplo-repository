/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.getSubmitterDetails = function(M) {
    // External details needs to have keys: name, nameFirst, email
    return (M.workUnit.data && M.workUnit.data.isPublicRequest) ? 
        JSON.parse(P.db.requestDocuments.select().where("workUnit", "=", M.workUnit.id)[0].document) :
        M.workUnit.createdBy;
};

var getFilesFromDocument = P.getFilesFromDocument = function(document) {
    return _.map(document.files, function(d) {
        return O.file(d.prepared.digest);
    });
};

var getPreviouslyPreparedFilesForItem = P.getPreviouslyPreparedFilesForItem = function(item) {
    var wus = O.work.query("hres_repo_access_request:ar").
        tag("ref", item.ref.toString()).
        isClosed();
    var M, storeInstance, document;
    // Order is important
    for(var i = 0; i < wus.length; i++) {
        M = P.AccessRequest.instance(wus[i]);
        storeInstance = P.AccessRequest.documentStore.filePreparation.instance(M);
        if(storeInstance.hasCommittedDocument) {
            document = storeInstance.lastCommittedDocument;
            return getFilesFromDocument(document);
        }
    }
};

// -----------------------------------------

var CanViewPreparedFiles = O.action("hres_repo_access_request:view_prepared_files").
    title("View prepared files on object record").
    allow("group", Group.DataPreparers).
    allow("group", Group.RepositoryEditors);

P.hook('hPreObjectDisplay', function(response, object) {
    if(O.currentUser.allowed(CanViewPreparedFiles)) {
        var preparedFiles = getPreviouslyPreparedFilesForItem(object);
        if(preparedFiles) {
            var r = response.replacementObject || object.mutableCopy();
            _.each(preparedFiles, function(file) {
                r.append(file.identifier(), A.PreparedFile);
            });
            response.replacementObject = r;
        }
    }
});

// -----------------------------------------

P.implementService("std:action_panel:repository_item", function(display, builder) {
    var wus = O.work.query("hres_repo_access_request:ar").
        tag("ref", display.object.ref.toString()).
        isEitherOpenOrClosed();
    if(wus.length) {
        var panel = builder.panel(1000);
        panel.element(0, {title: "Access Requests"});
        _.each(wus, function(wu) {
            var M = P.AccessRequest.instance(wu);
            var submitter = P.getSubmitterDetails(M);
            var url = canViewAccessRequest(M, O.currentUser) ? M.url : "";
            var text = M.workUnit.closed ? 
                (M.state === "rejected" ? "(Declined) " : "") :
                "(Pending) ";
            text = text+submitter.name;
            panel.link(100, url, text);
        });
    }
});

// -------------------------------------------

P.implementService("hres_repo_access_level_policy:access_redirect_path", function(file) {
    var objects = O.query().identifier(file.identifier()).execute();
    if(objects.length) {
        // TODO: Fix this assumption
        var object = objects[0];
        return "/do/hres-repo-access-request/start/"+object.ref.toString();
    }
});

// -------------------------------------------

var canViewAccessRequest = function(M, user) {
    return user.allowed(CanViewPreparedFiles) ||
        O.serviceMaybe("hres:repository:is_author", O.currentUser, O.ref(M.workUnit.tags["ref"]).load()) ||
        M.workUnit.createdBy.id === user.id;
};

P.respond("GET", "/do/hres-repo-access-request/application", [
    {pathElement:0, as:"workUnit", allUsers:true}
], function(E, workUnit) {
    var M = P.AccessRequest.instance(workUnit);
    if(!canViewAccessRequest(M, O.currentUser)) { O.stop("Not permitted."); }
    var document = JSON.parse(P.db.requestDocuments.select().where("workUnit", "=", workUnit.id)[0].document);
    var builder = O.ui.panel();
    M.fillActionPanel(builder);
    E.renderIntoSidebar(builder.deferredRender(), "std:render");
    var form = M.workUnit.data.isPublicRequest ? P.publicRequestForm : P.requestForm;
    E.render({
        item: O.ref(workUnit.tags["ref"]).load(),
        requester: P.getSubmitterDetails(M),
        form: form.instance(document),
        status: M._getText(['status'], [M.state]),
        timeline: M.renderTimelineDeferred()
    });
});
