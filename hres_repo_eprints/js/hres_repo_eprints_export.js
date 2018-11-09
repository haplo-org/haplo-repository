/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// Convert from StoreObject to EPrints XML
P.implementService("hres:repository:eprints:write-store-object-below-xml-cursor", function(item, cursor, options) {
    objectToEprintsXML(item, cursor, options);
});

var objectToEprintsXML = function(object, cursor, options) {
    let intermediate = objectToIntermediate(object);
    intermediateToXML(cursor, intermediate);
};

// start URL
P.respond("GET", "/do/hres-repo-eprints/object-to-xml", [
    {pathElement:0, as:"object"}
], function(E, object) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    let document = O.xml.document();
    let cursor = document.cursor();
    objectToEprintsXML(object, cursor);
    E.response.body = document;
    E.response.kind = 'text';
});

// object to intermediate
var objectToIntermediate = P.objectToIntermediate = function(object) {
    let intermediate = {
        attributes: []
    };
    _.each(P.haploAttributeInfo, (attrInfo) => {
        if(attrInfo.name) {
            object.every(A[attrInfo.name], (v, d, q) => {
                let attribute = {
                    value: v,
                    desc: d,
                    qual: q,
                    tag: attrInfo.tag
                };
                if(attrInfo.objectToIntermediate) {
                    attrInfo.objectToIntermediate(intermediate, object, attribute);
                }
            });
        } else if(attrInfo.database && attrInfo.objectToIntermediate) {
            attrInfo.objectToIntermediate(intermediate, object, { tag: attrInfo.tag });
        }
    });
    return intermediate;
};

// intermediate to XML
// TODO: control character policy on text
var intermediateToXML = function(cursor, intermediate) {
    let eprint = cursor.
        element("eprint").
        addNamespace("http://eprints.org/ep2/data/2.0", "eprints").
        cursorWithNamespace("http://eprints.org/ep2/data/2.0");
    _.each(intermediate.attributes, (a) => {
        if(a.tag === "rioxx2_license_ref_input") {
            if(!cursor.firstChildElementMaybe(a.tag)) {
                cursor.element(a.tag);
            }
            _.each(a.properties, (v, k) => {
                cursor.element(k);
                cursor.text(v);
                cursor.up();
            });
        } else if(a.text) {
            cursor.element(a.tag).text(a.text);
        } else if(a.properties) {
            if(!cursor.firstChildElementMaybe(a.tag)) {
                cursor.element(a.tag);
            }
            cursor.element("item");
            _.each(a.properties, (v, k) => {
                if(k) { cursor.element(k); }
                if(!_.isObject(v)) { cursor.text(v); }
                else {
                    _.each(v, (v2, k2) => {
                        cursor.element(k2).text(v2);
                        cursor.up();
                    });
                }
                if(k) { cursor.up(); }
            });
            cursor.up();
        }
        cursor.up();
    });
};

P.textAttr = function(intermediate, object, attribute) {
    attribute.text = attribute.value.toString();
    intermediate.attributes.push(attribute);
};

var OUTPUT_TYPE_MAP = {
    "Book": {type:"book"},
    "BookChapter": {type:"book_section"},
    "Report": {type:"monograph", subtype:"other", subtypeKey:"monograph_type"},
    "hres:type:report:discussion-paper": {type:"monograph", subtype:"discussion_paper", subtypeKey:"monograph_type"},
    "hres:type:report:project-report": {type:"monograph", subtype:"project_report", subtypeKey:"monograph_type"},
    "hres:type:report:technical-report": {type:"monograph", subtype:"technical_report", subtypeKey:"monograph_type"},
    "hres:type:report:working-paper": {type:"monograph", subtype:"working_paper", subtypeKey:"monograph_type"},
    "Artefact": {type:"artefact"},
    "Composition": {type:"composition"},
    "ConferenceItem": {type:"conference_item"},
    "hres:type:conference-item:conference-paper": {type:"conference_item", subtype:"paper", subtypeKey:"pres_type"},
    "hres:type:conference-item:conference-poster": {type:"conference_item", subtype:"poster", subtypeKey:"pres_type"},
    "hres:type:conference-item:conference-keynote": {type:"conference_item", subtype:"keynote", subtypeKey:"pres_type"},
    "Exhibition": {type:"exhibition"},
    "JournalArticle": {type:"article"},
    "Patent": {type:"patent"},
    "Performance": {type:"performance"},
    "Thesis": {type:"thesis"},
    "Other": {type:"other"},
    "DigitalOrVisualMedia": {
        fn(object) {
            if("MediaType" in A) {
                let mediaType = object.first(A.MediaType);
                if(mediaType && mediaType.behaviour && mediaType.behaviour.split("hres:list:media-type:").length > 1) {
                    return mediaType.behaviour.split("hres:list:media-type:")[1];
                } else {
                    // this may not be an actual eprints type, but I couldn't find an equivalent
                    return "digital_or_visual_media";
                }
            }
        }
    }
};

var OUTPUT_TYPE = O.refdictHierarchical();
var DEFAULT_OUTPUT_TYPE_INFO = {type:"other"};
_.each(OUTPUT_TYPE_MAP, (value, key) => {
    if(key in T) {
        OUTPUT_TYPE.set(T[key], value);
    }
});

P.typeAttr = function(intermediate, object, attribute) {
    O.serviceMaybe("hres-repo-eprints:modify-export-type-map", OUTPUT_TYPE);
    const typeInfo = OUTPUT_TYPE.get(object.firstType()) || DEFAULT_OUTPUT_TYPE_INFO;
    attribute.text = typeInfo.type || typeInfo.fn(object);
    if(attribute.text) {
        intermediate.attributes.push(attribute);
    }
    if(typeInfo.subtype) {
        let subtypeAttribute = _.clone(attribute);
        subtypeAttribute.tag = typeInfo.subtypeKey;
        subtypeAttribute.text = typeInfo.subtype;
        intermediate.attributes.push(subtypeAttribute);
    }
};

P.personAttr = function(intermediate, object, attribute) {
    let person = {};
    let ref, personName;
    personName = O.service("hres:author_citation:get_citation_text", attribute.value);
    if(personName) {
        ref = O.service("hres:author_citation:get_ref_maybe", attribute.value);
        let m = personName.match(/^\s*(.*?)\s*,\s*(.*)\s*?$/);
        if(m) {
            let name = {};
            if(m[1]) { name.family = m[1]; }
            if(m[2]) { name.given = m[2]; }
            person.name = name;
        }
    }
    if(ref) {
        let o = ref.load();
        // figure out name if personName doesn't exist?
        let email = o.first(A.Email);
        if(email) { person.id = email.toString(); } // id isn't necessarily email
    }
    attribute.properties = person;
    if(person.id || person.name) {
        intermediate.attributes.push(attribute);
    }
};

// --------------------------------------------------------------------------
// Dates

var getDateStringFormat = function(precision) {
    switch(precision) {
        case O.PRECISION_MONTH:
            return "yyyy-MM";
        case O.PRECISION_YEAR:
            return "yyyy";
        default:
            return "yyyy-MM-dd";
    }
};

var getEarliestPublicationDate = function(object) {
    // can't use "hres:repository:earliest_publication_date" because need precision for formatting
    let earliestPublicationDate;
    object.every(A.PublicationDates, function(p) {
        if(p && (!earliestPublicationDate || (p.start < earliestPublicationDate.start))) {
            earliestPublicationDate = p;
        }
    });
    if(earliestPublicationDate) {
        return new XDate(earliestPublicationDate.start).
            toString(getDateStringFormat(earliestPublicationDate.precision));
    }
};

P.publishedDate = function(intermediate, object, attribute) {
    let earliestPublicationDate = getEarliestPublicationDate(object);
    if(earliestPublicationDate) {
        attribute.text = earliestPublicationDate;
        intermediate.attributes.push(attribute);
    }
};

/* 
Dates are exported to:
<date>, <date_type>: a pair of tags at the main level, which takes, in order of preference, one of:
    the earliest publication date
    Q.Accepted
    Q.Completed
*/
P.datesAttr = function(intermediate, object, attribute) {
    // its easier to set all dates in one go because of the complications of having
    // date information exported into 2 places and saved in 2 places
    const datesSet = _.find(intermediate.attributes, a => a.tag === "date");
    if(datesSet) { return; }

    let mainDate;
    let publicationDateAttribute = {tag:"dates"};
    // can't use "hres:repository:earliest_publication_date" because need precision for formatting
    let earliestPublicationDate = getEarliestPublicationDate(object);
    if(earliestPublicationDate) {
        let properties = {
            date: earliestPublicationDate,
            date_type: "published"
        };
        intermediate.attributes.push({
            tag:"dates",
            properties: properties
        });
        mainDate = properties;
    }

    object.every(A.PublicationProcessDates, (v, d, q) => {
        let dateAttribute = {tag:"dates", properties: {}};
        dateAttribute.properties.date = new XDate(v.start).toString(getDateStringFormat(v.precision));
        if(q == Q.Accepted) {
            dateAttribute.properties.date_type = "accepted";
            if(!earliestPublicationDate) { mainDate = dateAttribute.properties; }
        } else if(q == Q.Completed) {
            dateAttribute.properties.date_type = "completed";
            if(!mainDate) { mainDate = dateAttribute.properties; }
        } // Q.Deposited is put in a different tag
        if(dateAttribute.properties.date_type) {
            intermediate.attributes.push(dateAttribute);
        }
    });

    if(mainDate) {
        intermediate.attributes.push({
            tag: "date",
            text: mainDate.date
        });
        intermediate.attributes.push({
            tag: "date_type",
            text: mainDate.date_type
        });
    }
};

// --------------------------------------------------------------------------

var setAttributeFromBehaviour = function(intermediate, attribute, map) {
    _.find(map, (eprintText, behaviour) => {
        if(attribute.value == O.behaviourRefMaybe(behaviour)) {
            attribute.text = eprintText;
            intermediate.attributes.push(attribute);
        }
    });
};

P.peerReviewAttr = function(intermediate, object, attribute) {
    setAttributeFromBehaviour(intermediate, attribute, {
        "hres:list:peer-review:reviewed": "TRUE",
        "hres:list:peer-review:not-reviewed": "FALSE"
    });
};

P.outputStatusAttr = function(intermediate, object, attribute) {
    setAttributeFromBehaviour(intermediate, attribute, {
        "hres:list:output-status:unpublished": "unpub",
        "hres:list:output-status:in-press": "inpress",
        "hres:list:output-status:published": "pub"
    });
};

P.journalCitationAttr = function(intermediate, object, attribute) {
    let journalCitationValues = attribute.value.toFields().value;
    _.each(journalCitationValues, (text, tag) => {
        intermediate.attributes.push({
            tag: tag.toLowerCase(),
            text: text
        });
    });
};

P.doiAttr = function(intermediate, object, attribute) {
    attribute.text = P.DOI.asString(attribute.value);
    intermediate.attributes.push(attribute);
    if(!("WebAddressUrl" in A) || !object.first(A.WebAddressUrl)) {
        intermediate.attributes.push({
            tag: "official_url",
            text: P.DOI.url(attribute.value)
        });
    }
};

P.refTitleAttr = function(intermediate, object, attribute) {
    if(O.isRef(attribute.value)) {
        attribute.text = attribute.value.load().title;
    } else {
        attribute.text = attribute.value.toString();
    }
    intermediate.attributes.push(attribute);
};

P.embargoAttrs = function(intermediate, object, attribute) {
    let embargoQuery = O.serviceMaybe("hres_repo_embargoes:get_embargo", object);
    attribute.tag = "full_text_status";
    if(embargoQuery && embargoQuery.length) {
        let embargo = embargoQuery[0];
        // if the embargo start date is in the past
        // and an end date isn't set or the end date is in the future
        // then add embargo information to the intermediate
        if((embargo.start && embargo.start <= new Date()) &&
            (!embargo.end || embargo.end > new Date())) {
            attribute.text = "restricted";
            let licenseAttr = {
                tag: "rioxx2_license_ref_input",
                properties: {}
            };
            if(embargo.licenseURL) {
                licenseAttr.properties.license_ref = embargo.licenseURL;
            }
            if(embargo.start) {
                licenseAttr.properties.start_date = new XDate(embargo.start).
                                                        toString("yyyy-MM-dd");
            }
            if(!_.isEmpty(licenseAttr.properties)) {
                intermediate.attributes.push(licenseAttr);
            }
            // TODO set embargo end date on <document> once we export files
        } else {
            attribute.text = "public";
        }
    } else {
        let hasFile;
        object.every((v,d,q) => {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                hasFile = true;
            }
        });
        if(hasFile) {
            attribute.text = "public";
        } else {
            attribute.text = "none";
        }
    }
    if(attribute.text) {
        intermediate.attributes.push(attribute);
    }
};

P.subjectsAttr = function(intermediate, object, attribute) {
    if(O.isRef(attribute.value)) {
        attribute.properties = [attribute.value.load().title];
        intermediate.attributes.push(attribute);
    }
};

var REF_UOA_LOOKUP = {
    a: "AB",
    b: "AB",
    c: "CD",
    d: "CD"
};

P.refUoaAttr = function(intermediate, object, attribute) {
    // may have multiple REF UoAs but only take the panel from the first one
    if(_.last(intermediate.attributes).tag === attribute.tag) { return; }
    const panel = attribute.value.load().first(A.REFPanel);
    const panelBehaviour = panel && panel.behaviour;
    if(!panelBehaviour) { return; }
    const panelBehaviourParts = panelBehaviour.split("panel-");
    const panelLetter = panelBehaviourParts.length > 1 ? panelBehaviourParts[1] : undefined;
    if(!panelLetter || !(panelLetter in REF_UOA_LOOKUP)) { return; }
    attribute.text = REF_UOA_LOOKUP[panelLetter];
    intermediate.attributes.push(attribute);
};

P.acceptedDateAttr = function(intermediate, object, attribute) {
    if(attribute.qual == Q.Accepted) {
        attribute.text = new XDate(attribute.value.start).toString("yyyy-MM-dd");
        intermediate.attributes.push(attribute);
    }
};

P.depositedDateAttr = function(intermediate, object, attribute) {
    if(attribute.qual == Q.Deposited) {
        attribute.text = new XDate(attribute.value.start).toString("yyyy-MM-dd HH:mm:ss");
        intermediate.attributes.push(attribute);
    }
};

P.firstFileDepositAttr = function(intermediate, object, attribute) {
    let firstFileDeposit = O.serviceMaybe("hres_ref_repository:get_first_file_deposit", object);
    if(firstFileDeposit) {
        attribute.text = new XDate(firstFileDeposit.date).toString("yyyy-MM-dd");
        intermediate.attributes.push(attribute);
        let fcdVersion = _.clone(attribute);
        fcdVersion.tag = "hoa_version_fcd";
        fcdVersion.text = {
            "hres:attribute:accepted-author-manuscript": "AM",
            "hres:attribute:published-file": "VoR"
        }[firstFileDeposit.fileVersion];
        intermediate.attributes.push(fcdVersion);
    }
};

var REF_EXCEPTION_ATTR_LOOKUP = {
    "technical-a": ["hoa_ex_tec", "a"],
    "technical-b": ["hoa_ex_tec", "b"],
    "technical-c": ["hoa_ex_tec", "c"],
    "technical-d": ["hoa_ex_tec", "d"],
    "deposit-a": ["hoa_ex_dep", "a"],
    "deposit-b": ["hoa_ex_dep", "b"],
    "deposit-c": ["hoa_ex_dep", "c"],
    "deposit-d": ["hoa_ex_dep", "d"],
    "deposit-e": ["hoa_ex_dep", "e"],
    "deposit-f": ["hoa_ex_dep", "f"],
    "access-a": ["hoa_ex_acc", "a"],
    "access-b": ["hoa_ex_acc", "b"],
    "access-c": ["hoa_ex_acc", "c"],
    "other": ["hoa_ex_acc", "TRUE"]
};

P.refExceptionAttr = function(intermediate, object, attribute) {
    let REFException = O.serviceMaybe("hres_ref_repository:get_exception", object);
    if(REFException) {
        let exceptionInfo = REF_EXCEPTION_ATTR_LOOKUP[REFException.kind];
        attribute.tag = exceptionInfo[0];
        attribute.text = exceptionInfo[1];
        intermediate.attributes.push(attribute);
    }
};

P.versionNumber = function(intermediate, object, attribute) {
    attribute.text = object.version.toString();
    intermediate.attributes.push(attribute);
};
