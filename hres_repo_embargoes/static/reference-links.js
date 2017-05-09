/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    $(document).ready(function() {
        var output = $('.sherpa-links').data('ref');

        $.get("/api/hres-repo-embargoes/sherpa-romeo/"+output)
            .done(function(response) {
                var publishers = JSON.parse(response);
                var html = [];
                html.push('<h2>SHERPA/RoMEO reference links</h2>');
                if(publishers.length === 0) {
                    html.push('<p>No links available. <a target="_blank" href="http://www.sherpa.ac.uk/romeo/">RoMEO home page</a><p>');
                }
                _.each(publishers, function(p) {
                    html.push('<h3>', _.escape(p.name), '</h3>');
                    _.each(p.links, function(l) {
                        html.push("<li><a target='_blank' href='", _.escape(l.url), "'>", _.escape(l.text), "</a></li>");
                    });
                });
                var htmlString = html.join('');
                $('.sherpa-links').append(htmlString);
            });
    });
    
})(jQuery);
