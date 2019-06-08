title: OAI-PMH
module_owner: Tom
--

The "Open Archives Initiative Protocol for Metadata Harvesting" (OAI-PMH) is an interoperability framework to allow metadata harvesting between systems. It is the main machine interface for repository systems, and allows data from within Haplo to be harvested by external systems.

The framework is specified fully "here":https://www.openarchives.org/OAI/openarchivesprotocol.html, but boradly speaking it describes a series of requests that harvesting systems can make to repositories to query what records are available and in which metadata formats they can be harvested.

The aim is to provide as many different metadata formats as possible, to enable good interoperability with as many systems as possible.

This plugin provides the infrastructure for Haplo repositories to function as an OAI-PMH *data provider* - we do not yet have an OAI-PMH *client*, which would allow harvesting from external sources into Haplo via OAI-PMH.


h3. Administration

A button will be added for superusers on the top of each repository item record, to allow you to view the data exposed through OAI-PMH for that record in each of the configured metadata formats for this repository.

*NOTE* There are a few minor differences in the data displayed here and that in the machine interface. Namely: the oaiIdentifier is different (@xxxx:ref@ in this interface), the download URL for files will be different, and this interface is called with superuser permissions, so there may be more data exposed here than through the publication. The machine interface is called in the security context of the appropriate publication service user.