/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var metadataKeys = [];

    var NOTES = {
        "authcite": "In the left hand box, look up an existing author. In the right hand box, enter the author's name "+
                "as they should be cited. If the author cannot be found, leave the left hand box blank.",
        "edcite": "In the left hand box, look up an existing editor. In the right hand box, enter the author's name "+
                "as they should be cited. If the author cannot be found, leave the left hand box blank.",
        "bibref": "Use full, not abbreviated, publication names, and make sure page numbers etc are included "+
                "where appropriate.",
        "ressch": "Answer 'research' for research outputs, 'scholarly' for other scholarly outputs (e.g. textbooks, "+
                "professional articles). For the purposes of the REF, research is defined as a process of investigation"+
                " leading to new insights, effectively shared. It includes work of direct relevance to the needs of commerce,"+
                " industry, and to the public and voluntary sectors; scholarship; the invention and generation of ideas,"+
                " images, performances, artefacts including design, where these lead to new or substantially improved insights;"+
                " and the use of existing knowledge in experimental development to produce new or substantially improved"+
                " materials, devices, products and processes, including design and construction. It excludes routine testing and"+
                " routine analysis of materials, components and processes such as for the maintenance of national standards, as "+
                "distinct from the development of new analytical techniques. It also excludes the development of teaching "+
                "materials that do not embody original research.",
        "pubdt": "From 1 April 2018 the deposit of the accepted author manuscript (AAM) "+
                "into an institutional repository within three months of acceptance is required for the REF.",
        "aam": "Please upload your accepted manuscript. This is the final version that has been accepted "+
                "for publication. This may not always include the publisher's copy-editing, type-setting,"+
                " formatting and/or pagination. Repository staff will add any headers or disclaimers"+
                " required by the publisher on your behalf. Please email the University repository team if you are "+
                'unsure about which version to upload.',
        "url": "The canonical URL for this item. Some journals require you to provide a link to their version.",
        // TODO: Unconmment when Open Access schema exists
        // "opena": "Is this item made available through paid (gold) open access?",
        "license": "The canonical url for the license that will apply after any embargo period has ended.",
        "issn": "The International Standard Serial Number for this journal.",
        "isbn": "The International Standard Book Number for this book or volume.",
        "keywords": "Please enter each keyword in a separate field.",
        "processdates": "Enter the acceptance date of the item.",
        "pagerange": "Please enter in the preferred format '123-456'."
    };

    // Capture values as focus lost, which is a MASSIVE HACK but will have to do for now
    var lastBlurredValue;
    $(document).on('blur', 'input', function() { lastBlurredValue = this.value; });

    Haplo.editor.registerDelegate("hres_repo_object_editor", function(editor, data) {

        var noteLookup = data.notes;

        // Make relevant metadata keys available to the custom text value type
        metadataKeys = data.metadataKeys;

        return {
            setupAttribute: function(attributeContainer) {
                var desc = attributeContainer.getDescriptor();
                var key = noteLookup[desc];
                if(key) {
                    if(NOTES[key]) {
                        this.noteContainers = (this.noteContainers || []).concat([attributeContainer]);
                        attributeContainer.addUI('<div class="repository_guidance_show" style="position:absolute;top:-10px;right:0"><a href="#" title="what\'s this?"><p style="font-family:Ubuntu; color:#aaa; line-height:1.4em; border-style:solid; border-radius:1em; border-width:1px; border-color:#aaa; text-align:center; width:1.6em; margin:0"><b>?</b></p></a></div>');
                        attributeContainer.addUI('<div class="repository_guidance_note" style="text-align:left; margin:16px 0 0 12px; color:#888; line-height: 1.4em; display:none">'+NOTES[key]+'</div>');
                    } 
                }
            },
            startEditor: function() {
                _.each(this.noteContainers, function(container) {
                    var domElement = container.getContainerDOMElement();
                    $('.repository_guidance_show', domElement).on('click', function(evt) {
                        evt.preventDefault();
                        $('.repository_guidance_note', domElement).toggle();
                    });
                    $('.repository_guidance_note', domElement).on('click', function(evt) {
                        $('.repository_guidance_note', domElement).toggle();
                    });
                    $('.repository_guidance_show', domElement).hover(function() {
                        $('.repository_guidance_show p', domElement).css("border-color", "#666");
                        $('.repository_guidance_show p', domElement).css("color", "#666");
                    }, function() {
                        $('.repository_guidance_show p', domElement).css("border-color", "#aaa");
                        $('.repository_guidance_show p', domElement).css("color", "#aaa");
                    });
                });
            }
        };
        
    });

})(jQuery);
