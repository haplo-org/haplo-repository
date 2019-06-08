/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("std:action_panel:category:hres:repository_item", function(display, builder) {
    var wus = O.work.query().
        tag("hres:repository:is_ar_workflow", "1").
        tag("ref", display.object.ref.toString()).
        isEitherOpenOrClosed();
    if(wus.length) {
        var panel = builder.panel(1000);
        var anyVisible = false;
        _.each(wus, function(wu) {
            var workflow = O.service("std:workflow:definition_for_name", wu.workType);
            var M = workflow.instance(wu);
            if(M.workflowServiceMaybe("ar:can_view_workflow", O.currentUser)) {
                var submitter = M.workflowServiceMaybe("ar:requestor_details");
                var text = wu.closed ? 
                    (M.state === "rejected" ? "(Declined) " : "") :
                    "(Pending) ";
                if(submitter) {
                    text = text+submitter.name;
                }
                panel.link(100, M.url, text);
                anyVisible = true;
            }
        });
        if(anyVisible) {
            panel.element(0, {title: "Access Requests"});
        }
    }
});
