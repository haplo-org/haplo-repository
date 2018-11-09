title: DOI Minting
------------------


This plugin provides the infrastructure for minting DOIs from a Haplo repository. The minimal setup involves setting only configuration data and a Keychain Credential. This will then mint DOIs for configured items and add them to their records in the object store.

h2. Setup

* Set @"hres:doi:minting:safety-application-hostname"@ in config data to the application's hostname.
* Set @"hres:doi:minting:doi-prefix"@ in config data to the DOI prefix used for this app. End with a / or .
      DataCite's test prefix is 10.5072, append a suffix such as /hostname/ or something when testing.
* Set @"hres:doi:minting:doi-prefix-for-update"@ to an array of DOI prefixes which should be updated when the object changes. (It may not be just the copy of the prefix for new DOIs, as we want to be able to update DOIs imported from other repositories.)
* Check @"hres:doi:minting:service-url"@ is set to the URL of the metadata store you want to mint DOIs.
* Create an "HTTP / Basic" keychain credential named "DOI Minting" containing the institution's DataCite username and password.



h3(service). "hres:doi:minting:get-should-have-doi-function"

This service should be implemented in a client plugin, and return a function that controls whether a store object should have a DOI. The function will be called with the store object as it's only argument, and should return a boolean.

The default implementation for this is:

<pre>language=javascript
var defaultShouldHaveDOIimpl = function(object) {
    return object.labels.includes(Label.RepositoryItem);
};
</pre>
