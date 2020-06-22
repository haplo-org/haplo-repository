/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

(function($) {
    var taskLink = "This repository is being harvested, when it is done it will appear in your <a href='/do/tasks'>Tasks</a>, the zip archive of your repository will be downloaded and attached in the background.";
    $(function() {
        $(".createRecord").on("click", function(evt) {
            var repo = $(this).data("repo");
            var owner = $(this).data("owner");
            var token = $('input[name="__"]').val();
            $.post("/do/hres-github-repository/make-software-output", {"__":token,repo:repo,owner:owner});
            $(this).replaceWith(taskLink);
        });
    });
})(jQuery);