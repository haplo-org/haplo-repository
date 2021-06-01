
These scripts allow you to maintain Digital Commons URLs and map OAI-PMH identifiers when moving to Haplo Repository.

Two files will be output:

- Redirections, mapping Digital Commons URLs to Haplo URLs, so you can set up a redirection services on the old Digital Commons hostname,

- OAI-PMH mappings, so you can provide migration information to other services.

- Sitemap files which will assist with making search engine hostname moves.


1) Import Digital Commons data

See importer documentation.


2) Extract information from the Haplo Repository

Log into the Haplo server, and copy the digital-commons-get-import-information.rb script to the server.

Change the APPLICATION_ID to match the imported application.

Run the script:

    script/runner path/to/digital-commons-get-import-information.rb

It will print the output filename, download this file for the next step.


3) Generate redirects and mappings

Ensure JRuby is installed on your computer. You get get it from https://www.jruby.org/

Install the builder gem with

    jgem install builder

Gather the Digital Commons JSON file you imported into Haplo Repository, and the information exported from step 2.

Run the digital-commons-generate-redirects-and-mappings.rb script, giving it the two files and the hostname of the old repository.

   jruby digital-commons-generate-redirects-and-mappings.rb path/to/appXXXXXX-digital-commons-mapping-info.json path/to/export_digital_commons.json oldrepo.example.ac.uk

The output files will be written to the current directory.
