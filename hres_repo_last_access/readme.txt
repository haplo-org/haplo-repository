title: Repository last access
module_owner: Taylor
--

This plugin provides last access date tracking for repository items, in compliance with EPSRC requirements.

h2. Services


h3(service). "hres:repository:get_last_access_for_output"

Takes a single argument which is an object or a ref of an output and returns the javascript date object of when it was last downloaded by a third party (from the web publication).