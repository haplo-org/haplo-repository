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
                    html.push('<h2>SHERPA/RoMEO guidance</h2><br>');
                    doneHeading = true;
                }
                if(publishers.length > 0) {
                    haveResults = true;
                }
                _.each(publishers, function(p) {
                    html.push('<h2>', _.escape(p.name), '</h2>');
                    if(p.paidAccess) { 
                        html.push("<h4><a target='_blank' rel='noopener' href='", _.escape(p.paidAccess.url), "'>", _.escape(p.paidAccess.name), "</a>", _.escape(p.paidAccess.notes), "</h4>");
                    }
                    _.each(p.archiving, function(a) {
                        html.push('<h4>Author ', a, '</h4>');
                    });
                    if(p.conditions) {
                        html.push("<h3>Conditions:</h3>");
                    }
                    _.each(p.conditions, function(c) {
                        html.push("<li>", _.escape(c), "</li>"); 
                    });
                    if(p.copyright) {
                        html.push("<h3>Copyright:</h3>");
                    }
                    _.each(p.copyright, function(c) {
                        html.push("<li><a target='_blank' rel='noopener' href='", _.escape(c.url), "'>", _.escape(c.text), "</a></li>"); 
                    });
                    html.push("<hr>");
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
