title: Jisc Publications Router Integration
--

A plugin to integrate with Jisc Publications Router, and harvest outputs for an organisation signed up to this service into Haplo.

h3. PubRouter documentation

Can be found on Github:"https://github.com/jisc-services/Public-Documentation/blob/master/PublicationsRouter/api/v3"

h3. Configuration

All that needs to be configured in the client system is to add a Username/Password keychain entry with the same name as the config data below.

h3(config). "hres_repo_jisc_pub_router:credential_name"

h4. Default value: Publications Router

The @Name@ of the keychain entry containing the publications router account information for the client.

h4. Adding the keychain entry

The keychain entry must be added as a Username/Password combo where @Username@ is the client's @client id@ for Publications Router and @Password@ is their API key. This will have been supplied to the client when they signed up for Publications Router with Jisc.


h3. Admin

@/do/hres-repo-jisc-pub-router/import?since=YYYY-MM-DD@

Retrieves the notifications for this application since the (optional) supplied date. To be used for an initial import (where the since parameter isn't optional) or to manually override and reimport if the import hasn't run.


@/do/hres-repo-jisc-pub-router/downloaded-files-status@

Returns JSON detailing the locations of any files downloaded from PubRouter, and any errors found when downloading.
