/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


// TODO: Refactor this out of the editor plugin
P.implementTextType("hres:journal_citation", "Journal citation", {
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
        P.template("include_repo_editor_plugin").render();   // hack to include client side support
    }
});
