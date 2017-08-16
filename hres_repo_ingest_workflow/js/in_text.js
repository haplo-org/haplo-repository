/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.Ingest.text({
    
    "workflow-process-name": "Ingest",
    
    "status:wait_editor": "Waiting for review",
    "status:on_hold": "Placed on hold",
    "status:returned_author": "Returned, awaiting further information",
    "status:published": "Published to institutional repository",
    "status:rejected": "Not suitable for deposit",
    
    "status-list:wait_editor": "Waiting for Repository team to review the submitted item",
    "status-list:returned_author": "Please add the additional information requested",
    
    "transition-indicator": "primary",
    "action-label": "Progress",
    
    "transition:publish": "Publish",
    "transition-notes:publish": "Publish this completed item record to the institutional repository.",
    "transition-confirm:publish": "You have chosen to publish this item to the institutional repository.",
    
    "transition:return": "Return to submitter",
    "transition-notes:return": "Return the item to the submitter for further information.",
    "transition-confirm:return": "You have chosen to return the item to the submitter, as additional information is required before this item can be deposited.",
    "transition-indicator:return": "secondary",
    
    "transition:place_on_hold": "Put on hold",
    "transition-notes:place_on_hold": "Put the deposit process on hold while waiting for additional information from external sources.",
    "transition-confirm:place_on_hold": "You have chosen to put the deposit process on hold, and will reactivate it when the requested information has been received.",
    "transition-indicator:place_on_hold": "secondary",
    
    "transition:submit": "Resubmit",
    "transition-notes:submit": "Resubmit the item with amended information for review by repository staff.",
    "transition-confirm:submit": "You have chosen to resubmit the item, having added the requested amendments to the item.",
    
    "transition:reject": "Reject",
    "transition-notes:reject": "Reject the item. The item is not suitable for the repository, and should not be deposited.",
    "transition-confirm:reject": "Reject the item. This item is not suitable for the repository, and should not be deposited.",
    "transition-indicator:reject": "terminal",
    
    "timeline-entry:START": "submitted the item for review",
    "timeline-entry:publish": "publised the item to the institutional repository",
    "timeline-entry:return": "returned the item to the submitter",
    "timeline-entry:place_on_hold": "placed the deposit process on hold",
    "timeline-entry:submit": "resubmitted the item for review",
    "timeline-entry:reject": "rejected the item as unsuitable for deposit",

    "notes-explanation-everyone": "Notes can be seen by the submitter and all staff reviewing this request",
    "notes-explanation-private": "Seen only by staff reviewing this request, not seen by the submitter"

});
