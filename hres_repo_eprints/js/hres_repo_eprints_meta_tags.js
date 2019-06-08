/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2018            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("hres:repository:common:gather-meta-tags", function(specification) {
    let output = specification.object; // restricted object
    let intermediate = P.objectToIntermediate(output);
    _.each(intermediate.attributes, (attribute) => {
        if(attribute.text) {
            specification.tags.push({name:"eprints."+attribute.tag, content:attribute.text});
        } else if(attribute.properties) {
            _.each(attribute.properties, (property, tag) => {
                if(!_.isObject(property)) {
                    let name = "eprints."+attribute.tag;
                    if(typeof tag !== "number") { name += "_"+tag; }
                    specification.tags.push({
                        name: name,
                        content: property
                    });
                } else if(tag === "name") {
                    specification.tags.push({
                        name:"eprints."+attribute.tag+"_name",
                        content: property.family + ", " + property.given
                    });
                }
            });
        }
    });
    if(O.serviceImplemented("hres_bibliographic_reference:plain_text_for_object")) {
        specification.tags.push({
            name: "eprints.citation",
            content: O.service("hres_bibliographic_reference:plain_text_for_object", output)
        });
    }
    let tags = [];
    if(!_.some(specification.tags, t => t.name === "eprints.datestamp")) {
        let datestamp;
        // as default, add the date where the AcceptedIntoRepository label is added
        // for the first time
        _.some(output.history.reverse(), pastOutput => {
            if(!pastOutput.labels.includes(Label.AcceptedIntoRepository)) { return true; }
            datestamp = pastOutput.lastModificationDate;
        });
        if(datestamp) {
            tags.push({
                name: "eprints.datestamp",
                content: new XDate(datestamp).toString("yyyy-MM-dd HH:mm:ss")
            });
        }
    }
    const eprintIdQ = P.db.eprintsMetadata.select().where("object", "=", output.ref);
    const eprintId = eprintIdQ.length ? eprintIdQ[0].eprintId : "haplo-"+output.ref.toString();
    tags.push({
        name: "eprints.eprintid",
        content: eprintId
    });
    tags.push({
        name: "eprints.userid",
        content: "0 (redacted)" // include the tag in case anything relies on it existing
    });

    // File URLs -- note that meta tags do things differently to the XML version
    output.every((v,d,q) => {
        if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
            if(specification.context.publication) {
                tags.push({
                    name: "eprints.document_url",
                    content: specification.context.publication.urlForFileDownload(v)
                });
            } else {
                tags.push({
                    name: "eprints.document_url",
                    content: "(set by publisher in public interface)" // placeholder text for tags handler view
                });
            }
        }
    });

    tags = tags.concat([
        {
            name: "eprints.eprint_status",
            content: "archive"
        },
        {
            name: "eprints.lastmod",
            content: new XDate(output.lastModificationDate).toString("yyyy-MM-dd HH:mm:ss")
        },
        {
            name: "eprints.status_changed",
            content: new XDate(output.lastModificationDate).toString("yyyy-MM-dd HH:mm:ss")
        },
        {
            name: "eprints.metadata_visibility",
            content: "show"
        }
    ]);
    _.each(tags, (tag) => {
        specification.tags.push(tag);
    });
});

P.respond("GET", "/do/hres-repo-eprints/tags", [
    {parameter:"lookup", as:"ref"}
], function(E, output) {
    if(!O.currentUser.isMemberOf(Group.Administrators)) { O.stop("Not permitted"); }
    let specification, tags, eprintId;
    const object = output.load();
    if(object && object.isKindOfTypeAnnotated("hres:annotation:repository-item")) {
        specification = { context: {}, tags: [], object: object };
        O.service("hres:repository:common:gather-meta-tags", specification);
        tags = _.sortBy(specification.tags, "name");
        eprintId = _.find(tags, t => t.name === "eprints.eprintid");
        eprintId = (eprintId || {}).content;
    }
    E.render({
        tags: tags,
        eprintId: eprintId,
        output: object,
        refString: output.toString()
    });
});