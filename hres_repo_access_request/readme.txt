title: Access request
--

This plugin is a generic implementation of the access request workflow for outputs which have files which aren't embargoed but are restricted. This allows a user (internal or external) to make a request for access to the files, this will then go through a workflow in which the files can be sent for preparation so that they can be altered before being sent to a user.

h2. Actions

h3(action). "hres_repo_access_request:view_application"

h4. Default permission allows: Group.RepositoryEditors, Group.DataPreparers

This action is for allowing users to view an access request application workflow.