/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


let CanAccessEmulatedAPI = O.action("hres_repo_symplectic_elements_eprints_emulation:can_access_api").
    title("Can access emulated EPrints API for Symplectic Elements").
    allow("group", Group.SymplecticElementsAPI);

var respondWithUnauthorised = function(E) {
    E.response.statusCode = HTTP.UNAUTHORIZED;
    E.response.body = "Unauthorised";
    E.response.kind = "text";
};

var handling = function(E, itemId, fn) {
    let ref = O.ref(itemId);
    if( O.currentUser.allowed(CanAccessEmulatedAPI) &&
        O.currentUser.can("read", ref)
    ) {
        let item = ref.load();
        fn(item);
    } else {
        let deleted = O.withoutPermissionEnforcement(() => { return ref.load().deleted; });
        if(deleted) {
            E.response.statusCode = HTTP.NOT_FOUND;
            E.response.body = "Not found";
            E.response.kind = "text";
        } else {
            respondWithUnauthorised(E);
        }
    }
};

P.hook('hObjectDisplay', function(response, object) {
    if(O.currentUser.isSuperUser && O.service("hres:repository:is_repository_item", object)) {
        response.buttons["*ELEMENTS_EPRINTS_EMULATION"] = [
            ["/api/symplectic-elements-eprints-emulation/id/eprint/"+object.ref.objId, "EPrints emulation XML"]
        ];
    }
});

// --------------------------------------------------------------------------

var FILE_CONTENT_PROPERTY_TO_DESC_CODE = {
    "submitted": "hres:attribute:accepted-author-manuscript",   // what we probably get
    "published": "hres:attribute:published-file",
    "accepted": "hres:attribute:accepted-author-manuscript",
    "supplemental": "hres:attribute:supplemental-file",
    "DEFAULT": "hres:attribute:output-file"                     // use this otherwise
    // TODO: Default desc might vary depending on output type
};
var FILE_DESC_TO_CONTENT_PROPERTY = {
    "hres:attribute:published-file": "published",
    "hres:attribute:accepted-author-manuscript": "accepted",
    "hres:attribute:supplemental-file": "supplemental",
    "DEFAULT": ""
};

// --------------------------------------------------------------------------

// The service user is allowed to read/create/change objects that are labelled with itself
P.hook('hUserPermissionRules', function(response, user) {
    if(user.isMemberOf(Group.SymplecticElementsAPI)) {
        response.rules.add(Label.SymplecticElements, O.STATEMENT_ALLOW, O.PERM_READ | O.PERM_CREATE | O.PERM_UPDATE);
        response.rules.add(T.Person, O.STATEMENT_ALLOW, O.PERM_UPDATE);
        response.rules.add(Label.DELETED, O.STATEMENT_DENY, O.PERM_ALL);
    }
});
P.hook("hUserAttributeRestrictionLabels", function(response, user) {
    if(user.isMemberOf(Group.SymplecticElementsAPI)) {
        response.userLabels.add(Label.CanEditORCID);
    }
});

// --------------------------------------------------------------------------

P.db.table("symplecticElementsLog", {
    datetime: {type:"datetime"},
    method: {type:"text"},
    path: {type:"text"},
    body: {type:"text", nullable:true},
    headers: {type:"json"}
});

var logRequest = function(E, body) {
    console.log("SymplecticElements request", E.request.method, E.request.path);
    if(O.application.config["hres_repo_symplectic_elements_eprints_emulation:enable_logging"]) {
        P.db.symplecticElementsLog.create({
            datetime: new Date(),
            method: E.request.method,
            path: E.request.path,
            body: body ? body.readAsString() : null,
            headers: E.request.headers
        }).save();
    }
};

// --------------------------------------------------------------------------

P.db.table("document", {
    item: {type:"ref"},
    file: {type:"file"}
});

// --------------------------------------------------------------------------

var itemURL = function(item) {
    return O.application.url+"/api/symplectic-elements-eprints-emulation/id/eprint/"+item.ref.objId;
};

// --------------------------------------------------------------------------

P.respond("GET", "/api/symplectic-elements-eprints-emulation/id/eprint", [
    {pathElement:0, as:"int"}
], function(E, itemId) {
    logRequest(E);
    handling(E, itemId, (item) => {
        if(!item.isKindOfTypeAnnotated("hres:annotation:repository-item")) { O.stop("Not a repository item"); }
        let publicUrl = O.serviceMaybe("hres:repository:common:public-url-for-object", item) || itemId;
        let document = O.xml.document();
        let cursor = document.cursor().
            cursorSettingDefaultNamespace("http://eprints.org/ep2/data/2.0").
            element("eprints");
        O.service("hres:repository:eprints:write-store-object-below-xml-cursor", item, cursor.cursor());
        cursor.
            firstChildElement("eprint").
                attribute("id", publicUrl).
                element("eprintid").
                    text(""+item.ref.objId).
                up().
                element("eprint_status").
                    text(item.labels.includes(Label.AcceptedIntoRepository) ? "archive" : "buffer").
                up();
        let documents = cursor.cursor().element("documents");
        _.each(item.every(A.File), (v, index) => {
            let row = P.db.document.select().where("item", "=", item.ref).where("file", "=", O.file(v))[0];
            if(row) {
                writeDocumentXML(documents, row);
            } else {
                // Other API calls require a database row to exist, so create one if needed
                row = P.db.document.create({
                    item: item.ref,
                    file: O.file(v)
                }).save();
                writeDocumentXML(documents, row);
            }
        });
        E.response.body = document;
    });
});

// --------------------------------------------------------------------------

var oaiPmhResponder;

var OAI_PMH_REPO_ATTRS = _.extend({
    repositoryName: "Symplectic Elements Emulated EPrints API",
    baseURL: O.application.url+"/api/symplectic-elements-eprints-emulation/cgi/oai2",
    adminEmail: "repository@"+O.application.hostname,
    earliestDatestamp: "1900-01-01T00:00:00Z"
});

// Accessed without authentication
P.respond("GET", "/api/symplectic-elements-eprints-emulation/cgi/oai2", [
], function(E) {
    if(!oaiPmhResponder) {
        oaiPmhResponder = O.service("hres:oai-pmh:create-responder", {
            refToOAIIdentifier(ref) {
                return "oai:eprints.emulation:"+ref.objId;
            },
            attributes: OAI_PMH_REPO_ATTRS,
            objectToURL(item) {
                return itemURL(item);
            }
        });
    }
    O.impersonating(O.serviceUser("hres:repository:service-user:symplectic-elements"), function() {
        oaiPmhResponder.respond(E);
    });
});

// --------------------------------------------------------------------------

P.respond("POST", "/api/symplectic-elements-eprints-emulation/id/contents", [
    {body:"body", as:"binaryData"}
], function(E, metadataXML) {
    if(O.currentUser.allowed(CanAccessEmulatedAPI)) {
        logRequest(E, metadataXML);

        let context = O.service("hres:repository:eprints:import");

        let xml = O.xml.parse(metadataXML);
        let item = O.object([Label.SymplecticElements]);

        let applied = context.applyXMLToObject(
            xml.cursor().firstChildElement("eprints").firstChildElement("eprint"),
            item
        );

        context.saveAdditionalObjects();
        item.save();
        O.serviceMaybe("hres_repo_symplectic_elements_eprints_emulation:notify:saved", item);

        applied.saveAdditional();

        E.response.statusCode = HTTP.CREATED;
        E.response.headers['Location'] = itemURL(item);
        E.response.body = '';
        E.response.kind = 'text';
    } else {
        respondWithUnauthorised(E);
    }
});

// --------------------------------------------------------------------------

var writeDocumentXML = function(cursor, row) {
    let file = row.file;
    let item = row.item.load();
    let itemFileGroupInfo = getFileAttributeInfo(item, file.digest);
    let publicFileUrl = O.serviceMaybe("hres:repository:common:public-url-for-file", file, {});
    let doc = cursor.cursor().
        element("document").
            attribute("id", O.application.url+'/api/symplectic-elements-eprints-emulation/id/document/'+row.id).
            element("docid").text(''+row.id).up().
            element("rev_number").text("1").up().
            element("files").
                element("file").
                    attribute("id", O.application.url+'/api/symplectic-elements-eprints-emulation/id/file/'+row.id).
                    element("fileid").text(''+row.id).up().
                    element("datasetid").text('document').up().
                    element("objectid").text("1").up().
                    element("filename").text(itemFileGroupInfo.identifier.filename).up().
                    element("mime_type").text(file.mimeType).up().
                    element("hash").text(file.digest).up().
                    element("hash_type").text("SHA256").up().
                    element("filesize").text(''+file.fileSize).up();
                    if(publicFileUrl) {
                        doc.element("url").text(publicFileUrl).up();
                    }
    doc.up().up().
            element("eprintid").text(''+row.item.objId).up().
            element("mime_type").text(file.mimeType).up().
            element("format").text(file.mimeType).up();
    let security = "public";
    if(itemFileGroupInfo.extension) {
        let group = item.extractSingleAttributeGroup(itemFileGroupInfo.extension.groupId);
        if(group.first(ATTR["hres:attribute:file-access-level"]) &&
            group.first(ATTR["hres:attribute:file-access-level"]).behaviour === "hres:list:file-access-level:controlled") {
                security = "validuser";
        }
        let embargoes = O.serviceMaybe("hres_repo_embargoes:get_embargo", item);
        if(embargoes) {
            let em = embargoes.or((sq) => {
                sq.where("extensionGroup", "=", itemFileGroupInfo.extension.groupId).
                    where("extensionGroup", "=", null);
            })[0];
            if(em) {
                if(em.isActive()) {
                    security = "staffonly";
                }
                if(em.end) {
                    doc.element("date_embargo").text(new XDate(em.end).toString("yyyy-MM-dd")).up();
                }
            }
        }
        let code = SCHEMA.getAttributeInfo(itemFileGroupInfo.extension.desc).code;
        doc.element("content").text(FILE_DESC_TO_CONTENT_PROPERTY[code] || FILE_DESC_TO_CONTENT_PROPERTY.DEFAULT).up();
        if(group.first(ATTR["hres:attribute:license"])) {
            doc.element("license").text(group.first(ATTR["hres:attribute:license"]).toString()).up();
        }
    }
    doc.
        element("security").text(security).up().
        element("main").text(itemFileGroupInfo.identifier.filename).up();
};

var respondWithDocumentXML = function(E, row) {
    let xml = O.xml.document();
    let cursor = xml.cursor().
        cursorSettingDefaultNamespace("http://eprints.org/ep2/data/2.0").
        element("documents");
    writeDocumentXML(cursor, row);
    E.response.body = xml;
};

P.respond("POST", "/api/symplectic-elements-eprints-emulation/id/eprint", [ // expecting /id/eprint/<id>/contents
    {body:"body", as:"binaryData"},
    {pathElement:0, as:"int"}
], function(E, body, itemId) {
    handling(E, itemId, (item) => {
        logRequest(E);
        let row = P.db.document.create({
            item: item.ref,
            file: O.file(body)
        });
        row.save();

        // Append item to object, may get replaced later with extra properties with PUT .../id/document
        let m = item.mutableCopy();
        let extension = m.newAttributeGroup(ATTR[FILE_CONTENT_PROPERTY_TO_DESC_CODE.DEFAULT]);
        m.append(row.file.identifier(), A.File, undefined, extension);
        m.save();

        E.response.statusCode = HTTP.CREATED;
        E.response.headers['Location'] = O.application.url+'/api/symplectic-elements-eprints-emulation/id/document/'+row.id+'/contents';
        respondWithDocumentXML(E, row);
    });
});

P.respond("GET", "/api/symplectic-elements-eprints-emulation/id/document", [ // expecting /id/document/<id>
    {pathElement:0, as:"db", table:"document"}
], function(E, row) {
    if(O.currentUser.allowed(CanAccessEmulatedAPI)) {
        logRequest(E);
        respondWithDocumentXML(E, row);
    } else {
        respondWithUnauthorised(E);
    }
});

var getFileAttributeInfo = function(item, digest) {
    let extension,
        desc,
        identifier;
    item.each((v,d,q,x) => {
        if(O.typecode(v) === O.T_IDENTIFIER_FILE && v.digest == digest) {
            extension = x;
            desc = d;
            identifier = v;
        }
    });
    return {
        extension: extension,
        desc: desc,
        identifier: identifier
    };
};

P.respond("PUT", "/api/symplectic-elements-eprints-emulation/id/document", [ // expecting /id/document/<id>
    {body:"body", as:"binaryData"},
    {pathElement:0, as:"db", table:"document"}
], function(E, documentXML, row) {
    if(O.currentUser.allowed(CanAccessEmulatedAPI)) {
        logRequest(E, documentXML);

        let xml = O.xml.parse(documentXML);
        let cursor = xml.cursor().firstChildElement("documents").firstChildElement("document");
        let properties = {};
        cursor.eachChildElement((e) => {
            properties[e.getLocalName()] = e.getText();
        });

        let item = row.item.load().mutableCopy();
        let fileIdentifier = row.file.identifier();
        if(properties.main) {
            fileIdentifier.filename = properties.main;
        }

        let fileToRemove = getFileAttributeInfo(item, fileIdentifier.digest);
        // Remove the entire group for a file with this identifier
        if(fileToRemove.extension) {
            // TODO: Platform needs a "remove attribute group" API.
            item.remove(fileToRemove.desc, (v,d,q,x) => {
                return x && (x.groupId === fileToRemove.extension.groupId);
            });
        }

        // Add the file back
        let groupDesc = ATTR[
            FILE_CONTENT_PROPERTY_TO_DESC_CODE[properties.content] ||
            FILE_CONTENT_PROPERTY_TO_DESC_CODE.DEFAULT
        ];
        let extension = item.newAttributeGroup(groupDesc);

        item.append(fileIdentifier, A.File, undefined, extension);

        if(properties.date_embargo || properties.security === "staffonly") {
            O.service("hres_repo_embargoes:set_embargo", {
                object: item.ref,
                extensionGroup: extension.groupId,
                desc: groupDesc,
                end: properties.date_embargo ? new XDate(properties.date_embargo).toDate() : null
            });
        } else if(properties.security === "validuser") {
            if("AccessLevel" in A) {
                item.append(O.behaviourRef("hres:list:file-access-level:controlled"), A.AccessLevel, undefined, extension);
            }
        }

        item.save();

        E.response.statusCode = HTTP.NO_CONTENT;
        E.response.body = '';
        E.response.kind = 'text';
    } else {
        respondWithUnauthorised(E);
    }
});

