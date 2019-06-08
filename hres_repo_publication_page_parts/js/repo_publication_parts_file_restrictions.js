/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.webPublication.registerReplaceableTemplate(
    "hres:repo-publication-parts:file:restrictions",
    "file/restrictions"
);

P.webPublication.pagePart({
    name: "hres:repository:common:file-restrictions",
    category: "hres:repository:output:sidebar",
    sort: 400,
    deferredRender: function(E, context, options) {
        var restrictedFileGroupDescs = [];
        var allFiles = {};
        var restricted = context.object.restrictedCopy(O.currentUser);
        restricted.every(function(v,d,q,x) {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                allFiles[v.digest] = [d,q,x];
            }
        });
        context.object.every(function(v,d,q,x) {
            if(O.typecode(v) === O.T_IDENTIFIER_FILE) {
                if(!_.isEqual([d,q,x], allFiles[v.digest])) {
                    restrictedFileGroupDescs.push(x ? x.desc : null);
                }
            }
        });

        var deferredRenders = [];
        var finalElement;
        _.each(_.uniq(restrictedFileGroupDescs), function(groupDesc) {
            var applicableDeferredRenders = [];
            O.serviceMaybe("hres_repo_publication_common:collect_renders_for_file_groups",
                context.object, groupDesc, applicableDeferredRenders);
            if(applicableDeferredRenders.length) {
                var attrInfo = groupDesc ? SCHEMA.getAttributeInfo(groupDesc) : null;
                var info = {
                    printableName: attrInfo ? attrInfo.name : "All other files",
                    display: _.sortBy(applicableDeferredRenders, 'sort')[0].deferredRender
                };
                // Generic files go at the bottom of the list (added outside loop)
                if(!attrInfo) {
                    info.printableNameOnlyFileAttribute = "Attached files";
                    finalElement = info;
                } else {
                    deferredRenders.push(info);
                }
            }
        });
        if(finalElement) { deferredRenders.push(finalElement); }
        if(deferredRenders.length) {
                deferredRenders[0].first = true;
                deferredRenders[0].only = (deferredRenders.length === 1);
                var template = context.publication.getReplaceableTemplate("hres:repo-publication-parts:file:restrictions");
                return template.deferredRender({ files: deferredRenders });
            }
        }        
    }
);