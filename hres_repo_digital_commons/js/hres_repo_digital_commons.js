/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var AdminAction = O.action("std:action:administrator_override");
var FileUploadForm = P.form("fileUpload", "form/file_upload.json");

P.LEGACY_APPLICATION = O.application.config["hres_repo_digital_commons:legacy_system_hostname"];
P.FILE_WEB_SERVER = O.application.config["hres_repo_digital_commons:file_server_hostname"];

P.respond("GET", "/do/hres-repo-digital-commons/admin", [
], function(E) {
    AdminAction.enforce();
    const recentLogs = P.db.importLogging.select().order("id", true).limit(5);
    const recentLogSummary = _.map(recentLogs, (row) => {
        return {
            id: row.id,
            filename: row.digest ? O.file(row.digest).filename : undefined,
            date: new XDate(row.log.start).toString("MMM dd yyyy HH:mm:ss"),
            status: row.status
        };
    });
    const recentFileLogs = P.db.fileLogging.select().order("id", true).limit(5);
    const recentFilesLogSummary = _.map(recentFileLogs, (row) => {
        return {
            id: row.id,
            status: row.status,
            start: row.start ? new XDate(row.start).toString("MMM dd yyyy HH:mm:ss") : "",
            end: row.end ? new XDate(row.end).toString("MMM dd yyyy HH:mm:ss") : ""
        };
    });
    E.render({
        recentLogSummary: recentLogSummary,
        recentFilesLogSummary: recentFilesLogSummary
    });
});

P.respond("GET,POST", "/do/hres-repo-digital-commons/fetch-files", [
], function(E) {
    AdminAction.enforce();
    let document = {};
    let form = FileUploadForm.instance(document);
    form.choices("previousUploadedFiles", getPreviousUploadedFiles());
    form.update(E.request);
    if(form.complete) {
        O.background.run("hres_repo_digital_commons:fetch_files", document);
        return E.response.redirect("/do/hres-repo-digital-commons/admin");
    }
    E.render({
        pageTitle: "Fetch file URLs",
        form: form
    }, "upload-file");
});

P.respond("GET,POST", "/do/hres-repo-digital-commons/import-metadata", [
], function(E) {
    AdminAction.enforce();
    let document = {};
    let form = FileUploadForm.instance(document);
    form.choices("previousUploadedFiles", getPreviousUploadedFiles());
    form.update(E.request);
    if(form.complete) {
        O.background.run("hres_repo_digital_commons:import", document);
        E.response.redirect("/do/hres-repo-digital-commons/admin");
    }
    E.render({
        pageTitle: "Digital Commons import",
        form: form
    }, "upload-file");
});


var getPreviousUploadedFiles = function() {
    let files = [];
    if(P.data.filesForFileImport) {
        files = P.data.filesForFileImport;
    }
    let metadataLogs = P.db.importLogging.select().
        where("digest", "<>", null).
        order("id", true);
    metadataLogs.each((log) => {
        if(files.indexOf(log.digest) === -1) {
            files.push(log.digest);
        }
    });
    return _.map(files, digest => {
        let file = O.file(digest);
        return [digest, file.filename];
    });
};

P.respond("GET", "/do/hres-repo-digital-commons/log", [
    {pathElement:0, as:"db", table:"importLogging"}
], function(E, row) {
    AdminAction.enforce();
    let file = row.digest ? O.file(row.digest) : undefined;
    E.render({
        log: JSON.stringify(row.log, undefined, 2),
        file: file ? { name: file.filename, url: file.url() } : undefined,
        row: row.id
    });
});

P.respond("GET", "/do/hres-repo-digital-commons/download-log", [
    {pathElement:0, as:"db", table:"importLogging"}
], function(E, row) {
    AdminAction.enforce();
    E.response.body = O.binaryData(JSON.stringify(row.log, undefined, 2), {
        filename: "dc_import_log_"+row.id+".json",
        mimeType: "application/json"
    });
});
