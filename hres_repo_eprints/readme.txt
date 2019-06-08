title: Eprints import module
module_owner: Helen
--

If you are just starting out with Eprints, please check out the Eprints developer guide in the company manual, it'll be more useful than this page for now.

A plugin to allow the import and export of eprints XML.

h2. Background

To help with import and export, the two operations go through an intermediate state before they take their final form.

The intermediate data structure looks as follows:

| eprintId | string | eprint id |
| attributes | array | attributes that relate to the eprint |

Each attribute in the @attributes@ array contains:

| tag | string | eprint tag |
| desc | ref | the Haplo attribute |
| qual | ref | (optional) the Haplo qualifier |
| val | multiple | the value as would be appended to an attribute in Haplo |
| properties | object | (optional) additional information about the attribute |

h2. Import (XML -> StoreObject)

Go to

@/do/hres-repo-eprints/upload-xml@

and upload an XML file to import objects. When the import is finished running in the background, the log will be available at the "Log of activity" link provided on the page. If you attempt to access the log before the import is finished, you will get a bad validation error because the log doesn't exist yet.

There are some pages that are useful for debugging problems here:

@/do/hres-repo-eprints/mapping@

This page is independent of any individual import. It returns the mapping of the tags that is being used for the import and export. It is helpful for checking that you have added or modified the default map successfully.

@/do/hres-repo-eprints/tags-and-values/log-number@

This page is accessible after import, @log-number@ should be replaced with the log number of the import you are interested in. It shows information such as the tags that haven't been imported, and, if configured in the xmlToIntermediate function, a list of possible values the tag could take based on the file provided to the import.

h3(service). "hres:repository:eprints:prevent-import"

A service that takes one parameter, the cursor, and allows plugins to prevent the import of the current eprint.

h3(service). "hres:repository:eprints:import-ignore-tags"

A service that can be implemented in the client plugin to extend the list of eprints tags that are safe to ignore. This allows the log to catch tags that haven't been mapped or declared as not being mapped, preventing information from being missed.

h2. Export (StoreObject -> XML)

Go to

@/do/hres-repo-eprints/object-to-xml/<REF>@

to get the XML for one object.

Or use the OAI-PMH API to export all objects in the system.

h3(service). "hres:repository:eprints:save-object-with-logging"

A service implemented for importing eprints. Pass in the mutableObject you want saved, and the eprintId of the eprint that has caused the object to be created. This then adds to the eprints logs to track which objects beyond just the outputs themselves are created, e.g. Publishers.

h3(service). "hres-repo-eprints:modify-import-type-map"

Implement this service in the client plugin if you would like to add to or change the type map, as defined in the eprints plugin. The type map is formatted as such:

<pre>
{
    types: {
        "tag": "type:api:code",
        "tag2": {
            type: "type:api:code2",
            attr: { attr:"attribute:api:code", behaviour:"behaviour:api:code" }
        }
    },
    subtypeKeys: ["subtypeTag"]
}
</pre>

The @tag2@ format above is used when the type is further specified through setting a behaviour on an attribute.

Sometimes the type to choose is influenced by a subtype. For example, an eprint which has a type tag of thesis might have a subtype tag of phd, so the type to give the output would be PhdThesis. In this case, in the types object, write the type as "code1.code2", and make sure that the subtype key is specified in the subtypeKeys array.

h3(service). "hres:repository:eprints:log-warning"

A service implemented in the eprints plugin. It takes the intermediate, a warning as a string, and a stat code. The warning is attached to a particular eprint id in the logs, so may look like "Could not parse date in tag". The stat is a string that is used to gather a count of the same kind of error, so may look like "warning:tag:incorrect-format".

h2. Export (StoreObject -> tags)

h3(service). "hres:repository:common:gather-meta-tags"

The implementation of this service adds tags to the @<head>@ of the public repository page for an item. It uses the @storeObjectToIntermediate@ function used by export to generate the tag information.

h2. haploAttributeInfo

haploAttributeInfo is an array of objects that contain the properties:

| name | string | Attribute name as string |
| tag | string | Eprints tag that indicates that this attribute should be set |
| setIntermediateValue | function | Function that takes @cursor@, @intermediate@, @attribute@, and uses the cursor (set at the level of the tag) to create an attribute to push to intermediate's attribute array |
| objectToIntermediate | function | Function that takes @intermediate@, @object@, @attribute@, and uses object to build the attribute to push to the intermediate's array of attributes |

Sometimes, information for import/export is stored in a database, not an attribute on an object. In this case, the @name@ property is omitted and in its place set @database@ to @true@. This stops the object from being removed from the array, which happens at load time to remove any attributes that haven't been defined for that set up.

In the future, the @haploAttributeInfo@ array will be modifyable through a service in order to allow client-specific differences in eprints XML.

To find out which tags are currently being imported or exported, please see the definition of @haploAttributeInfo@ in @hres_repo_eprints_import.js@.

h2. Setting up a new client

Create a client repository plugin, if they don't already have one. Add hres_repo_eprints to plugin dependencies.

Include the client plugin in the application plugin dependencies.