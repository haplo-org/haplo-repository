/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2021            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var authorDescs = [];
    var publisherDescs = [];
    var journalDescs = [];

    // Publishers
    Haplo.editor.registerDelegate("hres_repo_object_editor_lookup_publishers", function(editor, data) {
        publisherDescs = data.descs;
        return {};
    });
    // Journals
    Haplo.editor.registerDelegate("hres_repo_object_editor_lookup_journals", function(editor, data) {
        journalDescs = data.descs;
        return {};
    });

    Haplo.editor.registerRefLookupRedirector(function(desc, text) {
        if(-1 !== publisherDescs.indexOf(desc)) {
            return "/api/hres-repo-object-editor/lookup-publisher?text="+encodeURIComponent(text);
        }
        if(-1 !== journalDescs.indexOf(desc)) {
            return "/api/hres-repo-object-editor/lookup-journal?text="+encodeURIComponent(text);
        }
    });

})(jQuery);
