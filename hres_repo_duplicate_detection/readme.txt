title: Repository duplicate item detection
module_owner: Taylor
--

This plugin allows users to see existing repository items which have other items with matching identifiers. This plugin adds a small UI to show matching items and the identifier they've been matched on, and also a reporting dashboard for duplicates.

h2. Services

h3(service). "hres:repository:find_matching_items_by_identifier"

This service is implemented by various identifiers that are used by the repository (e.g. DOI, Handle, PubMedID, PubMedCentralID), and is used to find items that match the provided output and append them to the list provided.

Example implementations can be found in the relevant plugins listed above, the DOI implementation is repeated here for ease of reference:

<pre>language=javascript
P.implementService("hres:repository:find_matching_items_by_identifier", function(object, results) {
    let dois = object.every(A.DigitalObjectIdentifierDOI);
    if(dois.length) {
        O.query().
            link(SCHEMA.getTypesWithAnnotation("hres:annotation:repository-item"), A.Type).
            or((sq) => {
                _.each(dois, (doi) => sq.identifier(doi, A.DigitalObjectIdentifierDOI));
            }).
            execute().
            each((item) => results.push({object: item, matchingDesc: A.DigitalObjectIdentifierDOI}));
    }
});
</pre>