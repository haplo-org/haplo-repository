title: Github repository
--

Provides GitHub integration into the Haplo repository, allowing users to see their repositories and create software outputs from the repositories importing the repository title, description, topics, url, and a zip archive of the repository.

*NB: Configuration data: "hres_github:requested_scope" from [node:hres/hres_github] must have "repo" in the scope for this plugin to work*

h2. Configuration data

h3. "hres_github:affiliations_to_list"

h4. Expected type: String - Default value: "owner"

This is a comma separated value list of which repositories to show by affiliation, options are @owner@, @collaborator@, @organization_member@ increasing the affiliation scope doesn't allow the user to see anything they wouldn't normally, however does impact which repositories they can import. Defaulting to owner so that they can only import their own repositories.

h2. Services

h3(service). "hres_repo_harvest_claim:notify:task_created"

h4. Arguments

|wu|Work unit that was created by the harvest claim framework|

This service is implemented in to allow plugins to act on a workunit created by the harvest claim framework, in this instance it is checking that the item to claim came from this plugin & then is attaching a note to the task based on this.

<pre>language=javascript
P.implementService("hres_repo_harvest_claim:notify:task_created", function(wu) {
    if(wu.data.source === "GitHub" && wu.actionableBy.id === O.group(Group.RepositoryEditors).id) {
        wu.data.taskNote = "This note will display underneath the task in the task list.";
        wu.save();
    }
});
</pre>