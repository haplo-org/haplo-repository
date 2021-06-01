title: Repository
--

This plugin stores the basic schema and core functionality for the Haplo RM Repository to function. This includes defining core schema for managing items in the repository, permission enforcement (both internal & public facing permissions for a web publication), and simple reporting.

h2. Services

This plugin provides several services which simplify certain actions for repository tasks (such as querying all repository item types)

h3(service). hres:repository:store_query

Takes no arguments and returns an unexecuted StoreQuery object which has a single clause that limits the scope of the search to any object that is a repository item type, e.g. Journal articles, books, conference items, etc.

h3(service). hres:repository:each_repository_item_type

Takes an iterator function as an argument and runs every repository type through the iterator.

Example usage:

<pre>language=javascript
P.implementService("haplo:descriptive_object_labelling:setup", function(type) {
    O.service("hres:repository:each_repository_item_type", function(outputType) {
        type(outputType, {
            labelsFromLinked: [
                [A.Researcher, A.REFUnitOfAssessment]
            ]
        });
    });
});
</pre>

h3(service). hres:repository:is_repository_item

Service which takes a single object as an argument and returns whether or not the item is a repository item type.

Example usage:

<pre>language=javascript
P.hook("hComputeAttributes", function(response, object) {
    if(!O.service("hres:repository:is_repository_item", object)) { return; }
    // Compute some attributes.
});
</pre>

h3(service). hres:repository:is_author

Service which takes two arguments @user@ and @object@ and returns whether or not the user is an author on the object, or if they are an editor (if the object is a book).

Example usage:

<pre>language=javascript
var canSubmitForIngest = function(user, item) {
    return (O.serviceMaybe("hres:repository:is_author", user, item) && !P.Ingest.instanceForRef(item.ref));
};
</pre>

h3(service). hres:repository:earliest_publication_date

Service which takes an object and returns it's earliest publication date or undefined if the item doesn't have a publication date.

Example usage:

<pre>language=javascript
var wasPublishedBeforeDeadline = function(object, deadline) {
    let earliestPublicationDate = O.service("hres:repository:earliest_publication_date", object);
    return earliestPublicationDate <= deadline;
};
</pre>

h3(service). hres:repository:zip_output_files

Service which takes an object, and returns a zip archive of all the files stored on it that the current user can see.

Example usage:

<pre>language=javascript
P.respond("GET,POST", "/api/example-export/get-object-files-as-zip", [
    {pathElement:0, as:"object"}
], function(E, object) {
    E.response.body = O.service("hres:repository:zip_output_files", object);
});
</pre>

h2. Standard migrations

Repository clients are rarely set up with blank systems and often require importing data from existing repositories. This often leads to issues with data quality and possible duplication of data so this plugin provides a set of __standard__ migrations/utility features that can be used to clean/improve the data.

*Note: The two configuration options below are exclusive, possible unexpected behaviour if both set to true*

h3(config). "hres:repository:copy-publisher-from-journal"

h4. Expected type: Boolean | Default value: false

This is config data to be set to true if a client wishes to have the Publisher from a Journal copied onto outputs. This could also be accompanied by restricting these attributes in client code so that the publishers on a repository item will only be from the journals linked to the output.

This is not to be confused with a computed attribute, this *copies* additional data from the journal not overwriting any existing  values.

h3(config). "hres:repository:compute-publisher-from-journal"

h4. Expected type: Boolean | Default value: false

This is config data to be set to true if a client wishes to have the Publisher attribute on an output be computed from the journals.

*NOTE: A restriction on the Publisher attributes should be applied in client code if this is set to true.*

h3. "/do/hres-repository/link-plaintext-journals-to-object"

h4. Migration action

This migration action runs in the background and iterates through every output in the system and replaces any plaintext journal entries with references to journal objects with the same title (after both have been normalised).

h3. "/do/hres-repository/archive-unused-journals"

h4. Migration action

This migration action archives journals which have no outputs linked to them, useful for pruning the list of journals after importing all values, should be used after the above linking migration action.

h2. Repository public permissions

These permissions are intended for setting up public access via service users, for
std_web_publisher publications and various API implementations.

In requirements:

<pre>
    group hres:group:example-api-service
        title: Example API Service

    group hres:group:public-repository-access
        member hres:group:example-api-service

    service-user hres:service-user:example-api
        title: Example API Access
        group hres:group:example-api-service
</pre>

First statement creates a group for this particular API/publication.
Second adds this group as a member of the general public access group, which
gives the service user the permission to read all relevant objects.
Third creates the actual service user.

h3(annotation). "hres:annotation:repository:publically-accessible-person"

This type annotation allows non-Person types to be made readable by the publication.