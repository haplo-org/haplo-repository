/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var ENDNOTE_FIELDS = [
    {name:"%A",  attr:A.AuthorsCitation},
    {name:"%B",  attr:A.Event},
    {name:"%C",  attr:A.PlaceOfPublication},
    {name:"%D",  attr:A.Date},
    {name:"%E",  attr:A.EditorsCitation},
    {name:"%F",  value(obj) { return obj.ref.toString(); } },   // ref
    {name:"%I",  attr:A.Publisher},
    {name:"%J",  attr:A.Journal},
    {name:"%K",  attr:A.Keywords},
    {name:"%N",  value(obj) {
        if(obj.first(A.JournalCitation)) {
            return obj.first(A.JournalCitation).toFields().value.issue;
        }
    }},
    {name:"%P",  attr:A.PageRange},
    {name:"%P",  value(obj) {
        if(obj.first(A.JournalCitation)) {
            return obj.first(A.JournalCitation).toFields().value.pageRange;
        }
    }},
    {name:"%T",  attr:A.Title},
    {name:"%U",  value(obj) { return O.service("hres:repository:common:public-url-for-object", obj); }},
    {name:"%V",  value(obj) {
        if(obj.first(A.JournalCitation)) {
            return obj.first(A.JournalCitation).toFields().value.volume;
        }
    }},
    {name:"%W",  value(obj) { return "Haplo Repository"; }}, // Database provider
    {name:"%X",  attr:A.Abstract},
    {name:"%7",  attr:A.Edition},
    {name:"%@",  value(obj) {
        return obj.first(A.ISSN) || obj.first(A.ISBN);
    }},
    {name:"%>", value(obj) {
        let files = [];
        obj.every(A.File, v => {
            files.push(O.service("hres:repository:common:public-url-for-file", v)); 
        });
        return files.length > 0 ? files.join(" ") : undefined;
    }},
    // Additional notes field, used for anything without a specific field
    {name:"%Z", value(obj) {
        let additionalInfo,
            dates = [];
        if("PublicationProcessDates" in A) {
            obj.every(A.PublicationProcessDates, (v,d,q) => {
                let qual = SCHEMA.getQualifierInfo(q);
                dates.push(qual.name + " " + v.toString());
            });
            additionalInfo = dates.length > 0 ? "Publication process dates: " + dates.join(", ") : undefined;
        }
        if("License" in A) {
            let licenses = [];
            obj.every(A.License, v => {
                if(O.isRef(v)) {
                    licenses.push(O.ref(v).load().title);
                }
                if(!additionalInfo && licenses.length > 0) {
                    additionalInfo = "Licenses: " + licenses.join(", ");
                } else {
                    additionalInfo += dates.length > 0 ? "| Licenses: " + licenses.join(", ") : "";
                }
            });
        }

        return additionalInfo;
    }},
    {name:"%~",  value(obj) { return O.service("hres:repository:common:public-url-hostname"); }}
];
if("DOI" in A) {
    ENDNOTE_FIELDS.push({name:"%R", value(obj) {
            return obj.first(A.DOI) ? obj.first(A.DOI).toString().substr(4) : "";
        }
    });
}

var TYPE_MAP = {
    "Audiovisual Material": T.DigitalOrVisualMedia,
    "Book": T.Book,
    "Book Section": T.BookChapter,
    "Classical Work": T.Performance,
    "Computer Program": T.Software,
    "Conference Paper": T.ConferencePaper,
    "Conference Proceedings": T.ConferenceItem,
    "Figure": T.Design,
    "Journal Article": T.JournalArticle,
    "Online Database": T.Dataset,
    "Patent": T.Patent,
    "Report": T.Report,
    "Thesis": T.Thesis,
    "Web Page": T.Website
};

var getAttrValue = function(v) {
    return O.isRef(v) ? v.load().title : v.toString().replace(/\n|\r\n/g, " ");
};

var getEndnoteForItem = function(item) {
    let record = "";
    let foundType = _.find(TYPE_MAP, (type, endnoteType) => {
    if(item.isKindOf(type)) {
        record += "%0 "+endnoteType+"\n";
        return true;
    }
    });
    if(!foundType) { record += "%0 Generic\n"; }
    _.each(ENDNOTE_FIELDS, (field) => {
        if(field.attr) {
            item.every(field.attr, (v,d,q) => {
                record += field.name+" "+getAttrValue(v)+"\n";
            });
        } else {
            if(field.value(item)) {
                record += field.name+" "+field.value(item)+"\n";
            }
        }
    });
    return record;
};

P.implementService("hres:repository:endnote:export-object-as-binary-data", function(item) {
    let record = getEndnoteForItem(item);
    return O.binaryData(record, {
        filename: item.title+".enw",
        mimeType: "text/plain"
    });
});

P.implementService("hres:repository:endnote:export-object-as-binary-data-multiple", function(items) {
    let record = "";
    _.each(items, item => {
        record += getEndnoteForItem(item) + "\n";
    });
    return O.binaryData(record, {
        filename: "search_export.enw",
        mimeType: "text/plain"
    });
});
