/* Haplo Research Manager                            https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2020            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


//Csv of which repositories to show, ones where the user is an owner,collaborator,organization_member
var AFFILIATION = O.application.config["hres_github:affiliations_to_list"] || 'owner';

P.respondAfterHTTPRequest("GET", "/do/hres-github-repository/list-repositories", [
], {
    setup(data, E) {
        let user = O.currentUser;
        let accessToken = O.service("hres:github:integration:token_for_user", O.currentUser);
        if(!accessToken) { return false; }
        data.accessToken = accessToken;
        return O.httpClient("https://api.github.com/user/repos").
            method("GET").
            header("Authorization", "token "+ accessToken).
            queryParameter("affiliation", AFFILIATION);
    },
    process(data, client, result) {
        let repositories = [];
        if(result.successful) {
            _.each(result.body.readAsJSON(), (v,k) => {
                repositories.push(v);
            });
        }
        return repositories;
    },
    handle(data, result, E) {
        let view = {
            user: O.currentUser.name,
            repositories: data
        };
        E.render(view);
    }
});

P.respond("POST", "/do/hres-github-repository/make-software-output", [
    {parameter:"repo", as:"string"},
    {parameter:"owner", as:"string"}
], function(E, repo, owner) {
    let accessToken = O.service("hres:github:integration:token_for_user", O.currentUser);
    if(!accessToken) { return; }
    let url = "https://api.github.com/repos/"+owner+"/"+repo;
    O.httpClient(url).
        method("GET").
        header("Authorization", "token "+ accessToken).
        request(createOutputCallback, {
            owner:owner,
            repo: repo,
            accessToken: accessToken
        });
});

var createOutputCallback = P.callback("createOutputCallback", (data, client, result) => {
    if(result.successful) {
        let repository = result.body.readAsJSON();
        let newSoftware = O.object([Label.RepositoryItem]);
        newSoftware.appendType(T.Software);
        newSoftware.appendTitle(repository.name);
        O.service("hres:author_citation:append_citation_to_object", newSoftware, A.Author, null, {ref:O.currentUser.ref});
        if(repository.description) { newSoftware.append(repository.description, A.Abstract); }
        _.each(repository.topics, topic => {
            newSoftware.append(topic, A.Keywords);
        });
        newSoftware.append(O.text(O.T_IDENTIFIER_URL, repository.html_url), A.Url);

        O.service("hres_repo_harvest_sources:push_updates_from_source", [{
            source: "github",
            identifier: repository.id.toString(),
            name: "GitHub",
            object: newSoftware,
            postHarvest(harvestedObject) {
                if("OutputFile" in A) {
                    O.background.run("hres_github_repository:download_repository", {
                        ref: harvestedObject.ref.toString(),
                        owner: data.owner,
                        repo: data.repo,
                        accessToken: data.accessToken,
                    });
                }
                return true;
            }
        }]);
    }
});

// Service implemented to allow retrieval of name by service registry
P.implementService("hres:repository:harvest-source:github", function() {
    // Returning [] so function is as expected by harvest_sources but won't be acted on.
    // This is due to the framework only being used for manual harvesting from GitHub
    return [];
});

P.backgroundCallback("download_repository", function(data) {
    let downloadURL = "https://api.github.com/repos/" + data.owner + "/" + data.repo + "/zipball";
    O.httpClient(downloadURL).
        header("Authorization", "token "+ data.accessToken).
        request(Download, { object: data.ref }); 
});

var Download = P.callback("download", function(data, client, response) {
    if(response.successful) {
        let file;
        let mutable = O.ref(data.object).load().mutableCopy();
        try {
            if(response.body.mimeType === "text/html") {
                console.log("WARNING: repository zip archive may not have been downloaded correctly, html mimeType detected.");
            }
            let body = response.body;
            body.filename = decodeURIComponent(body.filename);
            file = O.file(body);
        } catch(e) {
            console.log("ERROR: one or more files may not have been downloaded");
            console.log(e.message);
        }
        if(file) {
            let newFile = mutable.newAttributeGroup(A.OutputFile);
            mutable.append(file.identifier(), A.File, Q.Null, newFile);
            mutable.save();
            console.log("SUCCESS: Repository successfully downloaded and attached to object: " + mutable.title);
        }
    } else {
        console.log("Unsuccessful download of master archive");
        console.log(response.errorMessage);
        console.log(response.body.readAsString("UTF-8"));
    }
});

P.implementService("std:action_panel:category:hres:person", function(display, builder) {
    if(display.object.ref != O.currentUser.ref) { return; }
    
    let user = O.user(display.object.ref);
    if(O.service("hres:github:integration:token_for_user", user)) {
        builder.panel(4000).link("default", "/do/hres-github-repository/list-repositories", "GitHub repositories");
    }
});

P.implementService("hres_repo_harvest_claim:notify:task_created", function(wu) {
    // Only goes to repository editors from GitHub when permissions in the record conflict
    if(wu.data.source === "GitHub" && wu.actionableBy.id === O.group(Group.RepositoryEditors).id) {
        wu.data.taskNote = "This task has been assigned to you due to conflicting permissions in the record, please check this thoroughly.";
        wu.save();
    }
});