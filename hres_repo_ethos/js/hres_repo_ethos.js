/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var DC_ATTRS = [
    {name:"title", desc:A.Title},
    {name:"subject", desc:A.Keywords},
    {name:"subject", desc:A.Subject},
    {name:"description", desc:A.Abstract},
    {name:"publisher", desc:A.Publisher},
    {name:"date", desc:A.Date},
    {name:"contributor", desc:A.Editor},
    {name:"rights", desc:A.License}
];
var DCTERMS_ATTRS = [
    {name:"issued", desc:A.Date},
    {name:"abstract", desc:A.Abstract},
    {name:"license", desc:A.License}
];
var ETHOS_ATTRS = [
    {name:"qualificationlevel", desc:A.Type},
    // TODO: QualificationName is "Mandatory" in EThOS recommendation, but not included in many
    // examples I've seen. Should we include a default value? If so, what?
    {name:"qualificationname", desc: "QualificationName"},
    {name:"institution", desc:A.InstitutionName},
    {name:"department", desc:A.DepartmentName},
    {name:"sponsor", desc:A.Funder}
];

var usingDOI = (O.featureImplemented("hres:doi") && ("DOI" in A));
if(usingDOI) { P.use("hres:doi"); }
var usingORCID = (O.featureImplemented("hres:orcid") && ("ORCID" in A));
if(usingORCID) { P.use("hres:orcid"); }

var textValue = function(v) {
    return (O.isRef(v) ? v.load().firstTitle() : v).toString();
};
var addPersonORCID = function(cursor, personRef) {
    if(usingORCID) {
        personRef.load().every(A.ORCID, (v,d,q) => {
            // From EThOS implementation guidance (accessed 2018-10-25)
            // http://ethostoolkit.cranfield.ac.uk/tiki-index.php?page=The%20EThOS%20UKETD_DC%20application%20profile
            // "An ORCID identifier for the author (https://orcid.org/register). Enter as 16 digits (no spaces or dashes)."
            let orcidAsNumber = v.toString().replace(/\-/g, '');
            cursor.
                element("authoridentifier").
                text(orcidAsNumber).
                attributeWithNamespace("http://www.w3.org/2001/XMLSchema-instance", "type", "uketdterms:ORCID").
                up();
        });
    }
};

var getObjectAsETHDCXML = function(item, cursor, options) {

    var simpleElement = function(c, name, desc, addAttribute) {
        if(typeof(desc) === "string") {
            if(!(desc in A)) { return; }
            desc = A[desc];
        }
        item.every(desc, (v,d,q) => {
            c.element(name).text(textValue(v));
            if(addAttribute) { addAttribute(c); }
            c.up();
        });
    };

    cursor.
        addNamespace("http://purl.org/dc/elements/1.1/", "dc").
        addNamespace("http://purl.org/dc/terms/", "dcterms").
        addNamespace("http://www.w3.org/2001/XMLSchema-instance", "xsi").
        addNamespace("http://naca.central.cranfield.ac.uk/ethos-oai/terms/", "uketdterms").
        addSchemaLocation("http://naca.central.cranfield.ac.uk/ethos-oai/terms/", "http://naca.central.cranfield.ac.uk/ethos-oai/2.0/uketd_dc.xsd");
    let ethddc = cursor.cursorWithNamespace("http://purl.org/dc/elements/1.1/");
    let dcterms = cursor.cursorWithNamespace("http://purl.org/dc/terms/");
    let uketdterms = cursor.cursorWithNamespace("http://naca.central.cranfield.ac.uk/ethos-oai/terms/");

    // relation is the URL of the published item page
    if(options && options.objectToURL) {
        let itemURL = options.objectToURL(item);
        if(itemURL) {
            ethddc.element("relation").text(itemURL).up();
            dcterms.element("isReferencedBy").text(itemURL).up();
        }
    }
    ethddc.element("type").text("Thesis or dissertation").up();

    let defaultLanguage = O.application.config["hres_repo_ethos:default_language_code"];
    let hasListedLanguage = false;
    if("Language" in A) {
        simpleElement(ethddc, "language", A.Language, (c) => {
            c.attributeWithNamespace("http://www.w3.org/2001/XMLSchema-instance", "type", "dcterms:ISO639-2");
        });
        hasListedLanguage = !!item.first(A.Language);
    }
    if(!hasListedLanguage && defaultLanguage) {
        ethddc.
            element("language").
            text(defaultLanguage).
            attributeWithNamespace("http://www.w3.org/2001/XMLSchema-instance", "type", "dcterms:ISO639-2").
            up();
    }

    item.every(A.AuthorsCitation, (v,d,q) => {
        ethddc.element("creator").text(v.toString()).up();
        let ref = v.toFields().value.ref;
        if(ref) {
            addPersonORCID(uketdterms, O.ref(ref));
        }
    });
    // Check for linked projects or listed directly. Linked projects may depend on PhD Manager being installed
    item.every(A.Project, (v,d,q) => {
        let project = O.withoutPermissionEnforcement(() => { return v.load(); });
        project.every(A.Supervisor, (vv,dd,qq) => {
            let citation = O.service("hres:author_citation:get_citation_text_for_person_object", vv);
            uketdterms.element("advisor").text(citation).up();
            addPersonORCID(uketdterms, vv);
        });
    });
    item.every(A.Supervisor, (v,d,q) => {
        if(O.isRef(v)) {
            let citation = O.service("hres:author_citation:get_citation_text_for_person_object", v);
            uketdterms.element("advisor").text(citation).up();
            addPersonORCID(uketdterms, v);
        } else {
            uketdterms.element("advisor").text(v.toString()).up();
        }
    });

    _.each(ETHOS_ATTRS, (attr) => simpleElement(uketdterms, attr.name, attr.desc));
    _.each(DCTERMS_ATTRS, (attr) => simpleElement(dcterms, attr.name, attr.desc));
    _.each(DC_ATTRS, (attr) => simpleElement(ethddc, attr.name, attr.desc));
    // URI identifier is the public URL of the file (not the output)
    if(options && options.fileToURL) {
        item.every((v,d,q) => {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                let fileURL = options.fileToURL(v);
                if(fileURL) {
                    ethddc.
                        element("identifier").
                        text(fileURL).
                        attributeWithNamespace("http://www.w3.org/2001/XMLSchema-instance", "type", "dcterms:URI").
                        up();
                }
            }
        });
    }
    if(usingDOI) {
        item.every(A.DOI, (v,d,q) => {
            ethddc.
                element("identifier").
                text(P.DOI.url(v)).
                attributeWithNamespace("http://www.w3.org/2001/XMLSchema-instance", "type", "dcterms:DOI").
                up();
        });
    }
    if(options && options.refToOAIIdentifier) {
        ethddc.
            element("identifier").
            text(options.refToOAIIdentifier(item.ref)).
            up();
    }
};

P.implementService("hres:repository:ethos:write-store-object-below-xml-cursor", function(item, cursor, options) {
    if(item.isKindOf(T.Thesis)) {
        getObjectAsETHDCXML(item, cursor, options);
    }
});
