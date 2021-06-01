/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var ORCID_TYPE_MAP = {
    "artistic-performance": T.Performance,
    "book-chapter": T.BookChapter,
    "book": T.Book,
    "conference-paper": T.ConferencePaper,
    "conference-poster": T.ConferencePoster,
    "dissertation": T.Thesis,
    "invention": T.Design,
    "journal-article": T.JournalArticle,
    "lecture-speech": T.ConferenceKeynote,
    "other": T.Other,
    "patent": T.Patent,
    "report": T.Report,
    "research-tool": T.DevicesAndProducts,
    "website": T.Website
};
if("Dataset" in T) { ORCID_TYPE_MAP["data-set"] = T.Dataset; }
if("WorkingPaper" in T) { ORCID_TYPE_MAP["working-paper"] = T.WorkingPaper; }

var CONTRIBUTOR_TYPE_MAP = {
    "author": A.Author,
    "editor": A.Editor
};

var ID_TYPE_MAP = {
    "isbn": {
        desc: A.ISBN,
        transformValue(value) { return O.text(O.T_IDENTIFIER_ISBN, value); }
    },
    "issn": {
        desc: A.ISSN,
        // ISSN attribute is isbn data-type
        transformValue(value) { return O.text(O.T_IDENTIFIER_ISBN, value); }
    },
    "pat": { desc: A.PatentID }
};

if("DOI" in A) {
    P.use("hres:doi");
    ID_TYPE_MAP["doi"] = {
        desc: A.DOI,
        transformValue(value) { return P.DOI.create(value); }
    };
}
if("Handle" in A) {
    P.use("hres:hdl");
    ID_TYPE_MAP["handle"] = {
        desc: A.Handle,
        transformValue(value) { return P.Handle.create(value); }
    };
}
if("PubMedID" in A) {
    P.use("hres:pmid");
    ID_TYPE_MAP["pmc"] = {
        desc: A.PubMedCentralID,
        transformValue(value) { return P.PMID.create(value); }
    };
    ID_TYPE_MAP["pmid"] = {
        desc: A.PubMedID,
        transformValue(value) { return P.PMID.create(value); }
    };
}

var _matchPeopleServices;
var matchPeopleServices = function() {
    if(!_matchPeopleServices) {
        _matchPeopleServices = O.service("haplo:service-registry:query", [
            "conforms-to hres:repository:match-item-to-existing-in-list",
            "list-of people"
        ]);
    }
    return _matchPeopleServices;
};

var normaliseText = function(text) {
    return text.toLowerCase().replace(/[^a-z0-9]/g, "");
};

var XMLToAttribute = {
    title(cursor, object) {
        cursor.eachChildElement("title", (titleCursor) => {
            const title = titleCursor.getText().trim();
            if(!!title) {
                object.appendTitle(title);
            }
        });
    },
    "short-description"(cursor, object) {
        const abstract = cursor.getText().trim();
        if(!!abstract) {
            object.append(O.text(O.T_TEXT_PARAGRAPH, abstract), A.Abstract);
        }
    },
    // Defaults to T.Other due to ORCID having many types which don't map correctly into Haplo
    type(cursor, object) {
        let orcidType = cursor.getText().trim();
        let type = orcidType in ORCID_TYPE_MAP ? ORCID_TYPE_MAP[orcidType] : T.Other;
        object.appendType(type);
    },
    contributors(cursor, object, user) {
        let appendORCID = function(orcidString, person) {
            let orcid = P.ORCID.create(orcidString);
            if(!person.has(orcid, A.ORCID)) {
                person.append(orcid, A.ORCID);
            }
        };

        let allPeople = O.query().link(T.Person, A.Type).execute();

        let userAppended = false;
        let allUserNames = [
                user.name,
                O.service("hres:author_citation:get_citation_text_for_person_object", user.ref)
            ].concat(user.ref.load().everyTitle());
        let normalisedUserNames = _.map(allUserNames, (name) => normaliseText(name.toString()));

        cursor.eachChildElement("contributor", (contributorCursor) => {
            let testPerson = O.object();
            if(contributorCursor.firstChildElementMaybe("contributor-orcid")) {
                contributorCursor.eachChildElement("path", (pathCursor) => {
                    appendORCID(pathCursor.getText().trim(), testPerson);
                });
                contributorCursor.eachChildElement("uri", (uriCursor) => {
                    let orcidMatches = uriCursor.getText().match(/(\d{4}-){3}(\d{3}[\dX])/);
                    if(orcidMatches) {
                        // First element of orcidMatches is the full match (the orcid id)
                        appendORCID(orcidMatches[0], testPerson);
                    }
                });
                contributorCursor.up();
            }
            let email = contributorCursor.getTextOfFirstChildElementMaybe("contributor-email");
            if(email && !!email.trim()) {
                testPerson.append(O.text(O.T_IDENTIFIER_EMAIL_ADDRESS, email.trim()), A.Email);
            }
            let matchObject;
            matchPeopleServices().eachService(matcher => {
                if(matchObject) { return; }
                matchObject = O.service(matcher.name, testPerson, allPeople);
            });

            let spec = {};
            if(matchObject) {
                spec.object = matchObject;
            } else if(contributorCursor.firstChildElementMaybe("credit-name")){
                // Can be citation string or full name, best guess for citation if no match found
                spec.cite = contributorCursor.getText().trim();
                contributorCursor.up();
            }

            let mappedRole;
            if(contributorCursor.firstChildElementMaybe("contributor-attributes")) {
                contributorCursor.eachChildElement("contributor-role", (roleCursor) => {
                    if(mappedRole) { return; } // Use first role for simplicity
                    let role = roleCursor.getText().trim();
                    mappedRole = role in CONTRIBUTOR_TYPE_MAP ? CONTRIBUTOR_TYPE_MAP[role] : null;
                });
                contributorCursor.up();
            }
            // Default to Author if no matching role found
            if(!mappedRole) { mappedRole = A.Author; }

            // As all contributor elements are optional it's possible no citation could be generated.
            if(!_.isEmpty(spec)) {
                if(("cite" in spec) && _.contains(normalisedUserNames, normaliseText(spec.cite))) {
                    spec.ref = user.ref;
                }
                // Only allows user to be appended once
                if(!userAppended || spec.ref != user.ref) {
                    O.service("hres:author_citation:append_citation_to_object", object, mappedRole, null, spec);
                    userAppended = userAppended || spec.ref == user.ref;
                }
            }
        });
    },
    "publication-date"(cursor, object) {
        const dateParts = _.compact([
            cursor.getTextOfFirstChildElement("year"),
            cursor.getTextOfFirstChildElementMaybe("month"),
            cursor.getTextOfFirstChildElementMaybe("day")
        ]);
        if(!_.isEmpty(dateParts)) {
            let precision;
            switch(dateParts.length) {
                case 1:
                    precision = O.PRECISION_YEAR;
                    break;
                case 2:
                    precision = O.PRECISION_MONTH;
                    break;
                case 3:
                    precision = O.PRECISION_DAY;
                    break;
            }
            const datetime = O.datetime(new Date(dateParts.join("-")), null, precision);
            object.append(datetime, A.PublicationDates);
        }
    },
    url(cursor, object) {
        const url = cursor.getText().trim();
        if(!!url) {
            object.append(O.text(O.T_IDENTIFIER_URL, url), A.URL);
        }
    },
    "external-ids"(cursor, object) {
        cursor.eachChildElement("external-id", (idCursor) => {
            let type = idCursor.getTextOfFirstChildElement("external-id-type");
            if(type in ID_TYPE_MAP) {
                let value = idCursor.getTextOfFirstChildElementMaybe("external-id-normalized") ||
                    idCursor.getTextOfFirstChildElement("external-id-value");
                let attribute = ID_TYPE_MAP[type];
                if(!!value) { value = value.trim(); }
                if(attribute.transformValue && !!value) {
                    value = attribute.transformValue(value);
                }
                object.append(value, attribute.desc);
            }
        });
    }
};

var createObjectFromXML = P.createObjectFromXML = function(cursor, userId) {
    let object = O.object([Label.RepositoryItem]);
    let user = O.user(userId);
    cursor.eachChildElement((childCursor) => {
        let nodeName = childCursor.getLocalName();
        if(nodeName in XMLToAttribute) {
            XMLToAttribute[nodeName](childCursor.cursor(), object, user);
        }
    });
    // Computes the shadowed author/editor values
    object = object.computeAttributesForced();
    if(!O.service("hres:repository:is_author", user, object)) {
        // Ensure user is always included on an output harvested from their ORCID record.
        O.service("hres:author_citation:append_citation_to_object", object, A.Author, null, {ref: user.ref});
    }
    return object;
};