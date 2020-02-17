/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    let person1 = O.object().
        appendType(T.Person).
        appendTitle("Person 1").
        save();
    let person2 = O.object().
        appendType(T.Person).
        appendTitle("Person 2").
        save();
    let object = O.object().
        appendType(TYPE["std:type:book"]).
        appendTitle("Test");

    O.service("hres:author_citation:append_citation_to_object", object, A.Author, undefined, {object: person1});
    O.service("hres:author_citation:append_citation_to_object", object, A.Editor, undefined, {object: person1});
    O.service("hres:author_citation:append_citation_to_object", object, A.Editor, undefined, {object: person2});
    object.save();

    t.assert(object.has(person1.ref, A.Researcher));
    t.assert(object.has(person2.ref, A.Researcher));
    t.assertEqual(object.every(A.Researcher).length, 2);
});
