/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


var CITATION_DELIMITER = O.application.config["repo_bulk_author_addition:delimiter"] || ";";
var MATCH_USING_NAMES = O.application.config["repo_bulk_author_addition:match_using_names"] || false;

if("Orcid" in A) {
    P.use("hres:orcid");
}

var canBulkAddAuthors = function(user, object) {
    return user.canUpdate(object.labels) || user.canCreateObjectOfType(object.ref) ;
};

var matchServices = function() {
    return O.service("haplo:service-registry:query", [
        "conforms-to hres:repository:match-item-to-existing-in-list",
        "list-of people"
    ]);
};
var allPeople = function() {
    return O.query().link(T.Person, A.Type).execute();
};  

var matchOnCitation = function(citation) {
    return _.filter(allPeople(), (person) => {
        let searchCite = O.service("hres:author_citation:get_citation_text_for_person_object", person);
        searchCite = searchCite ? searchCite.toLowerCase() : "";
        return (searchCite.indexOf(citation.toLowerCase()) > -1);
    });
};

var matchOnName = function(fullName) {
    return O.query(fullName).link(T.Person, A.Type).execute();
};

var getCiteFromName = function(name) {
    if(!name) { return; }
    let names = name.split(" ");

    // Stops loss of initial if no space between them, e.g. J.M. Smith
    let initials = _.compact(names.shift().split("."));
    names = initials.concat(names);

    let cite = names[names.length-1] + ", ";
    for(let i = 0; i < names.length-1; i++) {
        cite += names[i].charAt(0).toUpperCase() + ". ";
    }
    return cite;
};

var matchOnOrcid = function(orcid) {
    let matches = [];
    let blank = O.object();
    blank.append(P.ORCID.create(orcid), A.Orcid);
    _.each(matchServices().services, service => {
        let match = O.service(service.name, blank, allPeople());
        matches.push(match);
    });
    return O.deduplicateArrayOfRefs(matches);    
};

P.respond("GET,POST", "/do/hres-bulk-author-addition/get-authors", [
    {pathElement:0, as:"object"},
    {parameter:"citations", as:"string", optional:true}
], function(E, output, citations) {
    if(!canBulkAddAuthors(O.currentUser, output)) { O.stop("You are not permitted"); }
    let exampleCitation = "Smith, J.";
    if(MATCH_USING_NAMES) { exampleCitation = "John Smith"; }
    E.render({
        objectRef: output.ref,
        citations: citations,
        hasOrcid: ("Orcid" in A),
        delimiter: CITATION_DELIMITER,
        exampleCitation: exampleCitation
    });
});

P.respond("GET,POST", "/do/hres-bulk-author-addition/return-found", [
    {pathElement:0, as:"object"}
], function(E, output) {
    if(!canBulkAddAuthors(O.currentUser, output)) { O.stop("You are not permitted"); }
    let citations = E.request.parameters.citations.trim();
    let matches = [];
    let allCitations = citations;
    citations = citations.split(CITATION_DELIMITER);

    _.each(citations, citation => {
        citation = citation.trim();
        if(!citation) { return; }
        let displayCitation = citation,
            match = {
                citation: citation
            };

        if("Orcid" in A) {
            let orcid = citation.match(/(\d{4}-){3}(\d{3}[\dX])/g);
            if(orcid){
                orcid = orcid[0];
                displayCitation = citation.replace(orcid, "").trim();
                match.authors = _.compact(matchOnOrcid(orcid));
                //If the service returns one object it is an exact identifier
                if(match.authors.length === 1) {
                    match.isDefinite = true;
                    match.authors = [match.authors[0].load()];
                }
            }
        }

        if(!match.isDefinite) {
            if(MATCH_USING_NAMES) {
                match.authors = displayCitation ? matchOnName(displayCitation) : [];
                displayCitation = getCiteFromName(displayCitation);
            } else {
                match.authors = displayCitation ? matchOnCitation(displayCitation) : [];
            }
        }

        match.displayCitation = displayCitation;
        matches.push(match);
    });

    let noneToDisplay = true;
    E.render({
        objectRef: output.ref,
        citations: _.map(matches, (match, index) => {
            if(!match.isDefinite) { noneToDisplay = false; }
            return {
                citation: match.citation,
                "unsafe-id": index,
                authors: _.map(match.authors, author => {
                    return {
                        author: author,
                        type: author.firstType().load(),
                        "unsafe-id": index+author.ref
                    };
                }),
                singleAuthor: match.authors.length === 1,
                isDefinite: match.isDefinite,
                displayCitation: match.displayCitation
            };
        }),
        noneToDisplay: noneToDisplay,
        allCitations: allCitations
    });

});

P.respond("GET,POST", "/do/hres-bulk-author-addition/saving-authors", [
    {pathElement:0, as:"object"}    
], function(E, output) {
    if(!canBulkAddAuthors(O.currentUser, output)) { O.stop("You are not permitted"); }
    let params = E.request.parameters;
    let keyToCite = params.key;
    let keyToVal = params.author;
    let objectTitles = {};
    let blank = O.object();

    //Use any type, irrelevant but required for functionality
    blank.appendType(T.Book);

    _.each(keyToVal, (val, key) => {
        let spec;
        let ref = O.ref(val);
        if(ref && ref.load().isKindOf(T.Person)) {
            let object = ref.load();
            spec = {object: object};
            objectTitles[val] = object.title;
        } else {
            if(keyToCite[key]) { spec = {cite: keyToCite[key]}; }
        }
        if(spec) {
            O.service("hres:author_citation:append_citation_to_object", blank, A.Author, null, spec);
        }
    });

    let encoding = O.editor.encode(blank);
    E.render({
        attributes: encoding,
        titles: JSON.stringify(objectTitles)
    });
});

P.hook("hPreObjectEdit", function(response, object) {
    if(object.isKindOfTypeAnnotated("hres:annotation:repository-item")) {
        P.template("include_editor_plugin").render();
    }
});

P.hook('hObjectEditor', function(response, object) {
    if(O.service("hres:repository:is_repository_item", object)) {
        // TODO: remove this workaround
        // Use type as fallback to get around new objects not having refs
        let ref = object.ref || object.firstType();
        response.plugins.hres_bulk_author_addition = {
            authorCitation: A.AuthorsCitation,
            objectRef: ref.toString()
        };
        this.template("include_editor_plugin").render();
    }
});
