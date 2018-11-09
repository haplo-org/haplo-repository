title: Repo Ingest Start UI
module_owner: Tom
--

This plugin provides additional UI to guide researchers through creating a new repository item record. This involves setting up the list of available output types a researcher can add, rendering relevant guidance notes at the point they would be most helpful, and ensuring the list of outputs is ordered correctly for the institution.


h2. Services


h3(service). "hres:repository:ingest_ui:types"

Takes no arguments. This service should be used when listing the available repository item types in an application.

Returns an object with two keys, @primaryTypes@ and @secondaryTypes@. Each of these references an array of objects, with properties @ref@ and @name@. When listing repository item types in the UI the @primaryTypes@ should be displayed above the @secondaryTypes@. 
