title: Jisc Publications Router Integration
--

A plugin to integrate with Jisc Publications Router, and harvest outputs for an organisation signed up to this service into Haplo.

h3. PubRouter documentation

Can be found on Github:"https://github.com/jisc-services/Public-Documentation/blob/master/PublicationsRouter/api/v3"

h3. Configuration

All that needs to be configured in the client system is to set config data:

@"hres_repo_jisc_pub_router:end_point": "https://pubrouter.jisc.ac.uk/api/v3/routed/<client_account_id>"@

where @client_account_id@ is the "Account ID" for the repository. This will have been supplied to the client when they signed up for Publicatios Router with Jisc.

They will also have been supplied with an API key. This is not needed for the configuration of the integration, as it gives access to additional endpoints not required for our purposes.

h3. Admin

@/do/hres-repo-jisc-pub-router/import?since=YYYY-MM-DD@

Retrieves the notifications for this application since the (optional) supplied date. To be used for an initial import (where the since parameter isn't optional) or to manually override and reimport if the import hasn't run.


@/do/hres-repo-jisc-pub-router/downloaded-files-status@

Returns JSON detailing the locations of any files downloaded from PubRouter, and any errors found when downloading.
