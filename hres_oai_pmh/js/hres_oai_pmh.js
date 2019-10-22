/* Haplo Research Manager                             http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// --------------------------------------------------------------------------
// Default configuration, overridden in application configuration data
// (System Management -> Configuration -> Configuration data)

// oai:results_per_page -- page size for resuilts
/*HaploDoc
node: /repository/hres_oai_pmh/implementation
sort: 5
--

h2. Config data

h3. @oai:results_per_page@

Optional. Default is 20.
*/
var RESULT_PAGE_SIZE = O.application.config["oai:results_per_page"] || 20;

var REQUIRED_REPO_ATTRIBUTES = {
    protocolVersion: "2.0",
    deletedRecord: "transient",
    granularity: "YYYY-MM-DDThh:mm:ssZ"
};

// --------------------------------------------------------------------------

/*HaploDoc
node: /repository/hres_oai_pmh/metadata_formats
title: Metadata formats
sort: 1
--

New metadata formats are added using the [node:haplo-plugins/haplo_service_registry]. Each new \
format should be added in its own plugin.

h3. Service registry configuration

To be picked up by the OAI-PMH service registry query, the metadata format must have the statements \
@"conforms-to hres:write-store-object-below-xml-cursor"@ and @"hres:oai-pmh:exposed-metadata-format"@.

It must also have the following service metadata:

|@"hres:oai-pmh:metadata-namespace"@|The XML namespace for the schema|
|@"hres:oai-pmh:metadata-prefix"@|The prefix for that XML namespace|
|@"hres:oai-pmh:schema"@|The location of the XML schema|
|@"hres:oai-pmh:root-element"@|What the root element for a record should be called|
*/
var _metadataServices;
var metadataServices = P.metadataServices = function() {
    if(!_metadataServices) {
        _metadataServices = O.service("haplo:service-registry:query", [
            "conforms-to hres:write-store-object-below-xml-cursor",
            "hres:oai-pmh:exposed-metadata-format"
        ]);
    }
    return _metadataServices;
};

var _metadataServiceForScheme;
var metadataServiceForScheme = P.metadataServiceForScheme = function(scheme) {
    if(!_metadataServiceForScheme) {
        _metadataServiceForScheme = {};
        metadataServices().eachService((metadataService) => {
            _metadataServiceForScheme[metadataService.metadata["hres:oai-pmh:metadata-prefix"]] = metadataService;
        });
    }
    return _metadataServiceForScheme[scheme];
};

// --------------------------------------------------------------------------

var setToType;

var codeToSetName = function(code) {
    var s = code.split(':');
    return s[s.length - 1];
};

// --------------------------------------------------------------------------

// Spec has properties:
//   refToOAIIdentifier: function(item) { return "oai:"+hostname+":"+ref; }
//   attributes: { ... }
// Returns an object with a respond(E) method, which should be called in the security context
// of a user with the required permissions.

P.implementService("hres:oai-pmh:create-responder", function(spec) {
    return new OAIPMHResponder(spec);
});

// --------------------------------------------------------------------------

var OAIPMHResponder = function(spec) {
    this._refToOAIIdentifier = spec.refToOAIIdentifier;
    this._objectToURL = spec.objectToURL || function(){};
    this._fileToURL = spec.fileToURL || function(){};
    this._attributes = _.extend({}, spec.attributes, REQUIRED_REPO_ATTRIBUTES);
    this.writeXMLOptions = {
        objectToURL: this._objectToURL,
        fileToURL: this._fileToURL,
        refToOAIIdentifier: this._refToOAIIdentifier
    };
};

OAIPMHResponder.prototype.respond = function(E) {
    var verb = E.request.parameters.verb;
    if(!verb) { verb = 'Identify'; }

    ensureTypeInfoGathered();

    var xmlDocument = O.xml.document();
    var cursor = xmlDocument.cursor().cursorWithControlCharacterPolicy("remove").
        cursorSettingDefaultNamespace("http://www.openarchives.org/OAI/2.0/").
        element("OAI-PMH").
            addSchemaLocation("http://www.openarchives.org/OAI/2.0/", "http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd").
            element("responseDate").text((new XDate()).toString('i')).up().
            element("request").attribute("verb", verb).text(this._attributes.baseURL).up();

    var command = COMMANDS[verb];
    if(command) {
        command(this, E, cursor.cursor().element(verb));
    }
    if(E.response.body) { return; } // Error condition - command has set body with appropriate error message
    E.response.body = xmlDocument;
};

// --------------------------------------------------------------------------

var COMMANDS = {};

// --------------------------------------------------------------------------

const IDENTIFY_ATTRIBUTE_ORDER = [
    'repositoryName', 'baseURL', 'protocolVersion', 'adminEmail', 'earliestDatestamp', 'deletedRecord', 'granularity'
];

COMMANDS.Identify = function(responder, E, cursor) {
    // Get object to find a sample identifier which works
    var q = O.service("hres:repository:store_query").limit(1).sortByDateAscending().execute();

    _.each(IDENTIFY_ATTRIBUTE_ORDER, function(key) {
        var value = responder._attributes[key];
        if(value) {
            cursor.element(key).text(value).up();
        }
    });

    var identifier = cursor.
        element("description").
            cursorSettingDefaultNamespace("http://www.openarchives.org/OAI/2.0/oai-identifier").
            element("oai-identifier").
                addSchemaLocation("http://www.openarchives.org/OAI/2.0/oai-identifier", "http://www.openarchives.org/OAI/2.0/oai-identifier.xsd").
                element("scheme").text("oai").up().
                element("repositoryIdentifier").text(O.application.hostname).up().
                element("delimiter").text(":").up().
                element("sampleIdentifier").text(responder._refToOAIIdentifier(q.length ? q[0].ref : O.ref('80000'))).up();
};

// --------------------------------------------------------------------------

COMMANDS.ListMetadataFormats = function(responder, E, cursor) {
    metadataServices().eachService((metadataService) => {
        var m = metadataService.metadata;
        cursor.
            element("metadataFormat").
                element("metadataPrefix").text(m["hres:oai-pmh:metadata-prefix"]).up().
                element("schema").text(m["hres:oai-pmh:schema"]).up().
                element("metadataNamespace").text(m["hres:oai-pmh:metadata-namespace"]).up().
            up();
    });
};

// --------------------------------------------------------------------------

COMMANDS.ListSets = function(responder, E, cursor) {
    O.service("hres:repository:each_repository_item_type", function(type) {
        var info = SCHEMA.getTypeInfo(type);
        cursor.
            element("set").
                element("setSpec").text(codeToSetName(info.code)).up().
                element("setName").text(info.name).up().
            up();
    });
};

// --------------------------------------------------------------------------

COMMANDS.ListIdentifiers = function(responder, E, cursor) {
    var resume = queryForCommand(E, function(item, metadataPrefix) {
        writeItemHeader(responder, cursor, item);
    });
    if(resume) { resume(cursor); }
};

// --------------------------------------------------------------------------

COMMANDS.ListRecords = function(responder, E, cursor) {
    var resume = queryForCommand(E, function(item, metadataPrefix) {
        cursor.element("record");
        writeItemHeader(responder, cursor, item);
        writeItemRecord(responder, cursor, item, metadataPrefix);
        cursor.up();
    });
    if(resume) { resume(cursor); }
};

// --------------------------------------------------------------------------

COMMANDS.GetRecord = function(responder, E, cursor) {
    var metadataPrefix = E.request.parameters.metadataPrefix || 'oai_dc';
    var e = (E.request.parameters.identifier || '').split(':');
    var refStr = e[e.length-1];
    var ref = O.ref(refStr);
    if(!ref) { O.stop("Bad ref"); }
    // Load object, doing our own security on top of the service user's permissions
    var object = ref.load();
    if(!(O.service("hres:repository:is_repository_item", object))) { O.stop("Not permitted"); }
    cursor.element("record");
    writeItemHeader(responder, cursor, object);
    writeItemRecord(responder, cursor, object, metadataPrefix);
    cursor.up();
};

// --------------------------------------------------------------------------

var ensureTypeInfoGathered = function() {
    if(P.typeToSet) { return; }
    P.typeToSet = O.refdictHierarchical();
    setToType = {};
    O.service("hres:repository:each_repository_item_type", function(type) {
        var info = SCHEMA.getTypeInfo(type);
        if(info) {
            var name = codeToSetName(info.code);
            P.typeToSet.set(type, name);
            setToType[name] = type;
        }
    });
};

var datesFromParams = function(params) {
    var dates = {};
    ["from", "until"].forEach((d) => {
        if(!(d in params)) { return; }
        var xd = new XDate(params[d]);
        if(!xd.valid()) {
            dates.error = true;
            return;
        }
        dates[d] = xd.toDate();
    });
    return dates;
};

var RESUMPTION_COMPONENTS = ['__offset','metadataPrefix','from','until','set'];

var queryForCommand = function(E, consume) {
    // Resumption token may contain parameters, as they don't have to be passed in for further requests
    var params = E.request.parameters;
    var startIndex = 0;
    if(params.resumptionToken) {
        var parts = params.resumptionToken.split(',');
        params = {};        // ignore params from the URL, as resumptionToken is an 'exclusive' parameter
        for(var l = 0; l < RESUMPTION_COMPONENTS.length; ++l) {
            if(parts[l]) {
                params[RESUMPTION_COMPONENTS[l]] = decodeURIComponent(parts[l]);
            }
        }
        if(params.__offset) {
            var o = parseInt(params.__offset,10);
            if(!isNaN(o)) { startIndex = o; }
        }
    }

    // Metadata prefix already obtained from resumption token, URL params. But default to DC otherwise.
    params.metadataPrefix = params.metadataPrefix || 'oai_dc';

    var query = O.query();

    // Relevant types
    if("set" in params) {
        query.link(setToType[params.set] || O.stop("Bad type"), A.Type);
    } else {
        query.or(function(sq) {
            O.service("hres:repository:each_repository_item_type", function(t) { sq.link(t, A.Type); });
        });
    }
    // Date range?
    if("from" in params || "until" in params) {
        var dates = datesFromParams(params);
        if(dates.error) {
            E.response.body = 'A date in the request was badly formed.';
            E.response.kind = 'text';
            E.response.statusCode = HTTP.BAD_REQUEST;
            return;
        }
        query.dateRange(dates.from, dates.until, A.Date);
    }
    // Requested as ANONYMOUS, so need to (carefully) query with the service user
    // Include the itemToXML() in this block as it will need to read items
    var resume;
    var items = query.setSparseResults(true).execute();
    // Result range
    var endIndex = startIndex + RESULT_PAGE_SIZE;
    for(var i = startIndex; i < endIndex; ++i) {
        if(i >= items.length) { break; }
        consume(items[i], params.metadataPrefix);
    }
    // Resumption token needed?
    if(i < items.length) {
        var tokenParts = [''+endIndex],
            newParams = Object.create(params);
        newParams.__offset = ''+endIndex;
        for(var p = 1 /* not offset */; p < RESUMPTION_COMPONENTS.length; ++p) {
            var v = newParams[RESUMPTION_COMPONENTS[p]];
            tokenParts[p] = v ? encodeURIComponent(v) : '';
        }
        var resumptionToken = tokenParts.join(','); // , is encoded by encodeURIComponent(), so safe to use as separator
        resume = function(cursor) {
            cursor.element("resumptionToken").
                attribute("expirationDate", (new XDate()).addHours(2).toString("i")).
                attribute("completeListSize", items.length).
                attribute("cursor", startIndex).
                text(resumptionToken).
            up();
        };
    }
    return resume;
};

var writeItemHeader = function(responder, cursor, item) {
    cursor.
        element("header").
            element("identifier").text(responder._refToOAIIdentifier(item.ref)).up().
            element("datestamp").text((new XDate(item.lastModificationDate)).toString('yyyy-MM-dd')).up();
    item.everyType(function(v,d,q) {
        var name = P.typeToSet.get(v);
        if(name) { cursor.element("setSpec").text(name).up(); }
    });
    cursor.up();
};

var writeItemRecord = function(responder, cursor, item, metadataPrefix) {
    var metadataService = metadataServiceForScheme(metadataPrefix);
    if(!metadataService) {
        throw new Error("Bad metadataPrefix requested.");
    }
    var m = metadataService.metadata;
    cursor.
        element("metadata").
        addNamespace(
            m["hres:oai-pmh:metadata-namespace"],
            m["hres:oai-pmh:metadata-prefix"],
            m["hres:oai-pmh:schema"]
        );
    var c = cursor.
        cursorWithNamespace(m["hres:oai-pmh:metadata-namespace"]).
        element(m["hres:oai-pmh:root-element"]);
    var restrictedItem = item.restrictedCopy(O.currentUser);
    O.service(metadataService.name, restrictedItem, c, responder.writeXMLOptions);
    cursor.up();
};
