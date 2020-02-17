title: Related output value
module_owner: Taylor
--

This plugin adds functionality to the object editor to allow adding of "Related outputs" to repository item records.

The schema for this matches the @relatedIdentifier@ element from the "Datacite 4.0 shchema":http://doi.org/10.5438/0012 with @relationType@ information stored in qualifiers and platform text types defined for each of the @relatedIdentifierType@ not included in other plugins already.

For example, this plugin defines the @hres_repository:output_identifier_arxiv@ text type for arXiv identifiers, but doesn't define an ISBN text type since this is already provided by the platform.

