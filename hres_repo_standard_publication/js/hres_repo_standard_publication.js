/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var HOSTNAME             = O.application.config['repo_standard_publication:hostname']                   || P.webPublication.DEFAULT;
var REPOSITORY_NAME      = O.application.config['repo_standard_publication:name']                       || O.application.name;
var CONFIGURED_TEXT      = O.application.config['repo_standard_publication:text']                       || {}; // see DEFAULT_TEXT for keys
var ADMIN_EMAIL          = O.application.config['repo_standard_publication:admin_email']                || 'invalid@example.org';
var FOOTER_LINKS         = O.application.config['repo_standard_publication:footer_links']               || []; // array of objects with text and href
var HIDE_CAROUSEL        = O.application.config['repo_standard_publication:hide_carousel']              || false;
var COPYRIGHT_LINK       = O.application.config['repo_standard_publication:copyright_link'];
var LOGO = {
    src             : O.application.config['repo_standard_publication:logo:src'],
    width           : O.application.config['repo_standard_publication:logo:width'],
    height          : O.application.config['repo_standard_publication:logo:height'],
    nameInHeader    : O.application.config['repo_standard_publication:logo:name_in_header']
};
if(!LOGO.src) { LOGO = undefined; }
// Other config:
//   repo_standard_publication:carousel (array of carousel info)
//   repo_standard_publication:home_images (array of image src paths/URLs)
//   repo_standard_publication:research_institute_browse_images (array of image src paths/URLs)
//   repo_standard_publication:object:without_attributes (dictionary of name => array of API codes)
//   repo_standard_publication:object:only_attributes (dictionary of name => array of API codes)
//   repo_standard_publication:use_short_item_urls (boolean)

var PIXABAY_CREDIT = false;

// --------------------------------------------------------------------------

// if on same hostname as internal view, move repository to subdirectory
var BASE_PATH = ((HOSTNAME === P.webPublication.DEFAULT) || (HOSTNAME === O.application.hostname)) ? '/repository' : '';

var HOME_PATH = BASE_PATH || '/';
var SEARCH_PATH = (BASE_PATH || '/repository')+'/search'; // can't reuse platform URL

// --------------------------------------------------------------------------

var DEFAULT_TEXT = {
    // description (optional description of repository)
    homeMainSearchPlaceholder: "Find researchers and their research...",
    homeBrowseByResearcher: "Browse by Researcher",
    homeBrowseByResearcherText: "Browse the list of Researchers with outputs in "+REPOSITORY_NAME+".",
    homeSearchTheRepository: "Search the repository",
    homeSearchTheRepositoryText: "Search the repository for outputs and researchers.",
    homeBrowseBySubject: "Browse by Subject",
    homeBrowseBySubjectText: "View outputs filtered by Faculty and Department.",
    homeBrowseByYear: "Browse by year",
    homeBrowseByYearText: "View outputs by year of publication.",
    peopleDirectoryTitle: "People",
    peopleDirectorySubtitle: "Browse our directory to find staff profiles containing contact information, biography and lists of publications.",
    researchInstituteBrowseTitle: "Departments and research groups"
    // researchInstituteBrowseSubtitle
};

var TEXT = _.extend({}, DEFAULT_TEXT, CONFIGURED_TEXT);

// --------------------------------------------------------------------------

var prepareAttrConfig = function(name) {
    var attrs = {};
    _.each(O.application.config[name]||{}, (list,name) => {
        var l = attrs[name] = [];
        _.each(list||[], (apiCode) => {
            if(apiCode in ATTR) {
                l.push(ATTR[apiCode]);
            } else if(apiCode in ALIASED_ATTR) {
                l.push(ALIASED_ATTR[apiCode]);
            } else {
                console.log("Unknown API code in config data: ", apiCode);
            }
        });
    });
    return attrs;
};

var A_WITHOUT = prepareAttrConfig('repo_standard_publication:object:without_attributes');
var A_ONLY = prepareAttrConfig('repo_standard_publication:object:only_attributes');

var attrs = function(list, name, also) {
    var l = list[name];
    if(!l && !also) { return; }
    if(!also) { return l; }
    if(!l) { return also; }
    return l.concat(also);
};

// --------------------------------------------------------------------------

var Publication = P.webPublication.register(HOSTNAME).
    serviceUser("hres:service-user:repository-publisher").
    permitFileDownloadsForServiceUser().
    use("hres:repository:common:platform-integration").
    use("hres:repository:common:search-results").
    use("hres:repository:ar:request-a-copy", { useFileMediatedAccess: true }).
    use("hres:repository:export-formats");

// Access request process for data files, if implemented
if(Publication.featureImplemented("hres:repository:ar:access-request")) {
    Publication.use("hres:repository:ar:access-request", { useFileMediatedAccess: true });
}

if(Publication.featureImplemented("hres:researcher-profile:platform-integration")) {
    Publication.use("hres:researcher-profile:platform-integration");
}

// Integration for photos
if(Publication.featureImplemented("hres:researcher-profile:photo:permit-image-downloads")) {
    Publication.use("hres:researcher-profile:photo:permit-image-downloads");
}

// Integration for large branding images
if(Publication.featureImplemented("hres:repository:branding:update")) {
    Publication.use("hres:repository:branding:update");
}

Publication.layout(function(E, context, blocks) {
    return P.template("_layout").render({
        HOME_PATH: HOME_PATH,
        BASE_PATH: BASE_PATH,
        SEARCH_PATH: SEARCH_PATH,
        REPOSITORY_NAME: REPOSITORY_NAME,
        COPYRIGHT_LINK: COPYRIGHT_LINK || {href:HOME_PATH, text: REPOSITORY_NAME},
        TEXT: TEXT,
        LOGO: LOGO,
        FOOTER_LINKS: FOOTER_LINKS,
        staticDirectoryUrl: P.staticDirectoryUrl,
        context: context,
        canonicalURL: context.object ? Publication.urlForObject(context.object) : undefined,
        blocks: blocks
    });
});

// --------------------------------------------------------------------------

P.implementService("std:action_panel:home_page", function(display, builder) {
    builder.panel(99999).
        link('default', "https://"+Publication.urlHostname+HOME_PATH, NAME("hres:repository:standard_publication:link_name", REPOSITORY_NAME));
});

// --------------------------------------------------------------------------

// Don't display share panel
Publication.pagePartRemoveFromCategory({
    name: "hres:repository:output:share-panel",
    category: "hres:repository:output:sidebar"
});

// --------------------------------------------------------------------------

var HOME_CAROUSEL = [];
var DEFAULT_CAROUSEL = [{title:REPOSITORY_NAME}];
var DEFAULT_CAROUSEL_IMAGES = [
    '/vendor/pixabay/banner/banner-904884.jpg',
    '/vendor/pixabay/banner/gears-1311171.jpg',
    '/vendor/pixabay/banner/banner-1050629.jpg',
    '/vendor/pixabay/banner/banner-1989514.jpg',
    '/vendor/pixabay/banner/background-3009939.jpg',
    '/vendor/pixabay/banner/background-3045402.jpg'
];
var BROWSE_IMAGES = [
    '/vendor/pixabay/browse/desktop-3207338.jpg',
    '/vendor/pixabay/browse/hallway-802068.jpg',
    '/vendor/pixabay/browse/books-1245690.jpg',
    '/vendor/pixabay/browse/bank-3503690.jpg',
].map((i) => P.staticDirectoryUrl+i);
(function() {
    let defImgIdx = 0, imageIndex = 0;
    let carousel = O.application.config['repo_standard_publication:carousel'] || [];
    if(carousel.length === 0) { carousel = DEFAULT_CAROUSEL; }
    _.each(carousel, (entry) => {
        let image = entry.image;
        if(!image) {
            image = P.staticDirectoryUrl+DEFAULT_CAROUSEL_IMAGES[defImgIdx++];
            if(defImgIdx >= DEFAULT_CAROUSEL_IMAGES.length) { defImgIdx = 0; }
            PIXABAY_CREDIT = true;
        }
        HOME_CAROUSEL.push({
            title: entry.title,
            text: entry.text,
            image: image,
            imageDescription: entry.imageDescription,
            isfirstImage: imageIndex === 0,
            imageIndex: imageIndex++
        });
    });
    // Override browse images from configuration?
    var configuredBrowseImages = O.application.config['repo_standard_publication:home_images'] || [];
    for(var i = 0; i < configuredBrowseImages.length; ++i) {
        var override = configuredBrowseImages[i];
        if(override) { BROWSE_IMAGES[i] = override; }
    }
})();

Publication.setHomePageUrlPath(HOME_PATH);

Publication.respondToExactPath(HOME_PATH,
    function(E, context) {
        context.hint.objectKind = 'home';
        if(O.serviceImplemented("hres:repository:update_branding")) {
            HOME_CAROUSEL = O.service("hres:repository:update_branding", "carousel", HOME_CAROUSEL);
            BROWSE_IMAGES = O.service("hres:repository:update_branding", "browse", BROWSE_IMAGES);
        }
        E.render({
            HOME_PATH: HOME_PATH,
            BASE_PATH: BASE_PATH,
            SEARCH_PATH: SEARCH_PATH,
            REPOSITORY_NAME: REPOSITORY_NAME,
            TEXT: TEXT,
            HIDE_HOME_CAROUSEL: HIDE_CAROUSEL,
            HOME_CAROUSEL: HOME_CAROUSEL,
            HOME_CAROUSEL_NAV: HOME_CAROUSEL.length > 1,
            PIXABAY_CREDIT: PIXABAY_CREDIT,
            browseImg0: BROWSE_IMAGES[0],
            browseImg1: BROWSE_IMAGES[1],
            browseImg2: BROWSE_IMAGES[2],
            browseImg3: BROWSE_IMAGES[3]
        }, "home");
    }
);
Publication.pagePartAddToCategory({
    pagePart: "hres:repository:misc:recent-additions",
    category: "hres:repository:home:below"
});

// Some repositories want to use item URLs without slugs
if(O.application.config['repo_standard_publication:use_short_item_urls']) {
    Publication.urlPolicyForTypes(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), {
        slugLength: 0
    });
}

// --------------------------------------------------------------------------

Publication.use("hres:oai-pmh:server", {
    pathPrefix: BASE_PATH,
    attributes: {
        repositoryName: REPOSITORY_NAME,
        adminEmail: ADMIN_EMAIL
    }
});

// --------------------------------------------------------------------------

Publication.use("hres:repository:irus:widget");  

// --------------------------------------------------------------------------

Publication.use("hres:repository:common:search", {
    path: SEARCH_PATH,
    // Restrict search to researchers and repository items -- other things can be read by the
    // permissions, but shouldn't be displayed in the search.
    includeLabels: [T.Researcher, Label.RepositoryItem]
});

Publication.use("hres:repository:common:search-by-fields", {
    path: SEARCH_PATH+'/by-fields',
    destination: SEARCH_PATH
});


Publication.use("hres:repository:common:latest-additions", {
    path: BASE_PATH+'/latest'
});

var RI_BROWSE_IMAGES = O.application.config["repo_standard_publication:research_institute_browse_images"] || [];
if(RI_BROWSE_IMAGES.length === 0) {
    PIXABAY_CREDIT = true;
    RI_BROWSE_IMAGES = [
        '/vendor/pixabay/department/eye-2771174.jpg',
        '/vendor/pixabay/department/microphone-933057.jpg',
        '/vendor/pixabay/department/blood-1813410.jpg',
        '/vendor/pixabay/department/action-2277292.jpg',        
        '/vendor/pixabay/department/calculator-385506.jpg',
        '/vendor/pixabay/department/clock-70182.jpg',
        '/vendor/pixabay/department/microbiology-163470.jpg',
        '/vendor/pixabay/department/staircase-600468.jpg',
        '/vendor/pixabay/department/atomium-4179270.jpg',
        '/vendor/pixabay/department/dna-1811955.jpg',
        '/vendor/pixabay/department/dna-3539309.jpg',
        '/vendor/pixabay/department/lego-1044891.jpg',
        '/vendor/pixabay/department/wormhole-739872.jpg',
        '/vendor/pixabay/department/escalator-283448.jpg',
        '/vendor/pixabay/department/vatican-1136071.jpg',
        '/vendor/pixabay/department/artificial-intelligence-3382507.jpg',
        '/vendor/pixabay/department/architect-2071534.jpg',
        '/vendor/pixabay/department/board-453758.jpg',
        '/vendor/pixabay/department/steampunk-1636156.jpg',
        '/vendor/pixabay/department/time-3222267.jpg',
        '/vendor/pixabay/department/calculator-1180740.jpg',
        '/vendor/pixabay/department/architecture-1914309.jpg',
        '/vendor/pixabay/department/tunnel-4214236.jpg',
        '/vendor/pixabay/department/architecture-3357028.jpg',
        '/vendor/pixabay/department/dna-163466.jpg',
        '/vendor/pixabay/department/business-2846221.jpg'
    ].map((i) => P.staticDirectoryUrl+i);
}
Publication.use("hres:repository:common:research-institute-browse", {
    path: BASE_PATH+'/departments',
    title: TEXT.researchInstituteBrowseTitle,
    subtitle: TEXT.researchInstituteBrowseSubtitle,
    images: RI_BROWSE_IMAGES
});

Publication.use("hres:repository:common:list-by-year", {
    path: BASE_PATH+'/year'
});


// --------------------------------------------------------------------------

Publication.use("hres:repository:common:output", {
    path: BASE_PATH+"/item",
    mediaDisplay: true,
    withoutAttributes: attrs(A_WITHOUT, 'output'),
    onlyAttributes: attrs(A_ONLY, 'output')
});

Publication.use("hres:repository:common:research-institute", {
    path: BASE_PATH+'/research-institute',
    withoutAttributes: attrs(A_WITHOUT, 'research-institute'),
    onlyAttributes: attrs(A_ONLY, 'research-institute')
});

Publication.use("hres:repository:common:researcher-directory", {
    path: BASE_PATH+'/researchers',
    title: TEXT.peopleDirectoryTitle,
    subtitle: TEXT.peopleDirectorySubtitle,
    types: [T.Researcher]
});

var RESEARCHER_WITHOUT = [A.Type];
if("REFUnitOfAssessment" in A) {
    RESEARCHER_WITHOUT.push(A.REFUnitOfAssessment);

}
Publication.use("hres:repository:common:simple-object", {
    path: BASE_PATH+'/researcher',
    types: [T.Researcher],
    kind: 'person',
    withoutAttributes: attrs(A_WITHOUT, 'person', RESEARCHER_WITHOUT),
    onlyAttributes: attrs(A_ONLY, 'person'),
    imagePagePartCategory: "hres:repository:person:photo-display"
});

Publication.use("hres:repository:common:simple-object", {
    path: BASE_PATH+'/event',
    types: [T.ExternalEvent],
    kind: 'event',
    withoutAttributes: attrs(A_WITHOUT, 'event'),
    onlyAttributes: attrs(A_ONLY, 'person')
});

if("Impact" in T) {
    Publication.use("hres:repository:common:simple-object", {
        path: BASE_PATH+'/impact',
        types: [T.Impact],
        kind: 'impact',
        withoutAttributes: attrs(A_WITHOUT, 'impact'),
        onlyAttributes: attrs(A_ONLY, 'impact')
    });

    Publication.use("hres:repository:common:simple-object", {
        path: BASE_PATH+'/impact-evidence',
        types: [T.ImpactEvidence],
        kind: 'impact-evidence',
        withoutAttributes: attrs(A_WITHOUT, 'impact-evidence'),
        onlyAttributes: attrs(A_ONLY, 'impact-evidence')
    });
}

// Usually for use with eg. client-specific object types that need to be rendered.
// Use VERY sparingly. Consider using a separate publication if this list gets long
if(O.application.config['repo_standard_publication:client_publication_features']) {
    _.each(O.application.config['repo_standard_publication:client_publication_features'], (feature) => {
        Publication.use(feature, {
            path: BASE_PATH
        });
    });
}
