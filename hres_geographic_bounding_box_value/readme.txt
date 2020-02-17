title: Geographic bounding box value
module_owner: Taylor
--

This plugin provides the @hres:geographic_box@ text type, for specifying geographic areas through coordinate bounding boxes.

The "box" is defined by entering the latitude/longitude coordinates of the bottom left and top right corners of a rectangular area, which are stored in the text type data as @botLeftLat@, @botLeftLong@, @topRightLat@, and @topRightLong@ respectively.

The data type isn't added to any attributes in this plugin, but is used by other plugins at higher levels of the code.