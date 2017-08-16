/* Haplo Research Manager                             http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Provides an OAI-PMH endpoint at /api/oai2

// --------------------------------------------------------------------------
// Default configuration, overridden in application configuration data
// (System Management -> Configuration -> Configuration data)

var SERVICE_USER_CODE = "hres:service-user:oai-pmh";

// oai:results_per_page -- page size for resuilts
var RESULT_PAGE_SIZE = O.application.config["oai:results_per_page"] || 20;

// oai:identifier_base -- prefix for identifiers, ref appended. Must end with ':'
var IDENTIFIER_BASE = O.application.config["oai:identifier_base"] || "oai:"+O.application.hostname+":";

// oai:repository_attributes -- dictionary, overrides the defaults here
var REPO_ATTRS = _.extend({
    repositoryName: "Haplo Research Manager: Repository",
    baseURL: O.application.url+"/api/oai2",
    protocolVersion: "2.0",
    adminEmail: "repository@"+O.application.hostname,
    earliestDatestamp: "1900-01-01T00:00:00Z",
    deletedRecord: "transient",
    granularity: "YYYY-MM-DDThh:mm:ssZ"
}, O.application.config["oai:repository_attributes"] || {});

// oai:debug - true to enable debug mode
var DEBUG_MODE = !!(O.application.config["oai:debug"]);

// --------------------------------------------------------------------------

var setToType;

var codeToSetName = function(code) {
    var s = code.split(':');
    return s[s.length - 1];
};

// --------------------------------------------------------------------------

if(DEBUG_MODE) {
    P.hook("hObjectDisplay", function(response, object) {
        ensureTypeInfoGathered();
        if(P.typeToSet.get(object.firstType())) {
            response.buttons["*EXPORT"] = [["/do/open-archives-initiative/export/"+object.ref, "OAI Export"]];
        }
    });
    P.respond("GET", "/do/open-archives-initiative/export", [
        {pathElement:0, as:"object"},
        {parameter:"metadataPrefix", as:"string", optional:true}
    ], function(E, output, metadataPrefix) {
        ensureTypeInfoGathered();
        if(!metadataPrefix) { metadataPrefix = "oai_dc"; }
        E.render({
            pageTitle: "OAI2: "+output.title,
            backLink: output.url(),
            viewingDC: (metadataPrefix === "oai_dc"),
            xml: O.service("hres_thirdparty_libs:generate_xml", {record:itemToXML(output,true,metadataPrefix)}, {indent:true}),
            applicationName: O.application.name,
            baseURL: REPO_ATTRS.baseURL
        });
    });
}

// --------------------------------------------------------------------------

P.respond("GET,POST", "/api/oai2", [
    {parameter:"verb", as:"string", optional:true}
], function(E, verb) {
    if(!verb) { verb = 'Identify'; }

    var command = COMMANDS[verb];
    var response = command ? command(E) : [];

    var xmlObject = {"OAI-PMH": [
        {_attr: {
            "xmlns": "http://www.openarchives.org/OAI/2.0/",
            "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
            "xsi:schemaLocation": "http://www.openarchives.org/OAI/2.0/ http://www.openarchives.org/OAI/2.0/OAI-PMH.xsd"
        }},
        {responseDate: (new XDate()).toString('i')},
        {request: [{_attr:{verb:verb}}, REPO_ATTRS.baseURL]}
    ].concat(response)};
    E.response.body = '<?xml version="1.0" encoding="UTF-8" ?>'+O.service("hres_thirdparty_libs:generate_xml", xmlObject, {indent:true});
    E.response.kind = 'xml';
});

// --------------------------------------------------------------------------

var COMMANDS = {};

// --------------------------------------------------------------------------

COMMANDS.Identify = function(E) {
    var items = [];
    _.each(REPO_ATTRS, function(value, key) {
        var i = {};
        i[key] = value;
        items.push(i);
    });
    // Get sample identifier which works
    var q = O.service("hres:repository:store_query").limit(1).sortByDateAscending().execute();

    items.push({
        description: [
            {"oai-identifier": [
                {_attr: {
                    "xmlns": "http://www.openarchives.org/OAI/2.0/oai-identifier",
                    "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
                    "xsi:schemaLocation": "http://www.openarchives.org/OAI/2.0/oai-identifier http://www.openarchives.org/OAI/2.0/oai-identifier.xsd"
                }},
                {scheme: "oai"},
                {repositoryIdentifier: O.application.hostname},
                {delimiter: ":"},
                {sampleIdentifier: IDENTIFIER_BASE+(q.length ? q[0].ref : '80000')}
            ]}
        ]
    });
    return [{Identify:items}];
};

// --------------------------------------------------------------------------

COMMANDS.ListMetadataFormats = function(E) {
    return [{
        ListMetadataFormats: [
            {
                metadataFormat: [
                    {metadataPrefix: "oai_dc"},
                    {schema: "http://www.openarchives.org/OAI/2.0/oai_dc.xsd"},
                    {metadataNamespace: "http://www.openarchives.org/OAI/2.0/oai_dc/"}
                ]
            },
            {
                metadataFormat: [
                    {metadataPrefix: "oai_datacite"},
                    {schema: "http://schema.datacite.org/oai/oai-1.0/oai.xsd"},
                    {metadataNamespace: "http://schema.datacite.org/oai/oai-1.0/"}
                ]
            }
        ]
    }];
};

// --------------------------------------------------------------------------

COMMANDS.ListSets = function(E) {
    var sets = [];
    O.service("hres:repository:each_repository_item_type", function(type) {
        var info = SCHEMA.getTypeInfo(type);
        if(info) {
            sets.push({
                set: [
                    {setSpec: codeToSetName(info.code)},
                    {setName: info.name}
                ]
            });
        }
    });
    return [{ListSets:sets}];
};

// --------------------------------------------------------------------------

COMMANDS.ListIdentifiers = function(E) {
    var items = [];
    var resume = queryForCommand(E, false, function(info) {
        items.push(info[0]);
    });
    if(resume) { items.push(resume); }
    return [{ListIdentifiers:items}];
};

// --------------------------------------------------------------------------

COMMANDS.ListRecords = function(E) {
    var items = [];
    var resume = queryForCommand(E, true, function(info) {
        items.push({record: info});
    });
    if(resume) { items.push(resume); }
    return [{ListRecords:items}];
};

// --------------------------------------------------------------------------

COMMANDS.GetRecord = function(E) {
    ensureTypeInfoGathered();
    var e = (E.request.parameters.identifier || '').split(':');
    var refStr = e[e.length-1];
    var ref = O.ref(refStr);
    if(!ref) { O.stop("Bad ref"); }
    // Load object, doing our own security on top of the service user's permissions
    return O.impersonating(O.serviceUser(SERVICE_USER_CODE), function() {
        var object = ref.load();
        if(!(O.service("hres:repository:is_repository_item", object))) { O.stop("Not permitted"); }
        return [
            {GetRecord: [
                {record: itemToXML(ref.load(), true, E.request.parameters.metadataPrefix)}
            ]}
        ];
    });
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

var queryForCommand = function(E, fullRecord, consume) {
    ensureTypeInfoGathered();

    var params = E.request.parameters;
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
        var from  = ("from" in params)  ? new XDate(params.from)  : undefined;
        var until = ("until" in params) ? new XDate(params.until) : undefined;
        query.dateRange(from, until, A.Date);
    }
    // Requested as ANONYMOUS, so need to (carefully) query with the service user
    // Include the itemToXML() in this block as it will need to read items
    O.impersonating(O.serviceUser(SERVICE_USER_CODE), function() {
        var items = query.setSparseResults(true).execute();
        // Result range
        var startIndex = ("resumptionToken" in params) ? parseInt(params.resumptionToken,10) : 0;
        var endIndex = startIndex + RESULT_PAGE_SIZE;
        for(var i = startIndex; i < endIndex; ++i) {
            if(i >= items.length) { break; }
            var item = items[i];
            consume(itemToXML(item, fullRecord, params.metadataPrefix));
        }
        // Resumption token needed?
        if(i < items.length) {
            return {resumptionToken:[
                {_attr: {
                    expirationDate: (new XDate()).addHours(2).toString("i"),
                    completeListSize: items.length,
                    cursor: startIndex
                }},
                ""+endIndex
            ]};
        }
    });
};

var itemToXML = function(item, fullRecord, metadataPrefix) {
    // Header
    var headerItems = [
        {identifier: IDENTIFIER_BASE+item.ref},
        {datestamp: (new XDate(item.lastModificationDate)).toString('yyyy-MM-dd')}
    ];
    item.everyType(function(v,d,q) {
        var name = P.typeToSet.get(v);
        if(name) { headerItems.push({setSpec:name}); }
    });
    var header = {header:headerItems};

    // Get rest of the info, if required
    var info = [header];
    if(fullRecord) {
        // Metadata
        var metadata;
        if(metadataPrefix === "oai_dc") {
            metadata = P.getDublinCoreMetadata(item);
        } else if(metadataPrefix === "oai_datacite") {
            metadata = {
                metadata: [O.service("hres:repository:datacite:to-xml-metadata", item)]
            };
        } else {
            throw new Error("Bad metadataPrefix requested.");
        }
        info.push(metadata);
    }

    return info;
};
