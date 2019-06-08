title: HRES Bibliographic Reference
--

This plugin generates the academic citation references for outputs held within a system. These are generated at render time of a page, from the metadata stored on the record, meaning that clients don't have to separately save the citation for an output and update it to track any metadata changes.

It shouldn't be depended on in @plugin.json@ files in case of a future client wanting to specify a custom citation format for their publications, when it would be replaced by a client namespaced implementation.

h3(service). @"hres_bibliographic_reference:for_object"@

Taking a single argument, the output, returns the citation string as a deferred render.

h3(service). @"hres_bibliographic_reference:plain_text_for_object"@

Taking a single argument, the output, returns the citation string as plain text, without HTML tags.


h2. Extending/Customising

**NOTE: This shouldn't be used often, and the intention is to replace this plugin at some point soon, so if what you're doing is hard, ask if we should isntead rewrite the whole plugin.**

h3(service). "hres_bibliographic_reference:extend_reference_formats"

Allows you to edit which metadata fields are used for citations, and specify how to render the data in those fields, and adjust the citation rendering for a given type. 

It's a blunt instrument tool that basically allows you to rewrite the core plugin, so there's no real point documenting all of the options here - it will be faster for you to read the code than this page!
