/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var safety = 5;
    var doneHeading = false;
    var haveResults = false;
    var getLinks = function(doneStr) {
        if(--safety < 0) { return; }

        var output = $('.sherpa-links').data('ref');

        var url = "/api/hres-repo-embargoes/sherpa-romeo/"+output;
        if(doneStr) { url += "?done="+doneStr; }
        $.get(url)
            .done(function(response) {
                var publishers = response.publishers;
                var html = [];
                if(!doneHeading) {
                    html.push('<h2>SHERPA/RoMEO reference links</h2>');
                    doneHeading = true;
                }
                if(publishers.length > 0) {
                    haveResults = true;
                }
                _.each(publishers, function(p) {
                    html.push('<h3>', _.escape(p.name), '</h3>');
                    _.each(p.links, function(l) {
                        // rel=noopener for security
                        html.push("<li><a target='_blank' rel='noopener' href='", _.escape(l.url), "'>", _.escape(l.text), "</a></li>");
                    });
                });
                if(!response.more && !haveResults) {
                    html.push('<p>No links available. <a target="_blank" href="http://www.sherpa.ac.uk/romeo/">RoMEO home page</a><p>');
                }
                var htmlString = html.join('');
                $('.sherpa-links').append(htmlString);
                if(response.more) {
                    getLinks((response.done||[]).join(','));
                }
            });
    };

    $(document).ready(function() {
        getLinks(null);
    });
    
})(jQuery);
