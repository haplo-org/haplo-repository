title: Repository Embargoes
module_owner: Tom
--

h2. Configuration data

h3(config). "hres_repo_embargoes:display_additional_action_panels"

This config data allows the embargo action panel elements (set/edit and the display) to be added to any additional action panels, by default it shows on the following panels: @"outputs"@, @"alternative_versions"@, and @"research_data"@.

This is chosen over adding embargoes to the @repository_item@ category as not all clients want to be able to use embargoes on all types of output so the config data allows more versatility in the implementation.

h2. Serialisation

This plugin adds a source to std_serialisation which to the serialised copy of a repository item adds a @repository_embargoes@ key which shows any active embargo on the object. The embargoes are displayed as JavaScript objects of the form:

<pre>language=javascript
{
    "wholeRecord": true, // true/false - denotes if the embargo affects all files on the object
    "extension": { // If not a whole record embargo this shows the groupId and desc of the files under embargo
      "groupId": null,
      "desc": null
    },
    "licenseURL": "https://example.org", // The licenseURL that's been provided for the embargo or null if none provided
    // NOTE: licenseURLs are user entered so are checked to be a valid URL (and replaced with "invalid" if not) before serialising
    "start": "2021-03-16T00:00:00.000Z", // The start date of the embargo
    "end": null // The end date of the embargo (null here represents an indefinite embargo)
}
</pre>