/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.AccessRequest.text({
    
    "workflow-process-name": "Access request",
    
    "status:author_or_frd_review": "Waiting for author or faculty confirmation",
    "status:confirm_rejection": "Waiting for confirmation of decision",
    "status-list:author_or_frd_review": "Please review the files on this repository item for release",
    "status-list:confirm_rejection": "Confirm this access request is to be declined",
    
    
    "transition-confirm:progress": "You have chosen to approve this access request. The application will be "+
        "forwarded to the responsible academic for confirmation before release.",
    "transition-confirm:progress_require_preparation": "You have chosen to approve this access request, subject"+
        " to file preparation work. Please note the required preparation actions below.",
    "transition-confirm:reject": "You have chosen to decline the access request. The files will not be released.",
    "transition-confirm:release_files": "You have chosen to grant this access request. The user will be emailed a download link "+
        "valid for one day for each of the files attached to this record.",
    "transition-confirm:send_for_preparation": "You have chosen to send the files for further preparation before they "+
        "can be released.",
    
    "transition:propose_rejection": "Decline",
    "transition-notes:propose_rejection": "Decline this access request",
    "transition-confirm:propose_rejection": "You have chosen to decline this access request. The repository team "+
        "will be notified, and the files will not be released.",
    "transition-indicator:propose_rejection": "secondary",
    
    "transition-confirm:send_for_release": "You have confirmed that the above files have been appropriately "+
        "prepared and are suitable for release for this application.",
    "transition-confirm:return_to_preparers": "You have chosen to return the files for further preparation before release.",
    
    "timeline-entry:propose_rejection": "returned the request",     // TODO: Consider if this is appropriate -- 
                                                                    // Timeline can be viewable to requester
    "docstore-panel-edit-link:filePreparation": "Submit prepared files"
    
});