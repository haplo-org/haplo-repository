/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


let SearchByFieldsForm = P.form("search_by_fields", "form/search_by_fields.json");

const NUMBER_OTHER_FIELDS = 5;
const DEFAULT_OTHER_FIELDS = [A.Abstract, A.Keywords, A.Journal, A.Publisher];

const FIELDS = [
    ["title",   "title:"],
    ["author",  "author:"],
    ["type",    "type:"]
];

let removeSpecialSearchCharacters = function(str) {
    return str.replace(/[\(\):\/#]+/g, '');
};

P.webPublication.feature("hres:repository:common:search-by-fields", function(publication, spec) {

    // Choices scoped to this feature, as some many be different for each use
    let choicesType;
    let choicesField;

    publication.respondToExactPathAllowingPOST(spec.path, function(E, context) {
        // Lazily set up choices
        if(!choicesType) {
            choicesType = SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item").map((ref) => {
                return SCHEMA.getTypeInfo(ref).name;
            }).sort();
        }
        if(!choicesField) {
            choicesField = (spec.fields || DEFAULT_OTHER_FIELDS).map((desc) => {
                var i = SCHEMA.getAttributeInfo(desc);
                return [i.shortName, i.name];
            });
        }

        // Form a search query and redirect to main search page
        E.setResponsiblePlugin(P);
        let fields = {};
        let form = SearchByFieldsForm.instance(fields);
        form.choices("types", choicesType);
        form.choices("fields", choicesField);
        form.update(E.request);
        if(form.complete) {
            let components = [];
            FIELDS.forEach((f) => {
                let [path, prefix] = f;
                let v = _.strip(removeSpecialSearchCharacters(fields[path]||''));
                if(v) {
                    components.push(prefix+v);
                }
            });
            if(fields.yearFrom || fields.yearTo) {
                let y0 = fields.yearFrom || fields.yearTo;
                let y1 = fields.yearTo || fields.yearFrom;
                components.push("date:"+y0+'-01-01 .. '+y1+'-12-31');
            }
            for(let i = 0; i < NUMBER_OTHER_FIELDS; ++i) {
                let s = fields['f'+i];
                if(s && s.value) {
                    let v = _.strip(removeSpecialSearchCharacters(s.value));
                    if(v) {
                        let p = s.field ? removeSpecialSearchCharacters(s.field)+':' : '';
                        components.push(p+v);
                    }
                }
            }
            if(components.length) {
                var joined = components.length === 1 ?
                    components[0] :     // avoid use of brackets if there's just one search field
                    '(' + components.join(') AND (') + ')';
                E.response.redirect(spec.destination + '?q=' + encodeURIComponent(joined));
            }
        }
        E.render({
            form: form
        }, "pages/search-by-fields");
    });

});
