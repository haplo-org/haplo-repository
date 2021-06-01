/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

if(O.featureImplemented("hres:doi")) {
    P.use("hres:doi");
}

P.implementService("hres_repo_endnote:create_objects_from_enw_export", (enwExport) => {
    let fileContents = enwExport.readAsString('UTF-8');
    let items = fileContents.trim().split(/(\r?\n){2,}/);
    let mappedObjects = [];
    _.each(items, (item) => {
        if(!item.trim()) {
            return;
        }
        let object = O.object();
        let citation = {};
        let itemLines = item.split(/\r?\n/);
        let context = {};
        _.each(itemLines, (nextLine) => {
            let nextLineSplit = nextLine.split(" ");
            let key = nextLineSplit.shift().substring(1);
            let value = nextLineSplit.join(" ");
            if(key in CITATION_KEYS) {
                CITATION_KEYS[key](citation, value);
                if(key !== "P") {
                    return;
                }
            }
            if(key in ENW_IMPORT_KEYS) {
                ENW_IMPORT_KEYS[key](object, value, context);
            }
        });
        if(!_.isEmpty(citation) && ("volume" in citation)) {
            O.serviceMaybe("hres:journal_citation:append_citation_to_object", object, A.JournalCitation, undefined, citation);
        }
        if(!context.foundCurrentUserInAuthors) {
            O.service("hres:author_citation:append_citation_to_object", object, A.Author, null, {ref:O.currentUser.ref});
        }
        if(object.firstTitle() && object.firstType()) {
            object.save();
            mappedObjects.push(object);
        }
    });
    return mappedObjects;
});

var CITATION_KEYS = {
    "N"(citation, value) {
        citation.number = value;
    },
    "P"(citation, value) {
        citation.pageRange = value;
    },
    "V"(citation, value) {
        citation.volume = value;
    },
    "6"(citation, value) {
        if(!citation.volume) {
            citation.volume = value;
        }
    }
};

var compareCurrentUserObjectToName = function(authorName, currentUserName) {
    if(currentUserName) {
        return currentUserName.toLowerCase().replace(/[^a-z0-9]/g,"") === authorName.toLowerCase().replace(/[^a-z0-9]/g,"");
    }
};

var getAuthorSpec = function(value, context) {
    let spec = {};
    let currentUserCitation = O.service("hres:author_citation:get_citation_text_for_person_object", O.currentUser.ref);
    if(compareCurrentUserObjectToName(value, currentUserCitation) || compareCurrentUserObjectToName(value, O.currentUser.name)) {
        spec.ref = O.currentUser.ref;
        context.foundCurrentUserInAuthors = true;
    } else {
        spec.cite = value;
    }
    return spec;
};

var ENW_IMPORT_KEYS = {
    "A"(object, value, context) {
        O.service("hres:author_citation:append_citation_to_object", object, A.Author, null, getAuthorSpec(value, context));
    },
    "B"(object, value, context) {
        //append Secondary Title (of a Book or Conference Name)
        if(object.isKindOf(T.Book)) {
            object.append(value, A.BookTitle);
        } else if(object.isKindOf(T.ConferenceItem)) {
            object.append(value, A.Event);
        } else {
            object.appendTitle(value, Q.Alternative);
        }
    },
    "C"(object, value, context) {
        object.append(value, A.PlaceOfPublication);
    },
    "D"(object, value, context) {
        //append Year
        object.append(O.datetime(new XDate(value), undefined, O.PRECISION_YEAR), A.Date);
    },
    "E"(object, value, context) {
        //append Editor/Secondary Author
        O.service("hres:author_citation:append_citation_to_object", object, A.Editor, null, getAuthorSpec(value, context));
    },
    "H"(object, value, context) {
        //append Translated Author
        O.service("hres:author_citation:append_citation_to_object", object, A.Author, null, getAuthorSpec(value, context));
    },
    "I"(object, value, context) {
        object.append(value, A.Publisher);
    },
    "J"(object, value, context) {
        object.append(value, A.Journal);
    },
    "K"(object, value, context) {
        object.append(value, A.Keywords);
    },
    "O"(object, value, context) {
        //append Alternate Title
        object.appendTitle(value, Q.Alternative);
    },
    "P"(object, value, context) {
        if("Pages" in A) {
            object.append(value, A.Pages);
        }
    },
    "Q"(object, value, context) {
        //append Translated Title
        object.appendTitle(value, Q.Alternative);
    },
    "R"(object, value, context) {
        if("DOI" in A) {
            object.append(P.DOI.create(value), A.DOI);
        }
        
    },
    "S"(object, value, context) {
        //append Tertiary Title
        object.appendTitle(value, Q.Alternative);
    },
    "T"(object, value, context) {
        object.appendTitle(value);
    },
    "U"(object, value, context) {
        object.append(O.text(O.T_IDENTIFIER_URL, value), A.URL);
    },
    "X"(object, value, context) {
        object.append(value, A.Abstract);
    },
    "Y"(object, value, context) {
        //append Tertiary Author / Translator
        O.service("hres:author_citation:append_citation_to_object", object, A.Author, null, getAuthorSpec(value, context));
    },
    "Z"(object, value, context) {
        object.append(value, A.Notes);
    },
    "0"(object, value, context) {
        //append Reference Type
        _ensureReferenceTypesSet();
        if(value in ENW_REFERENCE_TYPE) {
            object.appendType(ENW_REFERENCE_TYPE[value]);
        } else if("Other" in ENW_REFERENCE_TYPE) {
            object.appendType(ENW_REFERENCE_TYPE["Other"]);
        }
    },
    "7"(object, value, context) {
        object.append(value, A.Edition);
    },
    "8"(object, value, context) {
        //append Date
        let [start, end] = value.replace(/\d(th|st|nd|rd)/gi, "").split(/\s?-\s?/);
        let startParts = _.map(start.trim().split(" "), (part) => part.trim());

        let datePrecision = [O.PRECISION_YEAR, O.PRECISION_MONTH, O.PRECISION_DAY];

        if(end) {
            let trimmedEnd = end.trim();
            let endParts = _.map(trimmedEnd.split(" "), (part) => part.trim());

            if(startParts.length < endParts.length) {
                for(let i = startParts.length; startParts.length < endParts.length; i++) {
                    startParts[i] = endParts[i];
                }
            }
            let endDate;
            let endPrecision = endParts.length;

            if(endPrecision === 2 && endParts[1].match(/\d{4}/)) { //e.g. matches 04 2020 or April 2020
                endParts.unshift(1);
                endDate = new Date(endParts.join(" "));
            } else {
                endDate = new Date(trimmedEnd);
            }
            if(!isNaN(endDate)) {
                object.append(O.datetime(endDate, null, datePrecision[endPrecision-1]), A.Date);
            } else {
                object.append(trimmedEnd, A.Date);
            }
        }

        let startPrecision = startParts.length;
        if(startPrecision === 2 && startParts[1].match(/\d{4}/)) {
            startParts.unshift(1);
        }

        start = startParts.join(" ");
        let startDate = new Date(start);

        if(!isNaN(startDate)) {
            object.append(O.datetime(startDate, null, datePrecision[startPrecision-1]), A.Date);
        } else {
            object.append(start, A.Date);
        }
    },
    "?"(object, value, context) {
        //append Subsidiary Author
        O.service("hres:author_citation:append_citation_to_object", object, A.Author, null, getAuthorSpec(value, context));
    },
    "@"(object, value, context) {
        //append ISBN/ISSN
        if(object.isKindOf(T.Book) || object.isKindOf(T.BookChapter)) {
            if(!value.match(/\d{4}-\d{4}/)) {
                object.append(value, A.ISBN);
            }
        }
        object.append(value, A.ISSN);
    },
    "!"(object, value, context) {
        //append Short Title
        object.appendTitle(value, Q.Alternative);
    },
    "<"(object, value, context) {
        //append Research Notes
        object.append(value, A.Notes);
    }
};

var ENW_REFERENCE_TYPE = {};

var _ensureReferenceTypesSet = function() {
    if(_.isEmpty(ENW_REFERENCE_TYPE)) {
        if("Other" in T) { ENW_REFERENCE_TYPE["Other"] = T.Other;}
        if("Dataset" in T) { ENW_REFERENCE_TYPE["Aggregated Database"] = T.Dataset; }

        ENW_REFERENCE_TYPE["Artwork"] =T.DigitalOrVisualMedia;
        ENW_REFERENCE_TYPE["Audiovisual Material"] = T.DigitalOrVisualMedia;
        ENW_REFERENCE_TYPE["Blog"] = T.DigitalOrVisualMedia;
        ENW_REFERENCE_TYPE["Book"] = T.Book;
        ENW_REFERENCE_TYPE["Book Section"] = T.BookChapter;
        ENW_REFERENCE_TYPE["Classical Work"] = T.Performance;
        ENW_REFERENCE_TYPE["Computer Program"] = T.Software;
        ENW_REFERENCE_TYPE["Journal Article"] = T.JournalArticle;
        ENW_REFERENCE_TYPE["Magazine Article"] = T.JournalArticle;
        ENW_REFERENCE_TYPE["Music"] = T.Performance;
        ENW_REFERENCE_TYPE["Newspaper Article"] = T.JournalArticle;
        ENW_REFERENCE_TYPE["Online Database"] = T.Dataset;
        ENW_REFERENCE_TYPE["Online Multimedia"] = T.DigitalOrVisualMedia;
        ENW_REFERENCE_TYPE["Patent"] = T.Patent;
        ENW_REFERENCE_TYPE["Conference Paper"] = T.ConferencePaper;
        ENW_REFERENCE_TYPE["Conference Proceedings"] = T.ConferenceItem;
        ENW_REFERENCE_TYPE["Edited Book"] = T.Book;
        ENW_REFERENCE_TYPE["Electronic Article"] = T.JournalArticle;
        ENW_REFERENCE_TYPE["Electronic Book"] = T.Book;
        ENW_REFERENCE_TYPE["Figure"] = T.Design;
        ENW_REFERENCE_TYPE["Film or Broadcast"] = T.DigitalOrVisualMedia;
        ENW_REFERENCE_TYPE["Report"] = T.Report;
        ENW_REFERENCE_TYPE["Thesis"] = T.Thesis;
        ENW_REFERENCE_TYPE["Web Page"] = T.Website;
    }
};
