/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.workflow.registerWorkflowFeature("hres:ref_compliance", function(workflow, spec) {
    
    workflow.actionPanelTransitionUI({state:"wait_editor"}, function(M, builder) {
        if(M.workUnit.isActionableBy(O.currentUser)) {
            var output = M.workUnit.ref.load();
            _.each(M.transitions.list, function(t) {
                builder.link(150,
                    (t.name === "publish" &&
                        P.isREFOARelevent(output) &&
                        !P.willPassOnDeposit(output)) ?
                        "/do/hres-ref-repo/choose-exception/"+output.ref :
                        "/do/workflow/transition/"+M.workUnit.id+"?transition="+t.name,
                    t.label, t.indicator);
            });
            return true;
        }
    });

    workflow.observeEnter({state:"published"}, function(M, transition, previous) {
        var output = M.workUnit.ref.load();
        if(!P.isREFOARelevent(output)) { return; }
        
        // Does it already have a compliant file deposit?
        if(!P.getFirstFileDeposit(output)) {
            // Note: Order significant. Choose the PublishedFile preferentially if both present
            [A.PublishersVersion, A.AcceptedAuthorManuscript].forEach(function(desc) {
                if(output.first(desc)) {
                    P.db.firstFileDeposit.create({
                        output: output.ref,
                        date: new Date(),
                        fileVersion: SCHEMA.getAttributeInfo(desc).code,
                        objectVersion: output.version
                    }).save();
                    return;
                }
            });        
        }
    });
    
});
