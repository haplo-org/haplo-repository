/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

t.test(() => {

    let object = O.object().
        appendTitle("Test embargoes lifted daily").
        appendType(TYPE["hres:type:journal-article"]);
    let extension = object.newAttributeGroup(ATTR["hres:attribute:accepted-author-manuscript"]);
    object.append("test", A.File, undefined, extension).
        save();

    let today = new XDate().clearTime();
    const yesterday = today.clone().addDays(-1).toDate();
    const tomorrow = today.clone().addDays(1).toDate();
    today = today.toDate();

    // Add whole record embargo ending today
    // Will also embargo attribute groups
    P.db.embargoes.create({
        object: object.ref,
        start: new XDate(2018, 12, 1).toDate(),
        end: today
    }).save();

    var assertEmbargoesAreAsExpected = function(date, isEmbargoed) {
        const obj = object.ref.load();
        t.assertEqual(obj.labels.includes(Label.EmbargoAllFiles), isEmbargoed);
        const groups = obj.extractAllAttributeGroups();
        _.each(groups.groups, (group) => {
            const shouldLabel = P.shouldLabelAttributeGroupObject(obj, group.extension.groupId, date);
            t.assertEqual(shouldLabel, isEmbargoed);
        });
    };

    // Set plugin data to mock the update hook having been last run yesterday
    P.data['lastLiftedEmbargoes'] = yesterday.toString();
    P.relabelForEmbargoes(object.ref.load());
    // check setup has labelled object correctly
    assertEmbargoesAreAsExpected(today, true);
    // Embargoes remains in place on embargo end date
    P.liftEmbargoesDaily(today);
    assertEmbargoesAreAsExpected(today, true);
    // Embargoes are lifted on day after embargo end date
    P.liftEmbargoesDaily(tomorrow);
    assertEmbargoesAreAsExpected(tomorrow, false);

});