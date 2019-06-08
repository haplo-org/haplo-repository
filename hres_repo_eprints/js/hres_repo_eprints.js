/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.respond("GET", "/do/hres-repo-eprints/admin", [
], function(E) {
    O.action("std:action:administrator_override").enforce();

    let recentLogs = P.db.eprintsLogging.select().order("id", true).limit(5);
    recentLogs = _.map(recentLogs, log => {
        return {
            id: log.id,
            filename: log.digest ? O.file(log.digest).filename : undefined,
            date: new XDate(log.log.start).toString("MMM dd yyyy HH:mm:ss")
        };
    });
    let fetchFileTimeTaken = ((P.data.urlFetchingStatus !== "RUNNING") && P.data.urlFetchingStart && P.data.urlFetchingEnd) ?
        new XDate(P.data.urlFetchingStart).diffMinutes(new XDate(P.data.urlFetchingEnd)).toPrecision(2) :
        undefined;
    let fileDownloadTimeTaken = ((P.data.fileDownloadStatus !== "RUNNING") && P.data.fileDownloadStart && P.data.fileDownloadEnd) ?
        new XDate(P.data.fileDownloadStart).diffMinutes(new XDate(P.data.fileDownloadEnd)).toPrecision(2) :
        undefined;
    E.render({
        recentLogs: recentLogs,
        status: P.data.eprintImportStatus,
        fetchFileStatus: P.data.urlFetchingStatus,
        fileDownloadStatus: P.data.fileDownloadStatus,
        fileDownloadStart: P.data.fileDownloadStart,
        fileDownloadEnd: P.data.fileDownloadEnd,
        fetchFileTimeTaken: fetchFileTimeTaken,
        fileDownloadTimeTaken: fileDownloadTimeTaken
    });
});

P.respond("GET", "/do/hres-repo-eprints/mapping", [
], function(E) {
    O.action("std:action:administrator_override").enforce();

    const haploAttributeInfo = P.getHaploAttributeInfo();
    const mappings = _.map(haploAttributeInfo, item => {
        return {
            attributeTitle: item.name && SCHEMA.getAttributeInfo(A[item.name]).name,
            database: !!item.database,
            tag: item.tag,
            import: !!item.xmlToIntermediate,
            export: !!item.objectToIntermediate
        };
    });

    E.render({
        mappings: _.sortBy(mappings, 'tag')
    });
});

P.respond("GET", "/do/hres-repo-eprints/tags-and-values", [
    {pathElement:0, as:"db", table:"eprintsLogging"}
], function(E, row) {
    O.action("std:action:administrator_override").enforce();

    const log = row.log;
    let tags = {};
    _.each(log.tags, (v, k) => tags[k] = _.uniq(v));
    _.each(tags, (v, k) => tags[k] = _.sortBy(v, l => l));
    E.response.body = JSON.stringify(tags, undefined, 2);
    E.response.kind = "json";
});

var eprintIdToRefs = function(eprintId) {
    const query = P.db.eprintsMetadata.select().where("eprintId", "=", eprintId);
    if(query.count()) {
        return _.map(query, q => q.object);
    }
};

P.implementService("hres:repository:eprints:get-object-maybe", function(eprintId) {
    const objects = eprintIdToRefs(eprintId);
    return objects ? objects[0] : undefined;
});

P.respond("GET", "/do/hres-repo-eprints/admin/eprintid-lookup", [
    {parameter:"lookup", as:"string"}
], function(E, eprintId) {
    O.action("std:action:administrator_override").enforce();

    const refs = eprintIdToRefs(eprintId);
    E.render({
        eprintId: eprintId,
        refs: refs
    });
});

P.respond("GET", "/do/hres-repo-eprints/all-logs", [
], function(E) {
    O.action("std:action:administrator_override").enforce();
    
    const logs = P.db.eprintsLogging.select().order("id", true);
    E.render({
        logs: _.map(logs, log => {
            return {
                id: log.id,
                filename: log.digest ? O.file(log.digest).filename : undefined,
                date: new XDate(log.log.start).toString("MMM dd yyyy HH:mm:ss")
            };
        })
    });
});

// TODO auditing: random selection of eprints to check
// e.g. metatag test by searching getting the currently live metatags on the eprint
// when doing this, save the tags fetched from the client's live site to avoid bombarding them

// this handler is to provide the skeleton code for running tests
// on the xml file
P.respond("GET,POST", "/do/hres-repo-eprints/arbitrary-test", [
], function(E) {
    O.action("std:action:administrator_override").enforce();
    let document = {};
    let form = P.xmlForm.handle(document, E.request);
    if(form.complete) {
        const file = O.file(document.xmlFile[0]);
        let cursor = O.xml.parse(file).cursor();
        if(!cursor.firstChildElementMaybe("eprints")) { return; }
        let publishedTypes = [], acceptedTypes = [];
        cursor.eachChildElement("eprint", (ec) => {
            const eprintStatus = ec.getTextOfFirstChildElement("eprint_status");
            if(eprintStatus !== "archive") {
                return;
            }
            const type = ec.getTextOfFirstChildElement("type");
            if(ec.firstChildElementMaybe("documents")) {
                ec.eachChildElement("document", dc => {
                    const content = dc.getTextOfFirstChildElementMaybe("content");
                    if(content === "published") {
                        if(!_.contains(publishedTypes, type)) {
                            publishedTypes.push(type);
                        }
                    } else if(content === "accepted") {
                        if(!_.contains(acceptedTypes, type)) {
                            acceptedTypes.push(type);
                        }
                    }
                });
            }
        });
        console.log("acceptedTypes: ", acceptedTypes);
        console.log("publishedTypes: ", publishedTypes);
        E.response.redirect("/do/hres-repo-eprints/arbitrary-test");
    }
    E.render({
        pageTitle: "Arbitrary test",
        form: form,
    }, "upload-xml");
});
