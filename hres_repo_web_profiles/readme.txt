title: Web profiles
--

This plugin enables researchers to choose a preferred ordering for their outputs to display on the public interface and in their profile. The ordering defaults to reverse publication date order (most recently published first). There is optionally available the ability to turn on a featured output setting, which allows the user to mark a subset of their publications as featured.

h2. Configuration data

h3(config). "hres_repo_web_profiles:use_featured_outputs"

h4. Expected Type: Boolean - Default value: false

Enables the featured outputs functionality of this plugin.

h2. Services

h3(service). "hres_repo_web_profiles:get_featured_outputs_for_researcher"

This service takes a single @researcher@ argument and returns an array of the @StoreObject@s of the researcher's selected featured outputs - Note: this array may be empty.

h4. Arguments:

|@researcher@|The @StoreObject@ of the researcher to retrieve the featured outputs for|

h4. Example usage:

<pre>language=javascript
P.researcherProfile.renderedSection({
    name: "featuredPublications",
    title: "Featured publications",
    sort: 1700,
    editLink(profile) {
        return "/do/hres-repo-web-profiles/edit-featured-outputs/"+profile.researcher.ref;
    },
    deferredRender(profile) {
        let outputs = O.service("hres_repo_web_profiles:get_featured_outputs_for_researcher", profile.researcher);
        if(!outputs) { return; }
        return P.template("featuredOutputs").deferredRender({
            outputs: _.map(outputs, function(outputRef) {
                return O.service("hres_bibliographic_reference:for_object", O.ref(outputRef).load());
            })
        });
    }
});
</pre>

h3(service). "hres:repo-publication-parts-person:get-ordered-outputs-for-researcher"

This is a utility service for hres_repo_publication_page_parts to allow it to retrieve the ordered listing of outputs for a given researcher. This returns the outputs in the order selected by the researcher as an array of @StoreObject@.

h4. Arguments:

|@researcher@|The @StoreObject@ of the researcher to retrieve the ordered outputs list for|

h4. Example usage:

<pre>language=javascript
deferredRender(E, context, options) {
    let outputs = O.serviceMaybe("hres:repo-publication-parts-person:get-ordered-outputs-for-researcher", context.object.ref);
    let types = [];
    let seen = [];
    let displayOutputs = _.map(outputs, function(output) {
        let typeStr = output.firstType().toString();
        if(-1 === seen.indexOf(typeStr)) {
            types.push({
                type: typeStr,
                title: SCHEMA.getTypeInfo(output.firstType()).name
            });
            seen.push(typeStr);
        }
        return {
            output: output,
            href: context.publishedObjectUrlPath(output),
            citation: O.service("hres_bibliographic_reference:for_object", output),
            type: typeStr
        };
    });
    let sortedTypes = _.sortBy(types, "title");
    if(displayOutputs.length === 0) { return; }
        let template = context.publication.getReplaceableTemplate("hres:repo-publication-parts:person:outputs");
        return template.deferredRender({
            outputs: displayOutputs,
            types: sortedTypes
        });
    }
}
</pre>