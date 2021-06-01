/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.db.table("downloadedFiles", {
    url: { type:"text" },
    digest: { type:"text", nullable:true },
    error: { type:"text", nullable:true }
});

P.db.table("fileLogging", {
    status: { type: "text" },
    file: { type: "file" },
    start: { type: "datetime" },
    end: { type: "datetime", nullable:true }
});

var dbRowForURL = function(url) {
    if(!url) { return; }
    const q = P.db.downloadedFiles.select().where("url", "=", url);
    return q.length ? q[0] : null;
};

var dbRowsWithoutFiles = function() {
    return P.db.downloadedFiles.select().where("digest", "=", null);
};

var dbRowsNotAttempted = function() {
    return P.db.downloadedFiles.select().
        where("digest", "=", null).
        where("error", "=", null);
};

var updateLog = function(fields) {
    let log = getLatestLog();
    if(!log || !!log.end) {
        P.db.fileLogging.create(_.extend(fields, { start: new Date() })).save();
    } else {
        log.status = fields.status || log.status;
        log.end = fields.end || log.end;
        log.save();        
    }
};

var getLatestLog = function() {
    const q = P.db.fileLogging.select().order("id", true).limit(1);
    return q.length ? q[0] : null;
};

// --------------------------------------------------------------------------
// Extracting and fetching files from Digital Commons
// --------------------------------------------------------------------------

P.backgroundCallback("fetch_files", function(document) {
    O.impersonating(O.SYSTEM, () => {
        try {
            const fileData = document.file.length ? document.file : [document.previousFile];
            const files = _.map(fileData, (f) => { return O.file(f); });
            P.data.filesForFileImport = _.map(files, (file) => { return file.digest; });
            _.each(files, (file) => {
                updateLog({ status:"reading...", file:file });
                const text = file.readAsString("UTF-8");
                extractFileURLs(text);
            });
            fetchFiles();
        } catch(e) {
            updateLog({ status: "ERROR:"+e.message, end: new Date() });
        }
    });
});

var extractFileURLs = function(text) {
    updateLog({ status:"extracting" });
    _.each(text.split(/\n/), (line) => {
        const filePath = line.split(/\s+/)[3];
        if(filePath.endsWith("metadata.xml")) { return; }   // Just a copy of the output metadata - ignore
        let url = filePath.replace("archive/"+P.LEGACY_APPLICATION, "http://"+P.FILE_WEB_SERVER);
        url = encodeURI(url);
        const row = dbRowForURL(url);
        if(!row) {
            P.db.downloadedFiles.create({
                url: url
            }).save();
        }
    });
};

var fetchFiles = function() {
    updateLog({
        status: "fetching"
    });
    if(dbRowsWithoutFiles().count()) {
        dbRowsWithoutFiles().each((row) => {
            let client = O.httpClient(row.url).
                method("GET");
            client.request(Download, { rowId: row.id });
        });
    } else {
        updateLog({
            status: "completed - all files previously downloaded",
            end: new Date()
        });
    }
};

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
            let body = response.body;
            let parts = row.url.split("/");
            // Filenames on the server are %-encoded, and then we encode again for making the HTTP request, so need
            // to double-decode to get to the actual filename
            body.filename = decodeURI(decodeURI((parts[parts.length - 1])));
            file = O.file(body);
        } catch(e) {
            row.error = e.message;
            row.save();
        }
        if(file) {
            row.digest = file.digest;
            row.save();
        }
    } else {
        row.error = response.errorMessage;
        row.save();
        console.log("Unsuccessful download of", url);
        console.log(response.errorMessage);
    }
    if(dbRowsNotAttempted().count() === 0) {
        if(dbRowsWithoutFiles().count() === 0) {
            updateLog({
                status: "completed",
                end: new Date()
            });
        } else {
            updateLog({
                status: "completed - some files have errors",
                end: new Date()
            });
        }
    }
});
