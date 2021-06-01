/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var createJournalCitation = P.implementTextType("hres:journal_citation", "Journal citation", {
    string: function(value) {
        var s = _.compact([
                value.volume,
                value.number ? '('+value.number+')' : undefined
            ]).join(' ');
        if(value.pageRange) {
            if(s) { s += ', '; }
            s += (-1 !== value.pageRange.indexOf("-")) ? 'pp. ' : 'p. ';
            s += value.pageRange;
        }
        return s;
    },
    indexable: function(value) {
        return _.compact([value.volume, value.number, value.pageRange]).join(' ');
    },
    render: function(value) {
        return _.escape(this.string(value));
    },
    $setupEditorPlugin: function(value) {
        P.template("include_journal_citation_plugin").render();   // hack to include client side support
    }
});

// --------------------------------------------------------------------------

P.implementService("hres:journal_citation:append_citation_to_object", function(mutableObject, desc, qual, spec) {
    var citation;
    if("volume" in spec) {
        citation = createJournalCitation(spec);
    } else {
        throw new Error("Invalid specification passed to hres:journal_citation:append_citation_to_object");
    }

    mutableObject.append(citation, desc, qual);
});

P.implementService("hres:journal_citation:create", function(spec) {
    return createJournalCitation(spec);
});

// --------------------------------------------------------------------------

P.implementService("haplo:data-import-framework:structured-data-type:add-destination:hres:journal-citation", function(model) {
    model.addDestination({
        name: "value:hres:journal-citation",
        title: "Journal citation value (structured value)",
        displaySort: 999999,
        pseudo: true,
        kind: "dictionary",
        dictionaryNames: {
            volume: {
                description: "Volume of the journal",
                type: "text",
                required: true
            },
            number: {
                description: "Issue number",
                type: "text"
            },
            pageRange: {
                description: "Page range, list of pages, or singular page. e.g. '90-94', or '98,99', or '91'",
                type: "text"
            },
            firstPage: {
                description: "First page in the page range",
                type: "text"
            },
            lastPage: {
                description: "Last page in the page range",
                type: "text"
            }
        },
        valueTransformerConstructor(batch, specification, sourceDetailsForErrors) {
            return function(value) {
                if(typeof(value) !== 'object') { return undefined; }
                if(!value.pageRange && value.firstPage) {
                    let pageRange = [value.firstPage];
                    if(value.lastPage) { pageRange.push(value.lastPage); }
                    value.pageRange = pageRange.join("-");
                }
                return createJournalCitation(value);
            };
        }
    });
});