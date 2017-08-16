/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var EMAIL_LINK_EXPIRATION_DAYS = 1;

var getFilesForRelease = function(M) {
    var item = O.ref(M.workUnit.tags["ref"]).load();
    var storeInstance = P.AccessRequest.documentStore.filePreparation.instance(M);
    var files;
    if(storeInstance.hasCommittedDocument) {
        var document = storeInstance.lastCommittedDocument;
        files = P.getFilesFromDocument(document);
    } else {
        files = P.getPreviouslyPreparedFilesForItem(item);
    }
    // If no preparation requred, release files from object directly
    if(!files) {
        files = [];
        item.every(function(v,d,q) {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                files.push(O.file(v));
            }
        });
    }
    return files;
};

P.AccessRequest.observeEnter({state:"access_granted"}, function(M, transition, previousState) {
    // Send Email with download link
    var files = getFilesForRelease(M);
    var releaseDetails = 
    M.workUnit.data.released = {};
    _.each(files, function(f) {
        M.workUnit.data.released[f.digest] = O.service("hres_repo_access_request:file_download_details", f);
    });
    M.workUnit.save();

    var submitter = P.getSubmitterDetails(M);
    var email = {
        template: "email/access_granted",
        view: {
            item: O.ref(M.workUnit.tags["ref"]),
            downloads: _.map(M.workUnit.data.released, function(details, digest) {
                return {
                    name: O.file(digest).filename,
                    url: details.url
                };
            })
        }
    };
    var send = ("nameFirst" in submitter) ? "toExternal": "to";
    email[send] = [submitter];
    if(previousState === "author_or_frd_review") {
        email.cc = [Group.RepositoryEditors];
    }
    M.sendEmail(email);
});

P.AccessRequest.observeEnter({state:"rejected"}, function(M, transition, previousState) {
    var submitter = P.getSubmitterDetails(M);
    var email = {
        template: "email/rejected",
        view: {
            item: O.ref(M.workUnit.tags["ref"]),
            repositoryTeamEmail: O.group(Group.RepositoryEditors).email
        }
    };
    var send = ("nameFirst" in submitter) ? "toExternal": "to";
    email[send] = [submitter];
    M.sendEmail(email);
});

// --------------------------------------------------------------------

P.implementService("hres_file_mediated_access:release_file_for_download", function(fileDigest, secret) {
    var allow = false;
    var wus = O.work.query("hres_repo_access_request:ar").
        isClosed();
    _.each(wus, function(workUnit) {
        if(
            workUnit.data.released &&
            fileDigest in workUnit.data.released &&
            workUnit.data.released[fileDigest].secret === secret &&
            new XDate(workUnit.closedAt).diffDays(new XDate()) < EMAIL_LINK_EXPIRATION_DAYS
            ) {
            allow = true;
        }
    });
    return allow;
});
