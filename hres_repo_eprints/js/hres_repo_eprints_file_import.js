/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.db.table("downloadedFiles", {
    url: { type:"text" },
    digest: { type:"text", nullable:true },
    error: { type:"text", nullable:true }
});

var CREDENTIAL_NAME = "Eprints admin account";

P.respond("GET,POST", "/do/hres-repo-eprints/fetch-file-urls", [
], function(E) {
    O.action("std:action:administrator_override").enforce();
    // attempt to load credential to loudly fail if it is not present
    const hasCredential = O.keychain.credential(CREDENTIAL_NAME);
    let document = {};
    let form = P.xmlForm.instance(document);
    form.choices("previousXmlFiles", P.getPreviousXmlFiles());
    form.update(E.request);
    if(form.complete) {
        P.data.urlFetchingStart = (new Date()).toString();
        O.background.run("hres_repo_eprints:fetch_file_urls", document);
        E.response.redirect("/do/hres-repo-eprints/download-files");
    }
    E.render({
        pageTitle: "Fetch file URLs",
        form: form,
        status: P.data.urlFetchingStatus
    }, "upload-xml");
});

var rowsWithoutFiles = function() {
    let urlsNotDownloaded = P.db.downloadedFiles.select().
        where("digest", "=", null);
    return urlsNotDownloaded;
};

var rowsNotAttempted = function() {
    return P.db.downloadedFiles.select().
        where("digest", "=", null).
        where("error", "=", null);
};

var IGNORE_FILES = ["lightbox.jpg", "preview.jpg", "medium.jpg", "small.jpg", "indexcodes.txt"];
var IGNORE_DESC_PREFIX = ["Generate index codes conversion from text to indexcodes", "Thumbnails conversion from"];

var ignoreDocument = P.ignoreDocument = function(docCursor) {
    let ignore = false;
    const main = docCursor.getTextOfFirstChildElementMaybe("main");
    const desc = docCursor.getTextOfFirstChildElementMaybe("formatdesc");
    if(main && desc) {
        if(_.contains(IGNORE_FILES, main)) {
            ignore = _.some(IGNORE_DESC_PREFIX, ignore => desc.startsWith(ignore));
        }
    }
    return ignore;
};

P.implementService("hres_repo_eprints:ignore_document", ignoreDocument);

P.backgroundCallback("fetch_file_urls", function(document) {
    O.impersonating(O.SYSTEM, () => {
        P.data.urlFetchingStatus = "RUNNING";
        let file;
        try {
            file = O.file(document.xmlFile.length ? document.xmlFile[0] : document.previousFile);
            P.data.fileForFileImport = file.digest;
            let cursor = O.xml.parse(file).cursor();
            if(!cursor.firstChildElementMaybe("eprints")) { return; }
            cursor.eachChildElement("eprint", (ec) => {
                const eprintStatus = ec.getTextOfFirstChildElement("eprint_status");
                if(eprintStatus !== "archive") {
                    return;
                }
                if(ec.firstChildElementMaybe("documents")) {
                    ec.eachChildElement("document", (dc) => {
                        if(!ignoreDocument(dc)) {
                            if(dc.firstChildElementMaybe("files")) {
                                dc.eachChildElement("file", (fc) => {
                                    const url = fc.getAttribute("id");
                                    const hasFile = P.db.downloadedFiles.select().
                                        where("url", "=", url).
                                        limit(1).count() > 0;
                                    if(!hasFile) {
                                        P.db.downloadedFiles.create({url: url}).save();
                                    }
                                });
                            }
                        }
                    });
                }
            });
            P.data.urlFetchingStatus = "DONE";
            P.data.urlFetchingEnd = (new Date()).toString();
        } catch(e) {
            P.data.urlFetchingStatus = "ERROR: "+e.message;
        }
    });
});

P.respond("GET,POST", "/do/hres-repo-eprints/download-files", [
], function(E) {
    O.action("std:action:administrator_override").enforce();
    // attempt to load credential to loudly fail if it is not present
    const hasCredential = O.keychain.credential(CREDENTIAL_NAME);
    if(E.request.method === "POST") {
        P.data.fileDownloadStart = (new Date()).toString();
        P.data.initialFilesDbCount = P.db.downloadedFiles.select().count();
        O.background.run("hres_repo_eprints:download_files", {});
        return E.response.redirect("/do/hres-repo-eprints/admin");
    }
    let confirmText = "The current status of fetching files is: " +
        P.data.urlFetchingStatus + ".\nThe current status of downloading files is: " +
        P.data.fileDownloadStatus + ".\nYou will be downloading " + 
        rowsWithoutFiles().count() + " files. Would you like to continue?";
    E.render({
        pageTitle: "Download files",
        text: confirmText,
        options: [{label: "Yes, download"}],
        backLink: "/do/hres-repo-eprints/fetch-file-urls"
    }, "std:ui:confirm");
});

P.backgroundCallback("download_files", function(data) {
    P.data.fileDownloadStatus = "RUNNING";
    const rows = rowsWithoutFiles();
    _.each(rows, (row) => {
        O.httpClient(row.url).
            useCredentialsFromKeychain(CREDENTIAL_NAME).
            request(Download, { rowId: row.id });
    });
});

var Download = P.callback("download", function(data, client, response) {
    const row = P.db.downloadedFiles.select().where("id", "=", data.rowId)[0];
    const url = row.url;
    if(response.successful) {
        let file;
        try {
            if(response.body.mimeType === "text/html") {
                console.log("WARNING: file with url " + url +
                    " may not have been downloaded correctly, html mimeType detected.");
            }
            file = O.file(response.body);
        } catch(e) {
            P.data.fileDownloadStatus = "ERROR: one or more files may not have been downloaded";
            row.error = e.message;
            row.save();
        }
        if(file) {
            row.digest = file.digest;
            row.save();
        }
    } else {
        console.log("Unsuccessful download of", url);
        console.log(response.errorMessage);
        console.log(response.body.readAsString("UTF-8"));
        P.data.fileDownloadStatus = "ERROR, unsuccessful download of "+url+". Message: "+response.errorMessage;
    }
    if(rowsNotAttempted().count() === 0) {
        P.data.fileDownloadEnd = (new Date()).toString();
    }
});

P.respond("GET,POST", "/do/hres-repo-eprints/admin/file-url-lookup", [
    {parameter:"lookup", as:"string"}
], function(E, url) {
    O.action("std:action:administrator_override").enforce();

    const query = P.db.downloadedFiles.select().where('url', '=', url).limit(1);
    let file;
    if(query.count() === 1 && query[0].digest) {
        file = O.file(query[0].digest);
    }
    // if it now has a digest, assume it has since been successfully downloaded
    let notDownloadedWithErrors = P.db.downloadedFiles.select().
        where("error", "<>", null).
        where("digest", "=", null);
    let filesWithErrors = _.map(notDownloadedWithErrors, row => {
        return {
            url: row.url,
            error: row.error
        };
    });
    E.render({
        file: file,
        url: url,
        notDownloaded: query.count() === 1 && !query[0].digest,
        haveFilesWithErrors: filesWithErrors.length,
        filesWithErrors: filesWithErrors
    });
});

P.respond("GET", "/do/hres-repo-eprints/urls-without-files", [
], function(E) {
    if(!O.currentUser.isSuperUser) { O.stop("Not permitted."); }
    let rows = rowsWithoutFiles();
    E.render({
        rows: rows
    });
});
