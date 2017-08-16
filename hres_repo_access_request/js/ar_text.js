/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.AccessRequest.text({
    
    "workflow-process-name": "Access request",
    
    "status:editor_review": "Waiting for Repository Editor review",
    "status:author_or_frd_review": "Waiting for author or faculty confirmation",
    "status:prepare_files": "Waiting for file preparation for release",
    "status:review_prepared_files": "Reviewing prepared files",
    "status:access_granted": "Access granted",
    "status:confirm_rejection": "Waiting for confirmation of decision",
    "status:rejected": "Access declined",
    
    "status-list:editor_review": "Please review the files on this repository item for release",
    "status-list:author_or_frd_review": "Please review the files on this repository item for release",
    "status-list:prepare_files": "Please prepare the files on this repository item for release",
    "status-list:review_prepared_files": "Please review the file preparation before release",
    "status-list:confirm_rejection": "Confirm this access request is to be declined",
    
    "transition-indicator": "primary",
    "action-label": "Progress",
    
    "transition:progress": "Approve",
    "transition-notes:progress": "Approve this request for file access",
    "transition-confirm:progress": "You have chosen to approve this access request. The application will be "+
        "forwarded to the responsible academic for confirmation before release.",
        
    "transition:progress_require_preparation": "Approve, subject to file preparation",
    "transition-notes:progress_require_preparation": "Approve this request for file access, subject to file "+
        "preparation work being carried out",
    "transition-confirm:progress_require_preparation": "You have chosen to approve this access request, subject"+
        " to file preparation work. Please note the required preparation actions below.",
    
    "transition:reject": "Decline",
    "transition-notes:reject": "Decline this access request",
    "transition-confirm:reject": "You have chosen to decline the access request. The files will not be released.",
    "transition-indicator:reject": "terminal",
    
    "transition:release_files": "Grant request",
    "transition-notes:release_files": "Grant this access request",
    "transition-confirm:release_files": "You have chosen to grant this access request. The user will be emailed a download link "+
        "valid for one day for each of the files attached to this record.",
    
    "transition:send_for_preparation": "Send for preparation",
    "transition-notes:send_for_preparation": "The files require preparation before they can be released. Send them "+
        "on to be appropriately prepared.",
    "transition-confirm:send_for_preparation": "You have chosen to send the files for further preparation before they "+
        "can be released.",
    
    "transition:propose_rejection": "Decline",
    "transition-notes:propose_rejection": "Decline this access request",
    "transition-confirm:propose_rejection": "You have chosen to decline this access request. The repository team "+
        "will be notified, and the files will not be released.",
    "transition-indicator:propose_rejection": "secondary",
    
    "transition:send_for_release": "Progress",
    "transition-notes:send_for_release": "File preparation is complete",
    "transition-confirm:send_for_release": "You have indicated that the files have been prepared. The repository "+
        "team will release the sanitised versions for download.",
    
    "transition:return_to_preparers": "Return",
    "transition-notes:return_to_preparers": "Return for further file preparation",
    "transition-confirm:return_to_preparers": "You have chosen to return the files for further preparation before release.",
    "transition-indicator:return_to_preparers": "secondary",
    
    "timeline-entry:START": "submitted the access request",
    "timeline-entry:progress": "forwarded the request",
    "timeline-entry:reject": "declined the request",
    "timeline-entry:release_files": "granted the request",
    "timeline-entry:send_for_preparation": "sent the files for preparation",
    "timeline-entry:propose_rejection": "returned the request",     // TODO: is this ok? Timeline can be viewable to requester
    "timeline-entry:send_for_release": "returned the prepared files",
    "timeline-entry:return_to_preparers": "returned the files for further preparation",

    "notes-explanation-everyone": "Notes can be seen by the submitter and all staff reviewing this submission",
    "notes-explanation-private": "Seen only by staff reviewing this submission, not seen by the submitter",
    
    "docstore-panel-edit-link:filePreparation": "Submit prepared files"
    
});
