title: Symplectic Elements EPrints Emulation Integration
module_owner: Tom/Ben
--

This plugin allows repository items to be deposited to (and harvested back from) the repository by Symplectic Elements, via their "RT2 connector":https://symplectic.co.uk/rt2/.

To do this we implement a clone of the EPrints update API, to allow Elements to treat Haplo systems as though they are EPrints installations.

h2. OAI-PMH

Elements reads records back through a special-purpose OAI-PMH interface, made available at a different, unpublicised, endpoint.


h2. Permissions Implications

Items deposited via Elements are sent for review within Haplo, and so are not usually available in public interfaces until that review process has been conpleted.

However, for the integration to function Symplectic need to be able to read the objects back via OAI-PMH. As they are currently unable to add authentication to their OAI-PMH harvester, we allow objects deposited via Elements to be read by this plugin's special-purpose OAI-PMH endpoint.

This exposes the object metadata, however it does *not* allow file downloads, since this is handled by the repository's public interface, which has a different service user. Since that user doesn't have read permissions at the deposited object until it has been reviewed, the files cannot be downloaded.

This reduction in security of the system is necessary to match EPrints behaviour.


h2. Setup

Installing the plugin creates a service user called "Symplectic Elements". An API Key will need to be created for this user, granting access to @/api/symplectic-elements-eprints-emulation@.

When initially uploading and testing the integration you will want to set @"hres_repo_symplectic_elements_eprints_emulation:enable_logging": true@ in your application's config data. This will log every request to the plugin's "EPrints" emulation interface to a database on the server, so it can be queried for debugging purposes.


h2. The EPrints deposit process

This involves several api calls.

h3. POST /id/contents

Posting an EPrints XML body creates a StoreObject record for the output. We return an "EPrint ID" for the record (which is the @objid@ of the StoreObject ref for the record created)

h3. POST /id/eprint/@<eprintid>@

Files are uploaded for this record. Each file has a "document id", which is just an integer starting at 1 and increasing with each file uploaded.

h3. PUT /id/document/@<documentid>@

This request provides metadata for the file identified by @documentid@, such as license, what attribute it should be associated with, etc. The content of the put request is XML, which also specifies the EPrint ID that this document metadata upload refers to.

